// 업로드 동적 대역 할당기(서버) — qosPolicy 의 "사용자 단위 가중 분배"를 업로드 방향에 집행한다.
//
// 업로드는 소스가 브라우저라 서버 수신 스로틀로는 회선 포화를 못 막는다(cloudflared 가 인바운드를
// line-rate 로 당겨 버퍼링 — uploadChunk.ts 참고). 그래서 서버는 "지금 네 몫이 얼마"만 계산해
// 각 청크 응답(rateBps)에 실어 보내고, **브라우저 케이던스가 그 속도를 집행**한다(폐루프 피드백).
//   • 갱신 주기 ≈ 청크 1개(8MB): 4 MB/s 면 2초, 하한 0.5 MB/s 면 16초 — 사실상 실시간 재배분.
//   • 구버전/외부 클라이언트가 rateBps 를 무시해도 기본레벨(1~2 MB/s) 고정 송신이라 안전하게 퇴화하고,
//     admission(전역 세션 상한) 덕에 합계도 유계다.
//
// 분배식: 유저 u 의 몫 = clamp(TOTAL × w_u / Σ(활성 유저 w), FLOOR, TOTAL) — **하한은 유저 단위**로 적용한
//   뒤 그 유저의 동시 세션 수로 균등 분할한다. 세션 단위로 하한을 걸면 연결을 늘릴수록 유저 합산이
//   세션수×FLOOR 로 증폭돼 "연결을 늘려도 유저 몫은 그대로" 불변식과 가중 서열(creator 2배)이 깨진다.
//   혼자면 TOTAL 전체(몰아주기). 하한이 걸린 유저들 때문에 광고 합계가 TOTAL 을 다소 넘을 수 있으나
//   유저당 최대 FLOOR 초과분으로 유계다(admission 이 세션·유저 수를 제한).
//
// 생존 관리: 세션은 touch(청크 시작·수신 스트림 진행 중 주기 호출)로 생존 신고한다. TTL 넘게 소식 없는
// 세션은 중단으로 보고 지분을 회수(유령 세션이 분모만 키우는 것 방지). 끊겼던 업로드가 재시도로
// 복귀하면 touch 가 재등록한다(진행 중이던 전송은 admission 을 다시 통과할 필요 없음 — 의도적).

import { UPLOAD_ALLOC_FLOOR_BPS, maxUploadSessions, uploadTotalBytesPerSec } from "@/lib/qosPolicy";

// 정상 경로 최대 무통신 간격보다 넉넉하게. 최저 세션 속도 = FLOOR÷유저세션상한(0.5/3 ≈ 0.17 MB/s)일 때
// 청크(8MB) 케이던스 간격 ≈ 48s 이므로 그 2배 수준. 이보다 긴 침묵은 중단(탭 닫힘·네트워크 유실)으로
// 간주한다. 120s 행 → 재시도 같은 극단 케이스는 퇴출됐다가 touch 로 복귀.
const SESSION_TTL_MS = 90_000;

// 유저(owner)당 동시 세션 상한 — 한 계정이 전역 admission 슬롯을 독점해 타인 업로드를 429 로 막는
// 것을 차단한다(단일샷·청크 공통 게이트). 월드 조각파일 상한(importParts.MAX_CONCURRENT_UPLOADS=3)과 정렬.
const MAX_OWNER_SESSIONS = 3;

type UpSession = { owner: string; weight: number; lastSeen: number };

export class UploadAllocator {
  // key = `${ownerId}:${uploadId}` — 라우트에서 소유자·uuid 형식이 이미 검증된 값만 들어온다.
  private readonly sessions = new Map<string, UpSession>();
  private readonly maxSessions: number;

  constructor(readonly totalBps: number) {
    this.maxSessions = maxUploadSessions(totalBps);
  }

  // TTL 지난 세션 회수 — 세션 수가 작아(상한 ceil(TOTAL/FLOOR), 기본 8) 매 호출 전수 순회로 충분.
  private sweep(now = Date.now()): void {
    for (const [k, s] of this.sessions) {
      if (now - s.lastSeen > SESSION_TTL_MS) this.sessions.delete(k);
    }
  }

  private upsert(owner: string, id: string, weight: number): void {
    const key = `${owner}:${id}`;
    const s = this.sessions.get(key);
    if (s) {
      s.lastSeen = Date.now();
      s.weight = weight; // 역할 변경이 전송 중 반영되도록 매번 갱신
    } else {
      this.sessions.set(key, { owner, weight, lastSeen: Date.now() });
    }
  }

  // 신규 세션 진입(admission) — 전역 상한 또는 이 유저의 상한을 넘으면 거부(false). 이미 등록된 키
  // (같은 업로드의 재시도)는 항상 허용. 동기 함수라 "검사→등록"이 원자적(단일 이벤트루프, await 없음).
  // 유저별 상한은 항상 타 유저 몫의 슬롯을 남긴다(전역이 아주 작으면 전역-1 로 축소).
  tryAdmit(owner: string, id: string, weight: number): boolean {
    this.sweep();
    if (!this.sessions.has(`${owner}:${id}`)) {
      if (this.sessions.size >= this.maxSessions) return false;
      const ownerCap = Math.max(1, Math.min(MAX_OWNER_SESSIONS, this.maxSessions - 1));
      let mine = 0;
      for (const s of this.sessions.values()) if (s.owner === owner) mine++;
      if (mine >= ownerCap) return false;
    }
    this.upsert(owner, id, weight);
    return true;
  }

  // 생존 신고(upsert) — 청크 처리 시작·수신 스트림의 데이터 진행마다 호출. TTL 로 퇴출됐던 세션도
  // 여기서 재등록된다(진행 중 업로드의 복귀 경로).
  touch(owner: string, id: string, weight: number): void {
    this.upsert(owner, id, weight);
  }

  // 세션 종료(정상 완료·치명 실패) — 지분 즉시 반환. 이중 호출 무해.
  release(owner: string, id: string): void {
    this.sessions.delete(`${owner}:${id}`);
  }

  // 이 세션의 현재 몫(초당 바이트). 호출 전 touch/tryAdmit 로 등록돼 있어야 정확하며,
  // 등록을 겸하도록 upsert 를 포함한다(등록→계산이 한 호출로 원자적).
  rateFor(owner: string, id: string, weight: number): number {
    this.sweep();
    this.upsert(owner, id, weight);
    // 유저별 대표 가중치 합(유저당 1회) + 이 유저의 동시 세션 수
    const ownerWeight = new Map<string, number>();
    let mySessions = 0;
    for (const s of this.sessions.values()) {
      const w = ownerWeight.get(s.owner);
      if (w === undefined || s.weight > w) ownerWeight.set(s.owner, s.weight);
      if (s.owner === owner) mySessions++;
    }
    let sumW = 0;
    for (const w of ownerWeight.values()) sumW += w;
    // 하한/상한은 **유저 몫**에 적용 후 세션 분할 — 세션 단위 하한은 다중 연결 증폭을 낳는다(파일 상단 참고).
    const userShare = (this.totalBps * (ownerWeight.get(owner) ?? weight)) / (sumW || weight);
    const userTotal = Math.min(this.totalBps, Math.max(UPLOAD_ALLOC_FLOOR_BPS, userShare));
    return Math.max(1, Math.floor(userTotal / Math.max(1, mySessions)));
  }

  activeSessions(): number {
    this.sweep();
    return this.sessions.size;
  }
}

// 프로세스 전역 할당기 — env(WORLD_UPLOAD_TOTAL_MBPS)는 최초 사용 시 한 번 읽는다(변경=재시작 반영).
// "0"이면 null(동적 할당 비활성 — 클라이언트는 기본레벨 고정 속도, admission 없음).
let allocator: UploadAllocator | null | undefined;
export function uploadAllocator(): UploadAllocator | null {
  if (allocator === undefined) {
    const bps = uploadTotalBytesPerSec();
    allocator = bps > 0 ? new UploadAllocator(bps) : null;
    console.log(
      `[qos] 업로드 동적 할당 = ${
        bps > 0
          ? `총 ${(bps / 1048576).toFixed(1)} MB/s · 동시 최대 ${maxUploadSessions(bps)} 세션(유저당 ${MAX_OWNER_SESSIONS}) · 사용자 단위 가중 분배`
          : "비활성(클라이언트 기본레벨 고정)"
      }`
    );
  }
  return allocator;
}

// 월드 전송(업로드/다운로드) 속도 제한 — 서버 측 백프레셔로 Cloudflare Tunnel(cloudflared)이
// 서버 인터넷 회선을 포화시키지 못하게 한다. (파일명은 upload 지만 양방향을 다룬다.)
//
// 왜 서버 측 throttle 인가:
//   업로드: 브라우저 → CF엣지 → cloudflared(서버 회선으로 당겨옴) → localhost:3000 → 디스크.
//           라우트가 수신 스트림을 천천히 소비하면 백프레셔가 cloudflared 까지 전파돼 엣지에서 빨리 못 당긴다.
//   다운로드: 디스크 → localhost:3000 → cloudflared → CF엣지 → 브라우저.
//           라우트가 응답을 천천히 생산하면 cloudflared 가 엣지로 보낼 게 그만큼만 있어 아웃바운드가 제한된다.
//   → 어느 방향이든 서버가 소비/생산 속도를 쥐면 cloudflared 대역이 제한돼, 같은 회선을 공유하는
//     마인크래프트 서버(포트 8831)가 버퍼블로트로 끊기지 않는다. **OS QoS/프로토콜(QUIC 등)에 무관하게 동작.**
//
// 공평 큐잉(가중 WFQ, **사용자 단위**):
//   방향별 전역 토큰버킷(총합 = env 값) 위에서, 대기 중인 전송(연결)들에게 가상시간 순서로 토큰을
//   배분한다. 선착순(FCFS) 대기와 달리 청크가 큰 전송이 버킷을 독식하지 못하고, 활성 전송들이
//   가중치 비율로 대역을 나눠 갖는다. 등급 배수(qosPolicy.qosWeight, creator 2배)는 별도 버킷이
//   아니라 **가중치**로 반영 — 총합은 항상 env 값으로 고정되고(과거 tier별 버킷 합산으로 회선예산을
//   초과하던 문제 해소), 경쟁 시 creator 가 2배 지분을 받는다. 혼자일 땐 누구든 전체 대역을 쓴다.
//   같은 유저(userKey)가 연결을 여러 개 열면 유효 가중치를 세션 수로 나눠 **유저 몫은 그대로** —
//   연결 수로 지분을 배가할 수 없다(사용자 단위 공평, qosPolicy 참고).
//
// env(초당 메가바이트, MB/s): 업로드=`WORLD_UPLOAD_THROTTLE_MBPS`, 다운로드=`WORLD_DOWNLOAD_THROTTLE_MBPS`.
//   예: 5 = 5 MB/s ≈ 40 Mbps.  미설정 시 기본값.  **"0" 일 때만** 비활성(무제한).
//   오타/쓰레기값은 무제한이 아니라 기본값으로 폴백(fail-safe). 하한 1 MB/s. (파싱=qosPolicy.parseMbpsEnv)

import { Readable } from "stream";
import { parseMbpsEnv, QOS_TOTAL_DEFAULT_MBPS } from "@/lib/qosPolicy";

// 방향별 기본 상한(MB/s). env 로 조정 가능.
//  - 업로드=0(off): 업로드 회선 제한은 클라이언트 케이던스 + 동적 할당(qosUpload)이 담당한다.
//    서버측 수신 스로틀은 cloudflared 인바운드 버퍼링 때문에 회선포화를 못 막으므로 기본 비활성(설정 시 디스크 쓰기만 페이싱).
//  - 다운로드=QOS_TOTAL_DEFAULT_MBPS(4): 서버가 소스라 서버측 스로틀이 실제로 회선을 제한한다(권위).
const DEFAULT_UPLOAD_MBPS = 0;
const DEFAULT_DOWNLOAD_MBPS = QOS_TOTAL_DEFAULT_MBPS;

export function uploadThrottleBytesPerSec(): number {
  return parseMbpsEnv(process.env.WORLD_UPLOAD_THROTTLE_MBPS, "WORLD_UPLOAD_THROTTLE_MBPS", DEFAULT_UPLOAD_MBPS);
}
export function downloadThrottleBytesPerSec(): number {
  return parseMbpsEnv(process.env.WORLD_DOWNLOAD_THROTTLE_MBPS, "WORLD_DOWNLOAD_THROTTLE_MBPS", DEFAULT_DOWNLOAD_MBPS);
}

// gate(len) 을 await 하면 len 바이트를 처리할 차례+토큰이 올 때까지 대기한다.
export type ThrottleGate = (len: number) => Promise<void>;
// 전송 1건(연결)의 스케줄러 등록. 스트림이 끝나면(성공/실패/취소 모두) 반드시 end() — 링에서 빠져야
// 남은 전송들이 그 지분을 즉시 회수한다. end() 누락은 대역 낭비가 아니라 "유령 연결"로 남아 분모만 키운다.
export type ThrottleSession = { gate: ThrottleGate; end: () => void };

// ── 가중 공평 큐잉(WFQ, 가상시간 방식) 스케줄러 ─────────────────────────────────
// 전역 토큰버킷(rate=bytesPerSec, 용량≈1초치)이 총량을 제한하고, "누구 차례인가"는 가상시간으로 정한다:
// 세션마다 vt 를 두고 그랜트할 때마다 vt += len/weight. 항상 **vt 가 가장 작은 대기 세션**을 먼저
// 통과시키면 장기적으로 각 세션의 바이트 속도가 가중치에 비례한다(청크 크기와 무관 — 큰 청크는 vt 가
// 크게 뛰어 다음 차례가 늦어지는 식으로 자동 상쇄). 스트림은 청크를 순차 await 하므로 세션당 대기
// 요청은 항상 최대 1개 — 큐 구조가 단순하다.
const MAX_SLEEP_MS = 30_000; // 단일 슬립 상한 — CF ~100s 안에서 재확인(거대 슬립 방지)

type Pending = { len: number; resolve: () => void };
type FairSession = { user: string | symbol; weight: number; vt: number; pending: Pending | null };

class FairThrottle {
  private tokens: number;
  private last = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly sessions = new Set<FairSession>();
  // 유저별 활성 세션 수 — 유효 가중치 = weight / (그 유저의 세션 수). 같은 유저가 연결을 늘려도
  // 유저 합산 지분은 가중치 그대로다. userKey 미지정 세션은 심볼로 자기 자신이 유저(세션=유저, 과거 동작).
  private readonly userCount = new Map<string | symbol, number>();
  private vnow = 0; // 시스템 가상시간 ≈ 마지막 그랜트 세션의 vt — 신규/복귀 세션의 기준점

  constructor(private readonly bytesPerSec: number, private readonly capacity = bytesPerSec) {
    this.tokens = this.capacity;
  }

  // 세션 수 변동이 즉시(다음 그랜트부터) 반영되도록 가중치는 그랜트 시점에 계산한다.
  private effWeight(s: FairSession): number {
    return s.weight / Math.max(1, this.userCount.get(s.user) ?? 1);
  }

  open(weight: number, userKey?: string): ThrottleSession {
    const user: string | symbol = userKey ?? Symbol("anon");
    this.userCount.set(user, (this.userCount.get(user) ?? 0) + 1);
    const s: FairSession = { user, weight: weight > 0 && Number.isFinite(weight) ? weight : 1, vt: this.vnow, pending: null };
    this.sessions.add(s);
    return {
      gate: (len: number) =>
        new Promise<void>((resolve) => {
          if (!this.sessions.has(s)) { resolve(); return; } // end() 이후 late gate — 그냥 통과(스트림 정리 중)
          // 세션당 동시 대기 1개 전제(스트림 순차 소비). 혹시 겹치면 이전 것을 먼저 풀어 데드락 방지.
          if (s.pending) s.pending.resolve();
          // 놀다 온 세션이 과거 vt 로 대역을 몰아받지 못하게 현재 가상시간으로 끌어올린다(적립 금지).
          s.vt = Math.max(s.vt, this.vnow);
          s.pending = { len, resolve };
          this.pump();
        }),
      end: () => {
        if (!this.sessions.delete(s)) return; // 이중 end 무해
        const c = (this.userCount.get(user) ?? 1) - 1;
        if (c <= 0) this.userCount.delete(user); else this.userCount.set(user, c);
        if (s.pending) { s.pending.resolve(); s.pending = null; } // 취소된 스트림 즉시 해방
        this.pump(); // 남은 세션이 지분을 즉시 회수
      },
    };
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.bytesPerSec);
    this.last = now;
  }

  // 그랜트 루프 — 최소 vt 세션부터 토큰이 허락하는 만큼 동기 통과시키고, 토큰이 마르면
  // (새치기 없이) 그 세션 몫이 찰 때까지 타이머로 대기한다. 작은 청크가 큰 청크를 영원히
  // 앞지르는 기아(starvation)가 구조적으로 불가능하다.
  private pump(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.refill();
    for (;;) {
      let best: FairSession | null = null;
      for (const s of this.sessions) {
        if (s.pending && (!best || s.vt < best.vt)) best = s;
      }
      if (!best || !best.pending) return; // 대기 없음
      const { len, resolve } = best.pending;
      // len 이 버킷 용량보다 커도(드묾: rate < 청크길이/초) 버킷이 가득 차면 통과시켜 데드락 방지.
      if (this.tokens >= len || this.tokens >= this.capacity) {
        // 바닥을 -capacity 로 고정 — len>capacity 여도 다음 대기가 len/rate 초까지 폭증(라이브록)하지 않게.
        this.tokens = Math.max(-this.capacity, this.tokens - len);
        this.vnow = best.vt;
        best.vt += len / this.effWeight(best);
        best.pending = null;
        resolve();
        continue;
      }
      // 차례인 세션의 토큰이 부족 — 그 몫이 찰 때까지 슬립 후 재개.
      const need = Math.min(len, this.capacity) - this.tokens;
      const waitMs = Math.min(MAX_SLEEP_MS, Math.max(5, Math.ceil((need / this.bytesPerSec) * 1000)));
      this.timer = setTimeout(() => { this.timer = null; this.pump(); }, waitMs);
      return;
    }
  }
}

// 프로세스 전역 스케줄러(방향별 하나씩) — 동시 전송 N개의 **합계**가 env 값으로 제한되고, 그 안에서
// 세션 가중치 비율로 공평 배분된다. env 는 최초 사용 시 한 번 읽는다(변경=재시작 반영).
function logGate(dir: string, bps: number): void {
  // 최초 사용 시 1회 — 새 빌드가 실행 중인지 + 적용 속도를 서버 콘솔에서 확인할 수 있게.
  console.log(`[uploadThrottle] ${dir} 스로틀 = ${bps > 0 ? (bps / 1048576).toFixed(1) + " MB/s (공평 큐잉)" : "비활성(무제한)"}`);
}

let uploadScheduler: FairThrottle | null | undefined;
let downloadScheduler: FairThrottle | null | undefined;

// 업로드 수신 세션 — 요청(전송) 시작 시 열고 finally 에서 end(). 비활성이면 null(논스로틀 경로 무오버헤드).
// userKey(프로필 id)를 주면 같은 유저의 동시 업로드가 유저 몫을 나눠 갖는다.
export function openUploadSession(weight = 1, userKey?: string): ThrottleSession | null {
  if (uploadScheduler === undefined) {
    const bps = uploadThrottleBytesPerSec();
    uploadScheduler = bps > 0 ? new FairThrottle(bps) : null;
    logGate("업로드 수신", bps);
  }
  return uploadScheduler ? uploadScheduler.open(weight, userKey) : null;
}

// 다운로드 송신 세션 — weight 는 등급 가중치(qosPolicy.qosWeight, creator=2). 총합은 env 로 고정되고
// 경쟁 시 유저별 가중치 비율로 배분(혼자면 전체 대역 사용). userKey(프로필 id)로 유저 단위 공평 적용.
export function openDownloadSession(weight = 1, userKey?: string): ThrottleSession | null {
  if (downloadScheduler === undefined) {
    const bps = downloadThrottleBytesPerSec();
    downloadScheduler = bps > 0 ? new FairThrottle(bps) : null;
    logGate("다운로드 송신", bps);
  }
  return downloadScheduler ? downloadScheduler.open(weight, userKey) : null;
}

// 다운로드 응답 Readable 을 세션 속도로 페이싱한다 — 각 청크를 내보내기 전 토큰을 소비(응답 생산을 늦춤)해
// cloudflared 아웃바운드를 제한하고(회선 여유 → MC 안 끊김), 소비자(클라)가 느리면 for-await 가 멈춰 백프레셔가
// 걸린다. session=null 이면 원본 그대로.
// 정리는 3중으로 보장한다(end/destroy 는 멱등이라 중복 무해):
//   (1) 제너레이터 finally — 정상 종료·에러·소비 중 취소.
//   (2) 반환 스트림 'close' — **첫 read 전 destroy/cancel** 시 suspended-start 제너레이터의 finally 가
//       실행되지 않는 JS 명세 구멍을 막는다(안 막으면 세션이 영구 잔류해 그 유저의 이후 지분이 반감 + fd 누수).
//   (3) signal(요청 abort) — 클라이언트가 끊었는데 아무도 스트림을 read/cancel 하지 않는 경우
//       (Next 는 응답 소켓이 이미 닫혀 있으면 스트림을 소비도 취소도 않고 방치) 여기서 직접 destroy.
//       다운로드 라우트는 반드시 request.signal 을 넘길 것.
export function throttledReadable(src: Readable, session: ThrottleSession | null, signal?: AbortSignal): Readable {
  if (!session) return src;
  const s = session;
  async function* gen() {
    try {
      for await (const chunk of src) {
        const buf = chunk as Buffer;
        await s.gate(buf.length);
        yield buf;
      }
    } finally {
      cleanup();
    }
  }
  const out = Readable.from(gen());
  const onAbort = () => out.destroy();
  function cleanup(): void {
    s.end();
    src.destroy();
    signal?.removeEventListener("abort", onAbort);
  }
  out.once("close", cleanup);
  if (signal) {
    if (signal.aborted) out.destroy();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return out;
}

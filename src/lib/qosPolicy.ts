// 전송 QoS 정책(중앙) — "누가(역할 가중치) 얼마나(방향별 총량) 어떻게(동적 배분)"를 한곳에서 정의한다.
// 순수 모듈(클라이언트/서버 공용, node 의존 없음).
//
// 모델: 방향별 **총 대역(env)** 하나를 활성 사용자들이 **역할 가중치 비율**로 실시간 분배한다.
//   • 혼자면 총 대역 전체를 쓴다(work-conserving — 남는 대역을 놀리지 않고 몰아준다).
//   • n명이면 유저 u 의 몫 = TOTAL × w_u / Σ(활성 유저 w). 같은 유저가 동시 전송을 여러 건 열면
//     그 몫을 세션끼리 나눈다 — 연결을 늘려도 유저 몫은 그대로(연결 단위가 아닌 **사용자 단위** 공평).
//   • 역할 기본레벨(=가중치): user/builder=1, creator 이상=2 → 혼잡 시 creator 가 2배 지분.
//
// 집행 지점은 방향마다 다르다(전송 소스가 다르므로):
//   • 다운로드: 서버가 소스 → 서버 WFQ(uploadThrottle.FairThrottle)가 권위적으로 집행. 배분은
//     가상시간 스케줄링이라 세션 증감 즉시(다음 그랜트부터) 재배분된다.
//   • 업로드: 브라우저가 소스 — 서버 수신 스로틀은 cloudflared 인바운드 버퍼링 탓에 회선 포화를 못
//     막는다(uploadChunk.ts 참고). → 서버 할당기(qosUpload.UploadAllocator)가 몫을 계산해 청크 응답
//     (rateBps)으로 내려주고, 브라우저 케이던스가 그 속도로 송신한다(폐루프 피드백, 청크≈8MB 주기 갱신).

import { isCreatorOrAbove } from "@/lib/roles";

// 역할별 기본 대역 레벨(MB/s) = 배분 가중치. 혼잡 시 이 비율로 총 대역을 나눠 갖고,
// 동적 할당 정보가 없을 때(구버전 클라·할당 비활성)는 이 절대값이 고정 속도가 된다.
export const QOS_BASE_MBPS = { user: 1, creatorPlus: 2 } as const;

// 방향별 총 대역 기본값(MB/s). 실제 값은 env 로 조정 — 업로드=WORLD_UPLOAD_TOTAL_MBPS,
// 다운로드=WORLD_DOWNLOAD_THROTTLE_MBPS. ETA 표시 상수(transferEta.ts)도 이 값을 기준으로 한다.
export const QOS_TOTAL_DEFAULT_MBPS = 4;

// 역할 → 배분 가중치(=기본레벨 값). 다운로드 WFQ 와 업로드 할당기가 동일 기준을 쓴다.
export function qosWeight(role: string | null | undefined): number {
  return isCreatorOrAbove(role) ? QOS_BASE_MBPS.creatorPlus : QOS_BASE_MBPS.user;
}

// 업로드 동적 할당 하한(초당 바이트) — **유저 몫 단위**로 적용(qosUpload.rateFor. 세션 단위 하한은
// 다중 연결로 유저 몫이 증폭되는 구멍이라 금지). 하한 탓에 극단 혼잡에서 광고 합계가 TOTAL 을 다소
// 넘을 수 있어, 전역 동시 세션 수를 ceil(TOTAL/FLOOR)로 제한한다(admission — 유저당 상한은 qosUpload).
// 최저 세션 속도 = FLOOR÷유저세션상한(≈0.17 MB/s)이어도 청크(8MB) 간격 ≈48s < 세션 TTL(90s)로 안전.
export const UPLOAD_ALLOC_FLOOR_BPS = 512 * 1024; // 0.5 MB/s

// 업로드 전역 동시 세션 상한 — FLOOR 보장 합계가 TOTAL 을 크게 넘지 않게 하는 admission 한도.
export function maxUploadSessions(totalBps: number): number {
  return Math.max(1, Math.ceil(totalBps / UPLOAD_ALLOC_FLOOR_BPS));
}

// env 문자열(MB/s) → 초당 바이트. 업/다운 공통 규칙: 미설정=기본값, **"0"만** 비활성(무제한/기능 off),
// 오타·쓰레기값은 무제한이 아니라 기본값으로 폴백(fail-safe), 하한 1 MB/s(0 이 아닌 한).
const MIN_MBPS = 1;
export function parseMbpsEnv(raw: string | undefined, envLabel: string, defaultMbps: number): number {
  if (raw === undefined || raw === "") return defaultMbps * 1024 * 1024; // 미설정 = 기본값
  if (raw.trim() === "0") return 0; // 명시적 비활성(유일한 off 스위치)
  let mbps = Number(raw);
  if (!Number.isFinite(mbps) || mbps <= 0) {
    console.warn(`[qos] ${envLabel}="${raw}" 를 해석할 수 없어 기본값 ${defaultMbps} MB/s 로 폴백합니다. (비활성은 "0")`);
    mbps = defaultMbps;
  } else if (mbps < MIN_MBPS) {
    console.warn(`[qos] ${envLabel}=${mbps} 는 하한 ${MIN_MBPS} MB/s 미만이라 ${MIN_MBPS} MB/s 로 올립니다.`);
    mbps = MIN_MBPS;
  }
  return Math.floor(mbps * 1024 * 1024);
}

// 업로드 총 대역(초당 바이트, 서버 전용). "0"=동적 할당 비활성 — 클라이언트는 기본레벨 고정 속도로 폴백.
export function uploadTotalBytesPerSec(): number {
  return parseMbpsEnv(process.env.WORLD_UPLOAD_TOTAL_MBPS, "WORLD_UPLOAD_TOTAL_MBPS", QOS_TOTAL_DEFAULT_MBPS);
}

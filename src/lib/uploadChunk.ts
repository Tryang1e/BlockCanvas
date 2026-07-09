// 월드 삽입(청크 업로드) 청크 크기 — 클라이언트와 서버가 공유한다(순수 상수, node 의존 없음이라 양쪽 import 가능).
// Cloudflare Tunnel 요청본문 한도(100MB) 아래로 유지. 서버는 이 값으로 chunkStart/chunkCount 를 검증해
// 클라이언트가 보낸 오프셋이 규약(chunkIndex*크기)과 정확히 일치하는지 확인한다(임의 오프셋 공격 차단).
// 8MB(작게) — 업로드 속도제한을 요청 스트리밍 대신 "청크 케이던스"(전 브라우저 동작)로 하므로, 각 청크
// 버스트를 짧게(≈0.6s@100Mbit) 유지해 회선 포화(버퍼블로트)로 MC 가 끊기지 않게 한다. CF 100MB·100s 여유.
export const UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB

// 클라이언트 업로드 송신 **초기/폴백 속도**(초당 바이트) — 역할 기본레벨(qosPolicy.QOS_BASE_MBPS.user)과 동일.
// ⚠ 서버측 수신 스로틀은 업로드(인바운드)에서 cloudflared 가 회선에서 데이터를 line-rate 로 당겨가
//   버퍼링하기 때문에 회선 포화를 막지 못한다(다운로드는 우리가 소스라 막힘). 따라서 업로드 상한은
//   **소스인 브라우저 송신 속도**로 걸어야 모든 하위 홉(cloudflared 인바운드 포함)이 그 이하가 된다.
// 동적 할당(qosUpload)이 켜져 있으면(기본) 첫 청크 응답부터 서버가 내려주는 rateBps 가 이 값을 대체하고
// (혼자면 총 대역 전체, 혼잡 시 가중 1/n), 이 값은 첫 청크·rateBps 미지원 경로의 안전 속도로만 쓰인다.
// env `NEXT_PUBLIC_WORLD_UPLOAD_THROTTLE_MBPS`(MB/s, 빌드타임 인라인). 미설정=1(빌더 기본레벨,
// creator 이상은 호출부에서 ×2), "0"=무제한, 그 외 파싱실패=1.
export function clientUploadBytesPerSec(): number {
  const raw = process.env.NEXT_PUBLIC_WORLD_UPLOAD_THROTTLE_MBPS;
  if (raw === undefined || raw === "") return 1 * 1024 * 1024; // 기본 1 MB/s(빌더 기본레벨)
  if (raw.trim() === "0") return 0; // 명시적 무제한
  let mbps = Number(raw);
  if (!Number.isFinite(mbps) || mbps <= 0) mbps = 1; // 파싱 실패 = 안전 기본값
  else if (mbps < 0.5) mbps = 0.5; // 하한 0.5 MB/s — 8MB 청크(≤16s)가 Cloudflare ~100s 요청창을 넘지 않는 선
  return Math.floor(mbps * 1024 * 1024);
}

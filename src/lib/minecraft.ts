import crypto from "crypto";

const API_URL = process.env.MINECRAFT_API_URL || "http://localhost:25580";
const DEFAULT_API_SECRET = "blockcanvas-super-secret-key";
const API_SECRET = process.env.MINECRAFT_API_SECRET || DEFAULT_API_SECRET;

// 기본(공개) 시크릿/너무 짧은 키는 HMAC 보호를 무력화한다(누구나 인게임 API 위조 가능).
// 운영(production)에서는 fail-closed(throw)로 막아 위조 가능한 상태로 기동하지 않게 한다.
// 개발에서는 로컬 편의를 위해 경고만 하고 통과한다.
if (API_SECRET === DEFAULT_API_SECRET || API_SECRET.length < 16) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MINECRAFT_API_SECRET 이 미설정/기본값/너무 짧습니다 — 운영에서는 강력한 무작위 키(>=16자)가 필수입니다. " +
        ".env 에 설정하고 재시작하세요. (기본값을 쓰면 누구나 HMAC 으로 인게임 API 를 위조할 수 있습니다)"
    );
  }
  console.warn(
    "[minecraft] MINECRAFT_API_SECRET 이 기본값/미설정/짧음입니다 — 개발 전용. 운영에선 강력한 무작위 키(>=16자) 필수."
  );
}

/**
 * Spigot 플러그인과 동일한 방식(HMAC-SHA256)으로 요청 서명을 생성한다.
 * 서명 대상: `${timestamp}.${body}` (BlockCanvasLink.validateRequest 와 일치)
 */
function generateSignature(timestamp: string, body: string): string {
  return crypto
    .createHmac("sha256", API_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

// 🔒 H-2 리플레이 방지: 이미 처리한 (유효) 서명을 타임스탬프 허용창(±300s)보다 넉넉히 기억해 재사용을 거부한다.
// 단일 셀프호스트 인메모리 가정. 서명은 `${timestamp}.${body}` 의 HMAC 이므로 동일 (시각·본문) 재전송만 충돌한다
// → 정상 주기 보고는 시각이 달라 서명이 달라 오탐이 없고, 창(±300s) 밖은 타임스탬프 검사가 이미 거부한다.
// 델타 누적형 보상(recordBlockReward)의 캡처-재전송 파밍을 이 계층에서 봉쇄한다(모든 인바운드 POST 공통).
// ⚠ URL 서명(verifyCardUrlSignature, GET 리소스팩 등 반복 취득이 정상)에는 적용하지 않는다.
const REPLAY_TTL_MS = 600_000; // 10분(±5분 창을 넉넉히 덮음)
const seenSignatures = new Map<string, number>(); // signature -> 최초 처리 epoch(ms)
let lastReplaySweepMs = 0;

function isReplayedSignature(signature: string): boolean {
  const now = Date.now();
  // 지연 정리: 주기적으로(또는 과대 시) 만료 항목 제거해 메모리 상한을 유지한다.
  if (now - lastReplaySweepMs > 60_000 || seenSignatures.size > 10_000) {
    for (const [sig, ts] of seenSignatures) {
      if (now - ts > REPLAY_TTL_MS) seenSignatures.delete(sig);
    }
    lastReplaySweepMs = now;
  }
  const prev = seenSignatures.get(signature);
  if (prev !== undefined && now - prev <= REPLAY_TTL_MS) return true; // 이미 처리됨 → 리플레이
  seenSignatures.set(signature, now);
  return false;
}

/**
 * 인게임(Spigot)에서 들어오는 요청의 HMAC-SHA256 서명 + 타임스탬프를 검증한다.
 * link / sync 등 모든 인바운드 라우트가 공유한다.
 */
export function verifyInboundSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string = API_SECRET
): boolean {
  if (!signature || !timestamp) return false;

  // 리플레이 공격 방지 (±5분 초과 거부)
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(requestTime) || Math.abs(currentTime - requestTime) > 300) {
    return false;
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // 타이밍 공격 방지
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  // 🔒 H-2: 서명·시각이 유효해도 이미 처리한 서명이면(리플레이) 거부한다.
  //    유효성 통과 후에만 캐시에 기록해 무효 서명으로 인한 메모리 오염을 막는다.
  if (isReplayedSignature(signature)) return false;
  return true;
}

/**
 * 클라이언트(플레이어 MC)가 직접 받는 GET URL(개인 리소스팩 등)용 단기 토큰 검증.
 * 플러그인이 HMAC-SHA256(secret, `${uuid}:${name}:${exp}`) 로 서명한 URL(?uuid&name&exp&sig)을 검증한다.
 * exp = 만료 epoch(초). HMAC POST 와 달리 클라가 직접 받으므로 본문 서명 대신 URL 파라미터를 서명.
 */
export function verifyCardUrlSignature(
  uuid: string,
  name: string,
  exp: string | null,
  signature: string | null,
  secret: string = API_SECRET
): boolean {
  if (!signature || !exp || !uuid) return false;
  const e = parseInt(exp, 10);
  if (!Number.isFinite(e) || Math.floor(Date.now() / 1000) > e) return false; // 만료
  const computed = crypto.createHmac("sha256", secret).update(`${uuid}:${name}:${exp}`).digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface MinecraftResponse {
  success: boolean;
  status: number;
  message: string;
}

// 월드 로드/압축/삭제처럼 서버에서 오래 걸리는 작업(생성/삽입/서버채택/백업/삭제)용 타임아웃.
// 플러그인이 월드 로드에 최대 45초(future.get)를 쓰므로, 웹은 그보다 넉넉히 기다려야 한다 —
// 8초로 두면 플러그인이 아직 로딩 중인데 웹이 포기하고 롤백(삭제)까지 실행해 로딩 중 월드를 건드린다.
// 90초 — 플러그인 로드(최대 45s) + 압축해제/모드스캔 여유. Cloudflare 터널의 오리진 응답 한도(~100s) 아래로 유지
// (청크 업로드 finalize 는 브라우저→웹이 터널을 거치므로, 웹→플러그인이 이보다 오래 걸리면 어차피 터널이 524로 끊는다).
const HEAVY_OP_TIMEOUT_MS = 90_000;

/**
 * 마인크래프트 Spigot API 로 HMAC 서명된 POST 요청을 전송한다.
 * MC 서버 응답 지연 시 서버 액션이 무한 대기하지 않도록 타임아웃을 건다(기본 8s, 무거운 월드 작업은 호출부에서 상향).
 */
async function sendToMinecraft(
  endpoint: string,
  payload: object,
  timeoutMs: number = 8000
): Promise<MinecraftResponse> {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(payload);
    const signature = generateSignature(timestamp, body);

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseText = await response.text();
    return { success: response.ok, status: response.status, message: responseText };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error communicating with Minecraft API server:", msg);
    // 네트워크/타임아웃은 503(서비스 불가)로 정규화
    return { success: false, status: 503, message: msg || "Failed to reach Minecraft server." };
  }
}

// 플롯 식별은 (world, plotId) 복합 — 같은 plotId 가 여러 플롯월드(plotworld/plot_300…)에 존재할 수 있어
// world 를 함께 보내야 마크 서버가 정확한 월드의 플롯을 조회한다(world 누락 시 서버가 전체 스캔 폴백).

/** 웹 DB 플롯 캐시(MinecraftPlot) 행 키 — "<world>:<plotId>". 같은 plotId 가 여러 월드에 있어도 충돌하지 않게 네임스페이스한다. */
export function plotCacheId(world: string | null | undefined, plotId: string): string {
  return `${world || "world"}:${plotId}`;
}

/** 플롯에 플레이어를 trust(영구 건축 권한) 추가. */
export async function trustPlayerOnPlot(plotId: string, playerName: string, world: string) {
  return sendToMinecraft("/api/plot/trust", { plot_id: plotId, player_name: playerName, world });
}

/** 플롯에서 플레이어 trust 회수. */
export async function untrustPlayerOnPlot(plotId: string, playerName: string, world: string) {
  return sendToMinecraft("/api/plot/untrust", { plot_id: plotId, player_name: playerName, world });
}

/** 플롯 소유권 양도 예약(실제 변경은 인게임 /플롯 수락 또는 웹 대시보드 수락으로 완료).
 *  requesterUuid: 신청자의 마크 UUID — 마크 서버가 "현재 소유자 == 신청자"를 검증하는 데 사용. */
export async function transferPlotOwnership(plotId: string, targetName: string, requesterUuid: string, world: string) {
  return sendToMinecraft("/api/plot/transfer", {
    plot_id: plotId,
    target_name: targetName,
    requester_uuid: requesterUuid,
    world,
  });
}

/** 양수인이 웹 대시보드에서 소유권 양도를 수락 — 마크 서버가 "양도 대기 target == accepterUuid"(UUID)를 검증 후 setOwner. */
export async function acceptPlotTransfer(plotId: string, accepterUuid: string, world: string) {
  return sendToMinecraft("/api/plot/transfer/accept", { plot_id: plotId, accepter_uuid: accepterUuid, world });
}

/** 양수인이 웹 대시보드에서 소유권 양도를 거절. */
export async function rejectPlotTransfer(plotId: string, accepterUuid: string, world: string) {
  return sendToMinecraft("/api/plot/transfer/reject", { plot_id: plotId, accepter_uuid: accepterUuid, world });
}

/** 빈(미소유) 플롯을 claim(구매)한다. (BlockCanvasLink /api/plot/claim)
 *  buyerUuid: 구매자의 마크 UUID — 마크 서버가 미소유·한도·가격을 재검증한 뒤 setOwner 한다.
 *  claimBonus: 상점 '플롯 확장권' 개인 보너스(웹 DB plot_slot_bonus) — 플러그인이 역할 기본 한도에 가산(안전캡 clamp). */
export async function claimPlot(plotId: string, buyerUuid: string, world: string, claimBonus = 0) {
  return sendToMinecraft("/api/plot/claim", { plot_id: plotId, buyer_uuid: buyerUuid, world, claim_bonus: claimBonus });
}

/** 본인 소유 플롯을 삭제(건축 초기화 + 소유권 해제)한다. (BlockCanvasLink /api/plot/delete)
 *  requesterUuid: 마크 서버가 "현재 소유자 == 요청자"를 재검증 — 초대/타인 플롯 삭제 차단. */
export async function deletePlot(plotId: string, requesterUuid: string, world: string) {
  return sendToMinecraft("/api/plot/delete", { plot_id: plotId, requester_uuid: requesterUuid, world });
}

/** 플롯을 경매 매물로 등록한다(가격). (BlockCanvasLink /api/plot/auction/list)
 *  sellerUuid: 마크 서버가 "현재 소유자 == 판매자"를 재검증. */
export async function listAuction(plotId: string, sellerUuid: string, price: number, world: string) {
  return sendToMinecraft("/api/plot/auction/list", { plot_id: plotId, seller_uuid: sellerUuid, price, world });
}

/** 경매 매물을 취소한다(본인 소유만). (BlockCanvasLink /api/plot/auction/cancel) */
export async function cancelAuction(plotId: string, requesterUuid: string, world: string) {
  return sendToMinecraft("/api/plot/auction/cancel", { plot_id: plotId, requester_uuid: requesterUuid, world });
}

/** 경매 플롯을 구매(낙찰)한다 — 코인 이체(구매자→판매자) + 소유권 이전. (BlockCanvasLink /api/plot/auction/buy)
 *  claimBonus: 상점 '플롯 확장권' 개인 보너스 — 플러그인이 구매자 claim 한도에 가산. */
export async function buyAuction(plotId: string, buyerUuid: string, world: string, claimBonus = 0) {
  return sendToMinecraft("/api/plot/auction/buy", { plot_id: plotId, buyer_uuid: buyerUuid, world, claim_bonus: claimBonus });
}

/** 코인(CMI) 잔액 조회. (BlockCanvasLink /api/economy/balance) balance=null 이면 경제 미연동. */
export async function getEconomyBalance(
  playerUuid: string
): Promise<{ success: boolean; balance: number | null }> {
  const res = await sendToMinecraft("/api/economy/balance", { player_uuid: playerUuid });
  if (!res.success) return { success: false, balance: null };
  try {
    const p = JSON.parse(res.message);
    return { success: true, balance: typeof p.balance === "number" ? p.balance : null };
  } catch {
    return { success: false, balance: null };
  }
}

/**
 * 코인(CMI) 지급 — 웹 활동 보상(적립)용. (BlockCanvasLink /api/economy/give)
 * playerUuid 의 CMI 잔액에 amount 만큼 입금한다. 경제 미연동(CMI 없음) 시 success=false.
 * 적립 트리거에서 호출 — 실패해도 호출 측 본동작(게시 등)은 막지 말 것(fire-and-forget 권장).
 */
export async function awardCoins(
  playerUuid: string,
  amount: number,
  reason?: string,
  idempotencyKey?: string
): Promise<{ success: boolean; balance: number | null }> {
  if (!(amount > 0)) return { success: false, balance: null };
  // idempotencyKey(대개 CoinAward row id): 지급 응답 유실로 재시도(flushPendingCoins)해도 같은 키면 플러그인이
  // 재입금하지 않고 성공만 반환 → 코인 이중 발행 방지. 키를 넘기지 않으면 멱등 비활성(기존 동작).
  const res = await sendToMinecraft("/api/economy/give", {
    player_uuid: playerUuid,
    amount,
    ...(reason ? { reason } : {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  });
  if (!res.success) return { success: false, balance: null };
  try {
    const p = JSON.parse(res.message);
    return { success: true, balance: typeof p.balance === "number" ? p.balance : null };
  } catch {
    return { success: false, balance: null };
  }
}

/**
 * 코인(CMI) 유저 간 송금 — fromUuid → toUuid 로 amount 이체. (BlockCanvasLink /api/economy/transfer)
 * 원자적(서버에서 출금 성공 시에만 입금, 실패 시 환불). 잔액 부족 시 status=402.
 */
export async function transferCoins(
  fromUuid: string,
  toUuid: string,
  amount: number
): Promise<{ success: boolean; status: number; fromBalance?: number | null; toBalance?: number | null }> {
  if (!(amount > 0)) return { success: false, status: 400 };
  if (fromUuid === toUuid) return { success: false, status: 400 };
  const res = await sendToMinecraft("/api/economy/transfer", {
    from_uuid: fromUuid,
    to_uuid: toUuid,
    amount,
  });
  if (!res.success) return { success: false, status: res.status };
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      fromBalance: typeof p.from_balance === "number" ? p.from_balance : null,
      toBalance: typeof p.to_balance === "number" ? p.to_balance : null,
    };
  } catch {
    return { success: true, status: res.status };
  }
}

/**
 * 코인(CMI) 차감 — 상점 구매용(소각). (BlockCanvasLink /api/economy/charge)
 * 잔액 부족 시 status=402. 성공 시 차감 후 잔액 반환.
 */
export async function chargeCoins(
  playerUuid: string,
  amount: number
): Promise<{ success: boolean; status: number; balance?: number | null }> {
  if (!(amount > 0)) return { success: false, status: 400 };
  const res = await sendToMinecraft("/api/economy/charge", { player_uuid: playerUuid, amount });
  if (!res.success) return { success: false, status: res.status };
  try {
    const p = JSON.parse(res.message);
    return { success: true, status: res.status, balance: typeof p.balance === "number" ? p.balance : null };
  } catch {
    return { success: true, status: res.status };
  }
}

/**
 * 닉네임 변경(상점 '닉네임 변경권') — CMI nick 으로 적용. (BlockCanvasLink /api/cmi/nick)
 * nick 유효성(길이/금지어)은 호출 전 lib/nicknameFilter 로 검증할 것. status 404=접속 이력 없음.
 */
export async function setMinecraftNickname(
  playerUuid: string,
  nick: string
): Promise<{ success: boolean; status: number }> {
  const res = await sendToMinecraft("/api/cmi/nick", { uuid: playerUuid, nick });
  return { success: res.success, status: res.status };
}

/**
 * 구독 상태를 인게임에 동기화 — LuckPerms 임시 권한 blockcanvas.subscriber 를 만료일까지 부여(또는 해제).
 * until=null/과거 = 해제. 만료 시 LuckPerms 가 자동 회수(별도 스윕 불필요).
 * best-effort: 실패해도 구독 자체(DB·용량 혜택)는 유효하므로 호출측이 실패를 삼킨다. (BlockCanvasLink /api/luckperms/subscription)
 */
export async function syncSubscription(
  playerUuid: string,
  until: Date | null
): Promise<{ success: boolean; status: number }> {
  const untilEpoch = until ? Math.floor(until.getTime() / 1000) : 0;
  const res = await sendToMinecraft("/api/luckperms/subscription", { uuid: playerUuid, until_epoch: untilEpoch });
  return { success: res.success, status: res.status };
}

// ============================================================
//  제재(moderation) 전파 — 웹 처벌(원장)을 인게임에 best-effort 반영.
//  ⚠ 플러그인(BlockCanvasLink, Java) 측 /api/moderation/* 엔드포인트는 이 저장소 밖이며 별도 구현이 필요하다.
//    미구현 시 503 으로 무해하게 실패한다(웹 처벌은 그대로 유효). 호출부는 실패를 삼키고 console.warn 만.
// ============================================================

/** 인게임 채팅 뮤트 적용. until=null = 무기한. (BlockCanvasLink /api/moderation/mute) */
export async function muteMinecraftPlayer(uuid: string, until: Date | null, reason?: string) {
  return sendToMinecraft("/api/moderation/mute", {
    player_uuid: uuid,
    until: until ? until.toISOString() : null,
    ...(reason ? { reason } : {}),
  });
}

/** 인게임 채팅 뮤트 해제. (BlockCanvasLink /api/moderation/unmute) */
export async function unmuteMinecraftPlayer(uuid: string) {
  return sendToMinecraft("/api/moderation/unmute", { player_uuid: uuid });
}

/** 인게임 접속 차단(ban). until=null = 무기한. (BlockCanvasLink /api/moderation/ban) */
export async function banMinecraftPlayer(uuid: string, until: Date | null, reason?: string) {
  return sendToMinecraft("/api/moderation/ban", {
    player_uuid: uuid,
    until: until ? until.toISOString() : null,
    ...(reason ? { reason } : {}),
  });
}

/** 인게임 접속 차단 해제(unban). (BlockCanvasLink /api/moderation/unban) */
export async function unbanMinecraftPlayer(uuid: string) {
  return sendToMinecraft("/api/moderation/unban", { player_uuid: uuid });
}

/** 총 접속 시간(분) 조회 — 바닐라 통계 기반. (BlockCanvasLink /api/player/playtime) 미연동/오프라인 시 null. */
export async function getPlaytimeMinutes(
  playerUuid: string
): Promise<{ success: boolean; minutes: number | null }> {
  const res = await sendToMinecraft("/api/player/playtime", { player_uuid: playerUuid });
  if (!res.success) return { success: false, minutes: null };
  try {
    const p = JSON.parse(res.message);
    return { success: true, minutes: typeof p.minutes === "number" ? p.minutes : null };
  } catch {
    return { success: false, minutes: null };
  }
}

/** 구매 가능 횟수(역할별 한도/보유/남은 수) + 확장권 정보 조회. (BlockCanvasLink /api/plot/claim-info)
 *  remaining: -1 = 무제한, 그 외 max(0, limit-owned). base=그룹 기본 한도, bonus=확장권 누적, bonusMax=확장 상한. */
export async function getPlotClaimInfo(
  playerUuid: string,
  claimBonus = 0
): Promise<{ success: boolean; limit?: number; owned?: number; remaining?: number; base?: number; bonus?: number; bonusMax?: number }> {
  const res = await sendToMinecraft("/api/plot/claim-info", { player_uuid: playerUuid, claim_bonus: claimBonus });
  if (!res.success) return { success: false };
  try {
    const p = JSON.parse(res.message);
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);
    return {
      success: true,
      limit: num(p.limit),
      owned: num(p.owned),
      remaining: num(p.remaining),
      base: num(p.base),
      bonus: num(p.bonus),
      bonusMax: num(p.bonusMax),
    };
  } catch {
    return { success: false };
  }
}

export interface PlotMember {
  uuid: string;
  name: string;
}

export interface MinecraftPlotDto {
  id: string;
  world: string;
  alias: string;
  x: number | null;
  z: number | null;
  members: PlotMember[];
  trusted: PlotMember[];
}

// 플러그인 버전에 따라 trusted/members 가 "uuid" 문자열 또는 { uuid, name } 객체로
// 올 수 있어, 어느 쪽이든 { uuid, name } 으로 정규화한다(미갱신 플러그인과 호환).
function normalizeMembers(arr: unknown): PlotMember[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => {
    if (typeof m === "string") return { uuid: m, name: m };
    const o = (m ?? {}) as { uuid?: string; name?: string };
    return { uuid: o.uuid ?? "", name: o.name ?? o.uuid ?? "" };
  });
}

/**
 * Spigot /api/plot/list 응답을 파싱해 플롯 목록을 반환한다.
 * (BlockCanvasLink.handleListRequest 가 { success, plots: [...] } JSON 을 반환)
 */
export async function getPlayerPlots(
  playerUuid: string
): Promise<{ success: boolean; status: number; plots: MinecraftPlotDto[]; message?: string }> {
  const res = await sendToMinecraft("/api/plot/list", { player_uuid: playerUuid });
  if (!res.success) {
    return { success: false, status: res.status, plots: [], message: res.message };
  }
  try {
    const parsed = JSON.parse(res.message);
    const rawPlots = Array.isArray(parsed?.plots) ? parsed.plots : [];
    const plots: MinecraftPlotDto[] = rawPlots.map((p: Record<string, unknown>) => ({
      id: String(p.id ?? ""),
      world: String(p.world ?? "world"),
      alias: String(p.alias ?? ""),
      x: typeof p.x === "number" ? p.x : null,
      z: typeof p.z === "number" ? p.z : null,
      members: normalizeMembers(p.members),
      trusted: normalizeMembers(p.trusted),
    }));
    return { success: true, status: res.status, plots };
  } catch {
    return { success: false, status: 502, plots: [], message: "Invalid JSON from Minecraft server." };
  }
}

/**
 * 서버에 개인 월드 생성을 요청한다. (BlockCanvasLink /api/world/create)
 * 서버가 Bukkit WorldCreator 로 생성 후 { success, folder, size_bytes } 를 반환.
 */
export async function createMinecraftWorld(
  worldName: string,
  generator: string,
  border: number = 3000,
  generateStructures: boolean = true
): Promise<{ success: boolean; status: number; folder?: string; sizeBytes?: number; version?: string; error?: string }> {
  const res = await sendToMinecraft("/api/world/create", {
    world_name: worldName,
    generator: generator === "wild" ? "wild" : "flat",
    border,
    generate_structures: generateStructures,
  }, HEAVY_OP_TIMEOUT_MS);
  if (!res.success) {
    let error = res.message;
    try {
      const p = JSON.parse(res.message);
      if (p?.error) error = p.error;
    } catch { /* plain text body */ }
    return { success: false, status: res.status, error };
  }
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      folder: typeof p.folder === "string" ? p.folder : worldName,
      sizeBytes: typeof p.size_bytes === "number" ? p.size_bytes : 0,
      version: typeof p.version === "string" ? p.version : undefined,
    };
  } catch {
    return { success: false, status: 502, error: "Invalid JSON from Minecraft server." };
  }
}

/**
 * 업로드된 .zip 월드를 서버에 삽입한다. (BlockCanvasLink /api/world/import)
 * zipPath 는 웹이 디스크에 저장한 절대경로(동일 머신). border 는 보더 크기.
 */
/** 플러그인의 기술적 import 에러 코드를 사용자 친화 메시지로 변환. */
function friendlyImportError(raw: string): string {
  const s = raw || "";
  if (/level\.dat|invalid_world/i.test(s)) return "올바른 마인크래프트 월드가 아닙니다. (level.dat 이 포함된 월드 폴더를 압축한 .zip 이어야 합니다)";
  if (/zip_bomb/i.test(s)) return "압축을 풀었을 때 파일이 비정상적으로 커서 업로드를 중단했습니다. 정상적인 마인크래프트 월드 .zip 인지 확인해 주세요.";
  if (/disk_full/i.test(s)) return "서버 저장 공간이 부족해 업로드를 완료할 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.";
  if (/__scan_limit__/i.test(s)) return "월드가 너무 커서 모드 포함 여부 검사를 완료할 수 없습니다. 더 작은 월드를 올리거나 관리자에게 문의해 주세요.";
  if (/__external_chunk__/i.test(s)) return "검사할 수 없는 외부 청크(.mcc)가 포함돼 업로드를 거부했습니다. 바닐라 클라이언트에서 만든 월드만 올려주세요.";
  if (/unzip_failed/i.test(s)) return "압축 해제에 실패했습니다. 손상되지 않은 .zip 월드 파일인지 확인해 주세요.";
  if (/world_exists/i.test(s)) return "같은 이름의 월드가 서버에 이미 있습니다.";
  {
    const m = /modded_world:\s*([\w.\-]+)?/i.exec(s);
    if (m) return `모드(바닐라에 없는) 블록이 포함된 월드는 업로드할 수 없습니다.${m[1] ? ` (감지된 모드: ${m[1]})` : ""} 바닐라 클라이언트에서 만든 월드만 올려주세요.`;
  }
  if (/zip not found/i.test(s)) return "업로드 파일을 찾을 수 없습니다. 다시 시도해 주세요.";
  if (/source_not_found|not_in_inbox/i.test(s)) return "인박스 폴더에서 해당 월드를 찾을 수 없습니다. 폴더 이름을 확인해 주세요.";
  if (/load_failed|move_failed/i.test(s)) return "월드를 서버에 올리지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return s;
}

/**
 * 서버 인박스 폴더(world-adopt-inbox)에 있는 월드를 컨테이너의 folder(=w_해시)로 편입한다. (BlockCanvasLink /api/world/adopt-local)
 * 업로드 없이 서버에 이미 있는 맵을 대시보드 월드로 가져오는 경로. 플러그인이 인박스 하위인지 검증 후 이동+로드한다(경로 이탈 차단).
 */
export async function adoptLocalMinecraftWorld(
  folder: string,
  source: string,
  border: number = 3000
): Promise<{ success: boolean; status: number; sizeBytes?: number; version?: string; error?: string }> {
  const res = await sendToMinecraft("/api/world/adopt-local", { folder, source, border }, HEAVY_OP_TIMEOUT_MS);
  if (!res.success) {
    let error = res.message;
    try { const p = JSON.parse(res.message); if (p?.error) error = p.error; } catch { /* plain */ }
    return { success: false, status: res.status, error: friendlyImportError(error) };
  }
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      sizeBytes: typeof p.size_bytes === "number" ? p.size_bytes : 0,
      version: typeof p.version === "string" ? p.version : undefined,
    };
  } catch {
    return { success: false, status: 502, error: "Invalid JSON from Minecraft server." };
  }
}

export async function importMinecraftWorld(
  folder: string,
  zipPath: string,
  border: number = 3000
): Promise<{ success: boolean; status: number; sizeBytes?: number; version?: string; error?: string }> {
  const res = await sendToMinecraft("/api/world/import", { folder, zip_path: zipPath, border }, HEAVY_OP_TIMEOUT_MS);
  if (!res.success) {
    let error = res.message;
    try { const p = JSON.parse(res.message); if (p?.error) error = p.error; } catch { /* plain */ }
    return { success: false, status: res.status, error: friendlyImportError(error) };
  }
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      sizeBytes: typeof p.size_bytes === "number" ? p.size_bytes : 0,
      version: typeof p.version === "string" ? p.version : undefined,
    };
  } catch {
    return { success: false, status: 502, error: "Invalid JSON from Minecraft server." };
  }
}

/** 월드를 백업 zip 으로 저장한다. (BlockCanvasLink /api/world/backup) → 절대경로 + zip 크기 반환. */
export async function backupMinecraftWorld(
  folder: string
): Promise<{ success: boolean; status: number; backupPath?: string; zipBytes?: number; error?: string }> {
  const res = await sendToMinecraft("/api/world/backup", { folder }, HEAVY_OP_TIMEOUT_MS);
  if (!res.success) {
    let error = res.message;
    try { const p = JSON.parse(res.message); if (p?.error) error = p.error; } catch { /* plain */ }
    return { success: false, status: res.status, error };
  }
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      backupPath: typeof p.backup_path === "string" ? p.backup_path : undefined,
      zipBytes: typeof p.zip_bytes === "number" ? p.zip_bytes : 0,
    };
  } catch {
    return { success: false, status: 502, error: "Invalid JSON from Minecraft server." };
  }
}

/** 월드를 서버에서 제거한다(언로드 + 폴더 삭제). (BlockCanvasLink /api/world/delete) */
export async function deleteMinecraftWorld(
  folder: string
): Promise<{ success: boolean; status: number; error?: string }> {
  const res = await sendToMinecraft("/api/world/delete", { folder }, HEAVY_OP_TIMEOUT_MS);
  if (!res.success) {
    let error = res.message;
    try { const p = JSON.parse(res.message); if (p?.error) error = p.error; } catch { /* plain */ }
    return { success: false, status: res.status, error };
  }
  return { success: true, status: res.status };
}

/** 온라인 플레이어에게 인게임 알림 메시지를 보낸다. (BlockCanvasLink /api/world/notify) — 오프라인이면 online=false. */
export async function notifyMinecraftPlayer(
  uuid: string,
  message: string
): Promise<{ success: boolean; online?: boolean }> {
  const res = await sendToMinecraft("/api/world/notify", { uuid, message });
  if (!res.success) return { success: false };
  try {
    const p = JSON.parse(res.message);
    return { success: true, online: !!p.online };
  } catch {
    return { success: true };
  }
}

/**
 * 월드 편집 권한(소유자+초대자 uuid 목록)을 플러그인에 동기화. (BlockCanvasLink /api/world/access) 인게임 빌드 보호가 참조.
 * owner = 소유자 마크 uuid(선택) — 편집자 집합과 별개로 소유자 1명을 기록해 '소유자 전용' 동작(/setworldspawn)을 게이트한다.
 * owner 미지정/null 이면 플러그인은 해당 월드의 소유자 정보를 해제한다(소유 불명 = 소유자 전용 동작 거부).
 */
export async function setMinecraftWorldAccess(
  folder: string,
  editors: string[],
  owner?: string | null
): Promise<{ success: boolean; status: number }> {
  const res = await sendToMinecraft("/api/world/access", { folder, editors, owner: owner ?? null });
  return { success: res.success, status: res.status };
}

/** 웹 role 변경을 인게임 LuckPerms 그룹에 반영(웹→인게임). (BlockCanvasLink /api/luckperms/set-group) */
export async function setMinecraftLuckPermsGroup(
  uuid: string,
  group: string
): Promise<{ success: boolean; status: number }> {
  const res = await sendToMinecraft("/api/luckperms/set-group", { uuid, group });
  return { success: res.success, status: res.status };
}

/** 서버에서 월드 런타임 정보를 조회한다. (BlockCanvasLink /api/world/info) */
export async function getMinecraftWorldInfo(
  worldName: string
): Promise<{
  success: boolean;
  status: number;
  exists?: boolean;
  loaded?: boolean;
  sizeBytes?: number;
  border?: number;
  version?: string;
  difficulty?: string;
  randomTickSpeed?: number;
  explosionBlocked?: boolean;
  gamerules?: Record<string, boolean>;
}> {
  const res = await sendToMinecraft("/api/world/info", { world_name: worldName });
  if (!res.success) return { success: false, status: res.status };
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      exists: !!p.exists,
      loaded: !!p.loaded,
      sizeBytes: typeof p.size_bytes === "number" ? p.size_bytes : 0,
      border: typeof p.border === "number" ? p.border : undefined,
      version: typeof p.version === "string" ? p.version : undefined,
      difficulty: typeof p.difficulty === "string" ? p.difficulty : undefined,
      randomTickSpeed: typeof p.randomTickSpeed === "number" ? p.randomTickSpeed : undefined,
      explosionBlocked: typeof p.explosionBlocked === "boolean" ? p.explosionBlocked : undefined,
      gamerules: p.gamerules && typeof p.gamerules === "object" ? p.gamerules : undefined,
    };
  } catch {
    return { success: false, status: 502 };
  }
}

/**
 * 월드 게임룰을 변경한다. (BlockCanvasLink /api/world/gamerule)
 * 성공 시 서버가 변경 후 전체 게임룰 스냅샷({ gamerules })을 돌려준다.
 */
export async function setMinecraftWorldGamerule(
  worldName: string,
  rule: string,
  value: boolean
): Promise<{ success: boolean; status: number; gamerules?: Record<string, boolean>; error?: string }> {
  const res = await sendToMinecraft("/api/world/gamerule", { world_name: worldName, rule, value });
  if (!res.success) {
    let error = res.message;
    try {
      const p = JSON.parse(res.message);
      if (p?.error) error = p.error;
    } catch { /* plain text body */ }
    return { success: false, status: res.status, error };
  }
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      gamerules: p.gamerules && typeof p.gamerules === "object" ? p.gamerules : undefined,
    };
  } catch {
    return { success: false, status: 502, error: "Invalid JSON from Minecraft server." };
  }
}

/**
 * 게임룰이 아닌 월드 설정 변경. (BlockCanvasLink /api/world/setting)
 * key: difficulty(string) | randomTickSpeed(number) | explosionBlocked(boolean). 변경 후 스냅샷 반환.
 */
export async function setMinecraftWorldSetting(
  folder: string,
  key: string,
  value: string | number | boolean
): Promise<{ success: boolean; status: number; difficulty?: string; randomTickSpeed?: number; explosionBlocked?: boolean; gamemode?: string; error?: string }> {
  const res = await sendToMinecraft("/api/world/setting", { folder, key, value });
  if (!res.success) {
    let error = res.message;
    try { const p = JSON.parse(res.message); if (p?.error) error = p.error; } catch { /* plain */ }
    return { success: false, status: res.status, error };
  }
  try {
    const p = JSON.parse(res.message);
    return {
      success: true,
      status: res.status,
      difficulty: typeof p.difficulty === "string" ? p.difficulty : undefined,
      randomTickSpeed: typeof p.randomTickSpeed === "number" ? p.randomTickSpeed : undefined,
      explosionBlocked: typeof p.explosionBlocked === "boolean" ? p.explosionBlocked : undefined,
      gamemode: typeof p.gamemode === "string" ? p.gamemode : undefined,
    };
  } catch {
    return { success: false, status: 502, error: "Invalid JSON from Minecraft server." };
  }
}

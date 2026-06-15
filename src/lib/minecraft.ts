import crypto from "crypto";

const API_URL = process.env.MINECRAFT_API_URL || "http://localhost:25580";
const API_SECRET = process.env.MINECRAFT_API_SECRET || "blockcanvas-super-secret-key";

// 기본(공개) 시크릿을 그대로 쓰면 HMAC 보호가 사실상 무력화된다. 운영에서는 절대 금지.
if (API_SECRET === "blockcanvas-super-secret-key") {
  console.warn(
    "[minecraft] MINECRAFT_API_SECRET 이 기본값입니다 — .env 에 강력한 무작위 키를 설정하세요. " +
      "(기본값 사용 시 HMAC 위변조 방어가 무력화됩니다)"
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

/**
 * 인게임(Spigot)에서 들어오는 요청의 HMAC-SHA256 서명 + 타임스탬프를 검증한다.
 * link / sync 등 모든 인바운드 라우트가 공유한다.
 */
export function verifyInboundSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): boolean {
  if (!signature || !timestamp) return false;

  // 리플레이 공격 방지 (±5분 초과 거부)
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(requestTime) || Math.abs(currentTime - requestTime) > 300) {
    return false;
  }

  const computed = crypto
    .createHmac("sha256", API_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // 타이밍 공격 방지
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

/**
 * 마인크래프트 Spigot API 로 HMAC 서명된 POST 요청을 전송한다.
 * MC 서버 응답 지연 시 서버 액션이 무한 대기하지 않도록 타임아웃(8s)을 건다.
 */
async function sendToMinecraft(
  endpoint: string,
  payload: object
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
      signal: AbortSignal.timeout(8000),
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

/** 플롯에 플레이어를 trust(영구 건축 권한) 추가. */
export async function trustPlayerOnPlot(plotId: string, playerName: string) {
  return sendToMinecraft("/api/plot/trust", { plot_id: plotId, player_name: playerName });
}

/** 플롯에서 플레이어 trust 회수. */
export async function untrustPlayerOnPlot(plotId: string, playerName: string) {
  return sendToMinecraft("/api/plot/untrust", { plot_id: plotId, player_name: playerName });
}

/** 플롯 소유권 양도 예약(실제 변경은 인게임 /웹연동 수락 으로 완료).
 *  requesterUuid: 신청자의 마크 UUID — 마크 서버가 "현재 소유자 == 신청자"를 검증하는 데 사용. */
export async function transferPlotOwnership(plotId: string, targetName: string, requesterUuid: string) {
  return sendToMinecraft("/api/plot/transfer", {
    plot_id: plotId,
    target_name: targetName,
    requester_uuid: requesterUuid,
  });
}

export interface PlotMember {
  uuid: string;
  name: string;
}

export interface MinecraftPlotDto {
  id: string;
  world: string;
  alias: string;
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
      members: normalizeMembers(p.members),
      trusted: normalizeMembers(p.trusted),
    }));
    return { success: true, status: res.status, plots };
  } catch {
    return { success: false, status: 502, plots: [], message: "Invalid JSON from Minecraft server." };
  }
}

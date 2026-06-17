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
  border: number = 3000
): Promise<{ success: boolean; status: number; folder?: string; sizeBytes?: number; version?: string; error?: string }> {
  const res = await sendToMinecraft("/api/world/create", {
    world_name: worldName,
    generator: generator === "wild" ? "wild" : "flat",
    border,
  });
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
  if (/unzip_failed/i.test(s)) return "압축 해제에 실패했습니다. 손상되지 않은 .zip 월드 파일인지 확인해 주세요.";
  if (/world_exists/i.test(s)) return "같은 이름의 월드가 서버에 이미 있습니다.";
  if (/zip not found/i.test(s)) return "업로드 파일을 찾을 수 없습니다. 다시 시도해 주세요.";
  if (/load_failed|move_failed/i.test(s)) return "월드를 서버에 올리지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return s;
}

export async function importMinecraftWorld(
  folder: string,
  zipPath: string,
  border: number = 3000
): Promise<{ success: boolean; status: number; sizeBytes?: number; version?: string; error?: string }> {
  const res = await sendToMinecraft("/api/world/import", { folder, zip_path: zipPath, border });
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
  const res = await sendToMinecraft("/api/world/backup", { folder });
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
  const res = await sendToMinecraft("/api/world/delete", { folder });
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

/** 월드 편집 권한(소유자+초대자 uuid 목록)을 플러그인에 동기화. (BlockCanvasLink /api/world/access) 인게임 빌드 보호가 참조. */
export async function setMinecraftWorldAccess(
  folder: string,
  editors: string[]
): Promise<{ success: boolean; status: number }> {
  const res = await sendToMinecraft("/api/world/access", { folder, editors });
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

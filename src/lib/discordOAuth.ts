// Discord OAuth2 (identify scope) — 웹 연동 센터용.
// 봇과 동일한 Discord 애플리케이션의 client_id/secret 을 사용한다(봇은 토큰, 웹은 OAuth secret).

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";
const SCOPE = "identify";

export function getClientId(): string {
  return process.env.DISCORD_CLIENT_ID || "";
}
function getClientSecret(): string {
  return process.env.DISCORD_CLIENT_SECRET || "";
}
export function getRedirectUri(): string {
  return process.env.DISCORD_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/discord/callback";
}
export function isDiscordOAuthConfigured(): boolean {
  return !!getClientId() && !!getClientSecret();
}

/** Discord 동의 화면 URL 구성. */
export function buildDiscordAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
    prompt: "consent",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface DiscordIdentity {
  id: string;
  username: string;
}

/**
 * 길드 게이트 활성 여부 — 웹 프로세스에 봇 토큰 + 대상 길드 ID 가 모두 설정돼 있어야 켜진다.
 * 미설정 환경(개발/게이트 미도입)에서는 게이트를 건너뛰어(연동 기존 동작 유지) 배포 회귀를 막는다.
 */
export function isGuildGateEnabled(): boolean {
  return !!process.env.DISCORD_BOT_TOKEN && !!process.env.DISCORD_GUILD_ID;
}

/**
 * 봇 토큰으로 대상 유저가 우리 Discord 길드(서버)의 현재 멤버인지 확인한다.
 *  - 200 → 멤버(true), 404 → 비멤버(false).
 *  - 그 외(레이트리밋 429·네트워크·미설정 등) → throw. 호출부는 **fail-closed**(연동 거부/보류)로 처리해
 *    조회 장애를 우회 수단으로 악용하지 못하게 한다(blocklist strict 와 동일 철학).
 * ⚠ REST 조회라 봇의 GuildMembers **게이트웨이 인텐트와 무관**하게 동작한다(봇이 길드에 있고
 *    멤버를 조회할 수 있으면 됨). 인텐트는 실시간 이탈 이벤트(GuildMemberRemove)에만 필요하다.
 */
export async function isDiscordGuildMember(discordUserId: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID || "";
  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  if (!guildId || !botToken) {
    throw new Error("DISCORD_GUILD_ID / DISCORD_BOT_TOKEN 미설정 — 길드 멤버십을 확인할 수 없습니다.");
  }
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(discordUserId)}`, {
    headers: { Authorization: `Bot ${botToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`Discord 길드 멤버 조회 실패 (${res.status})`);
}

/** authorization code → Discord 사용자 신원(id, username). 실패 시 throw. */
export async function exchangeCodeForDiscordIdentity(code: string, redirectUri: string): Promise<DiscordIdentity> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) throw new Error(`Discord 토큰 교환 실패 (${tokenRes.status})`);
  const accessToken = (await tokenRes.json())?.access_token as string | undefined;
  if (!accessToken) throw new Error("Discord access token 을 받지 못했습니다.");

  const userRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!userRes.ok) throw new Error(`Discord 사용자 조회 실패 (${userRes.status})`);
  const user = await userRes.json();
  if (!user?.id) throw new Error("Discord 사용자 응답이 올바르지 않습니다.");

  // discord_username 에는 '아이디(핸들, 예: rain7857)' = user.username 을 저장한다.
  // user.global_name 은 자유 표시이름(닉네임)이라 핸들과 다를 수 있어 우선순위에서 뒤로 둔다.
  return { id: String(user.id), username: String(user.username || user.global_name || user.id) };
}

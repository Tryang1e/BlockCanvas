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

  return { id: String(user.id), username: String(user.global_name || user.username || user.id) };
}

// Microsoft → Xbox Live → Minecraft 인증 흐름 (자체 구현, minecraftauth.me 의존 X)
// 참고: https://minecraft.wiki/w/Microsoft_authentication, https://wiki.vg/Microsoft_Authentication_Scheme

const AUTHORIZE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";
const SCOPE = "XboxLive.signin offline_access";

export function getClientId(): string {
  return process.env.AZURE_CLIENT_ID || "";
}
function getClientSecret(): string {
  return process.env.AZURE_CLIENT_SECRET || "";
}
export function getRedirectUri(): string {
  return process.env.MINECRAFT_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/minecraft/callback";
}
export function isOAuthConfigured(): boolean {
  return !!getClientId() && !!getClientSecret();
}

/** 동의 화면으로 보낼 Microsoft authorize URL 을 구성한다. */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
    response_mode: "query",
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface MinecraftIdentity {
  uuid: string;
  username: string;
}

/** 32자리 무대시 UUID 를 8-4-4-4-12 형식으로 변환(플러그인이 보내는 형식과 일치시킴). */
function dashifyUuid(id: string): string {
  if (id.includes("-")) return id;
  return id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}

/**
 * authorization code 를 받아 전체 인증 흐름을 수행하고 검증된 마크 UUID/닉네임을 반환한다.
 * 실패 시 사용자에게 보여줄 메시지를 담은 Error 를 throw 한다.
 */
export async function exchangeCodeForIdentity(code: string, redirectUri: string): Promise<MinecraftIdentity> {
  // 1) authorization code → Microsoft access token
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      scope: SCOPE,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) {
    throw new Error(`Microsoft 토큰 교환 실패 (${tokenRes.status})`);
  }
  const msToken = (await tokenRes.json())?.access_token as string | undefined;
  if (!msToken) throw new Error("Microsoft 응답에 access_token 이 없습니다.");

  // 2) Microsoft token → Xbox Live token
  const xblRes = await postJson(XBL_URL, {
    Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msToken}` },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  });
  if (!xblRes.ok) throw new Error(`Xbox Live 인증 실패 (${xblRes.status})`);
  const xbl = await xblRes.json();
  const xblToken: string | undefined = xbl?.Token;
  const userHash: string | undefined = xbl?.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !userHash) throw new Error("Xbox Live 응답이 올바르지 않습니다.");

  // 3) Xbox Live token → XSTS token
  const xstsRes = await postJson(XSTS_URL, {
    Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT",
  });
  if (xstsRes.status === 401) {
    const err = await xstsRes.json().catch(() => ({}));
    throw new Error(`XSTS 인증 실패 (XErr: ${err?.XErr ?? "unknown"}). 이 Microsoft 계정에 Xbox 프로필이 없을 수 있습니다.`);
  }
  if (!xstsRes.ok) throw new Error(`XSTS 인증 실패 (${xstsRes.status})`);
  const xstsToken: string | undefined = (await xstsRes.json())?.Token;
  if (!xstsToken) throw new Error("XSTS 응답이 올바르지 않습니다.");

  // 4) XSTS token → Minecraft access token
  const mcRes = await postJson(MC_LOGIN_URL, {
    identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
  });
  if (!mcRes.ok) throw new Error(`Minecraft 로그인 실패 (${mcRes.status})`);
  const mcToken = (await mcRes.json())?.access_token as string | undefined;
  if (!mcToken) throw new Error("Minecraft access token 을 받지 못했습니다.");

  // 5) Minecraft profile (UUID + username) — 미소유 시 404
  const profRes = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (profRes.status === 404) {
    throw new Error("이 계정은 Minecraft Java 에디션을 소유하고 있지 않습니다.");
  }
  if (!profRes.ok) throw new Error(`Minecraft 프로필 조회 실패 (${profRes.status})`);
  const profile = await profRes.json();
  if (!profile?.id || !profile?.name) throw new Error("Minecraft 프로필 응답이 올바르지 않습니다.");

  return { uuid: dashifyUuid(String(profile.id)), username: String(profile.name) };
}

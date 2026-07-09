// Patreon OAuth2 (identity + identity.memberships) — 웹 후원 연동/구독 부여용.
// Patreon 개발자 포털(Clients & API Keys)에서 발급한 Client ID/Secret 을 사용한다.
//
// ⚠ 보안 핵심(적대적 리뷰로 확증, docs.patreon.com 대조): identity.memberships 스코프가 있으면 identity 응답은
//   "우리 캠페인"이 아니라 "사용자가 후원하는 '모든' 캠페인"의 멤버십을 돌려준다. 따라서 캠페인 필터 없이
//   아무 active_patron 이나 활성 후원자로 판정하면, 우리와 무관한 타 크리에이터 후원자에게까지 무료 구독이 열린다.
//   → 반드시 각 멤버십의 relationships.campaign.data.id 를 우리 캠페인(PATREON_CAMPAIGN_ID)과 대조해야 한다.
//   PATREON_CAMPAIGN_ID 가 없으면 fail-closed(아무도 활성 후원자로 판정하지 않음).

const AUTHORIZE_URL = "https://www.patreon.com/oauth2/authorize";
const TOKEN_URL = "https://www.patreon.com/api/oauth2/token";
const IDENTITY_URL = "https://www.patreon.com/api/oauth2/v2/identity";
// identity = 본인 신원, identity.memberships = 이 사용자의 (모든 캠페인) 멤버십 — 캠페인 필터는 아래에서 직접 한다.
const SCOPE = "identity identity.memberships";

export function getClientId(): string {
  return process.env.PATREON_CLIENT_ID || "";
}
function getClientSecret(): string {
  return process.env.PATREON_CLIENT_SECRET || "";
}
/** 우리 캠페인 id — 활성 후원자 판정의 유일한 기준. 미설정 시 후원 판정 fail-closed. */
export function getCampaignId(): string {
  return process.env.PATREON_CAMPAIGN_ID || "";
}
export function getRedirectUri(): string {
  return process.env.PATREON_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/patreon/callback";
}
export function isPatreonOAuthConfigured(): boolean {
  return !!getClientId() && !!getClientSecret();
}

/** Patreon 동의 화면 URL 구성. */
export function buildPatreonAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface PatreonMembership {
  userId: string; // Patreon user id (계정 매핑 키)
  fullName: string; // 표시 이름(연동 카드용)
  isActivePatron: boolean; // patron_status === "active_patron"
  entitledCents: number; // 현재 유효 후원 금액(센트). 등급 차등 확장 시 사용.
}

/**
 * authorization code → Patreon 사용자 신원 + 우리 캠페인 후원 상태. 실패 시 throw.
 * memberships 는 우리 클라이언트(캠페인) 기준으로만 회신되므로, active_patron 멤버를 찾으면
 * 그 사용자는 우리 캠페인의 활성 후원자다.
 */
export async function exchangeCodeForPatreonMembership(code: string, redirectUri: string): Promise<PatreonMembership> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) throw new Error(`Patreon 토큰 교환 실패 (${tokenRes.status})`);
  const accessToken = (await tokenRes.json())?.access_token as string | undefined;
  if (!accessToken) throw new Error("Patreon access token 을 받지 못했습니다.");

  // identity + 멤버십 + 각 멤버십의 캠페인(우리 캠페인 대조용). full_name·patron_status·후원액 + 캠페인 관계.
  // include=memberships.campaign 으로 member 의 relationships.campaign.data.id 가 채워진다.
  // (sparse fieldset 은 attribute 만 제한하고 relationship 은 유지되므로 fields[member] 로 campaign 이 사라지지 않는다.)
  const identityUrl = new URL(IDENTITY_URL);
  identityUrl.searchParams.set("include", "memberships.campaign");
  identityUrl.searchParams.set("fields[user]", "full_name");
  identityUrl.searchParams.set("fields[member]", "patron_status,currently_entitled_amount_cents");
  // 캠페인은 member.relationships.campaign.data.id(관계 링크)만 쓰므로 fields[campaign] 은 지정하지 않는다
  // (빈 sparse fieldset 이 거부될 미세 위험 회피 — 사이드로드되는 campaign attribute 는 무시).

  const idRes = await fetch(identityUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!idRes.ok) throw new Error(`Patreon 신원 조회 실패 (${idRes.status})`);
  const body = await idRes.json();

  const userId = body?.data?.id;
  if (!userId) throw new Error("Patreon 사용자 응답이 올바르지 않습니다.");
  const fullName = String(body?.data?.attributes?.full_name || "Patreon 후원자");

  // included 의 member 객체들 중 "우리 캠페인" 활성 후원자만 인정한다(보통 0~1개).
  // ⚠ 반드시 relationships.campaign.data.id 를 우리 캠페인과 대조 — 타 캠페인 후원자에게 구독이 새지 않도록.
  const campaignId = getCampaignId();
  const included: unknown[] = Array.isArray(body?.included) ? body.included : [];
  let isActivePatron = false;
  let entitledCents = 0;
  if (!campaignId) {
    // fail-closed: 우리 캠페인 id 를 모르면 누구도 활성 후원자로 판정하지 않는다(무료 구독 유출 원천 차단).
    console.warn("[patreon] PATREON_CAMPAIGN_ID 미설정 — 후원자 구독 부여가 비활성화됩니다(fail-closed). 캠페인 id 를 설정하세요.");
  } else {
    for (const item of included) {
      const m = item as {
        type?: string;
        attributes?: { patron_status?: string; currently_entitled_amount_cents?: number };
        relationships?: { campaign?: { data?: { id?: string } } };
      };
      if (m?.type !== "member") continue;
      // 이 멤버십이 속한 캠페인이 우리 캠페인이 아니면 무시(타 크리에이터 후원 → 우리 혜택 대상 아님).
      if (m.relationships?.campaign?.data?.id !== campaignId) continue;
      if (m.attributes?.patron_status === "active_patron") {
        isActivePatron = true;
        const cents = Number(m.attributes?.currently_entitled_amount_cents ?? 0);
        if (Number.isFinite(cents) && cents > entitledCents) entitledCents = cents;
      }
    }
  }

  return { userId: String(userId), fullName, isActivePatron, entitledCents };
}

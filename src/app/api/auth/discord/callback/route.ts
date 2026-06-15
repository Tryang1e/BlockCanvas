import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForDiscordIdentity } from "@/lib/discordOAuth";
import { linkProviderToHub } from "@/lib/hub";
import { signHubSession, verifyHubSession, HUB_COOKIE } from "@/lib/hubSession";
import { oauthRedirectUri, publicUrl } from "@/lib/publicUrl";

/** GET /api/auth/discord/callback — 허브 Discord 로그인/연결 완료. */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const savedState = cookieStore.get("dc_oauth_state")?.value;

  const hub = (q: string) => publicUrl(req, `/auth${q}`);
  const clear = (res: NextResponse) => {
    res.cookies.set("dc_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (oauthError) return clear(NextResponse.redirect(hub(`?error=${encodeURIComponent(oauthError)}`)));
  if (!code || !state || !savedState || state !== savedState) {
    return clear(NextResponse.redirect(hub("?error=invalid_state")));
  }

  try {
    const redirectUri = oauthRedirectUri(req, "/api/auth/discord/callback");
    const identity = await exchangeCodeForDiscordIdentity(code, redirectUri);
    const currentHub = verifyHubSession(cookieStore.get(HUB_COOKIE)?.value);
    const r = await linkProviderToHub({
      currentLinkedAccountId: currentHub,
      provider: "discord",
      id: identity.id,
      username: identity.username,
    });
    if (!r.ok || !r.linkedAccountId) {
      return clear(NextResponse.redirect(hub(`?error=${encodeURIComponent(r.error || "link_failed")}`)));
    }
    const res = clear(NextResponse.redirect(hub("?connected=discord")));
    res.cookies.set(HUB_COOKIE, signHubSession(r.linkedAccountId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (error: unknown) {
    console.error("Discord hub callback error:", error instanceof Error ? error.message : String(error));
    return clear(NextResponse.redirect(hub("?error=oauth_failed")));
  }
}

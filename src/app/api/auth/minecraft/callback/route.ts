import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { exchangeCodeForIdentity } from "@/lib/minecraftOAuth";
import { linkProviderToHub, syncBridgeFromProfile } from "@/lib/hub";
import { signHubSession, verifyHubSession, HUB_COOKIE } from "@/lib/hubSession";
import { oauthRedirectUri, publicUrl, cookieDomain } from "@/lib/publicUrl";

/**
 * GET /api/auth/minecraft/callback
 * mc_flow 쿠키로 분기: hub(허브 LinkedAccount+세션) / link(크리에이터 Profile).
 * redirect_uri / 리다이렉트 대상 모두 공개 호스트 기준(터널 대응).
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const savedState = cookieStore.get("mc_oauth_state")?.value;
  const flow = cookieStore.get("mc_flow")?.value === "hub" ? "hub" : "link";
  const redirectUri = oauthRedirectUri(req, "/api/auth/minecraft/callback");

  const clear = (res: NextResponse) => {
    res.cookies.set("mc_oauth_state", "", { maxAge: 0, path: "/" });
    res.cookies.set("mc_flow", "", { maxAge: 0, path: "/" });
    return res;
  };

  // ===== HUB FLOW =====
  if (flow === "hub") {
    const hub = (q: string) => publicUrl(req, `/auth${q}`);
    if (oauthError) return clear(NextResponse.redirect(hub(`?error=${encodeURIComponent(oauthError)}`)));
    if (!code || !state || !savedState || state !== savedState) {
      return clear(NextResponse.redirect(hub("?error=invalid_state")));
    }
    try {
      const identity = await exchangeCodeForIdentity(code, redirectUri);
      const currentHub = verifyHubSession(cookieStore.get(HUB_COOKIE)?.value);
      const r = await linkProviderToHub({
        currentLinkedAccountId: currentHub,
        provider: "minecraft",
        id: identity.uuid,
        username: identity.username,
      });
      if (!r.ok || !r.linkedAccountId) {
        return clear(NextResponse.redirect(hub(`?error=${encodeURIComponent(r.error || "link_failed")}`)));
      }
      const res = clear(NextResponse.redirect(hub("?connected=minecraft")));
      res.cookies.set(HUB_COOKIE, signHubSession(r.linkedAccountId), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        domain: cookieDomain(req),
      });
      return res;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Minecraft hub callback error:", msg);
      return clear(NextResponse.redirect(hub(`?error=oauth_failed&detail=${encodeURIComponent(msg.slice(0, 200))}`)));
    }
  }

  // ===== CREATOR DASHBOARD LINK FLOW =====
  const creatorName = verifySession(cookieStore.get("session")?.value);
  if (!creatorName) return clear(NextResponse.redirect(publicUrl(req, "/")));

  const accountUrl = (params: Record<string, string>) => {
    const u = publicUrl(req, `/sites/${creatorName}/dashboard/account`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u;
  };

  if (oauthError) return clear(NextResponse.redirect(accountUrl({ mc_error: oauthError })));
  if (!code || !state || !savedState || state !== savedState) {
    return clear(NextResponse.redirect(accountUrl({ mc_error: "invalid_state" })));
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { creator_name: creatorName.toLowerCase() } });
    if (!profile) return clear(NextResponse.redirect(publicUrl(req, "/")));

    const identity = await exchangeCodeForIdentity(code, redirectUri);
    const existing = await prisma.profile.findUnique({ where: { minecraft_uuid: identity.uuid } });
    if (existing && existing.id !== profile.id) {
      return clear(NextResponse.redirect(accountUrl({ mc_error: "already_linked" })));
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { minecraft_uuid: identity.uuid, minecraft_username: identity.username },
    });
    await syncBridgeFromProfile(profile.id); // 브리지된 허브 계정에 미러링
    return clear(NextResponse.redirect(accountUrl({ mc_linked: "1" })));
  } catch (error: unknown) {
    console.error("Minecraft OAuth callback error:", error instanceof Error ? error.message : String(error));
    return clear(NextResponse.redirect(accountUrl({ mc_error: "oauth_failed" })));
  }
}

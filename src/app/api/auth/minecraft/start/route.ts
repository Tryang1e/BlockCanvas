import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { buildAuthorizeUrl, isOAuthConfigured } from "@/lib/minecraftOAuth";
import { oauthRedirectUri, publicUrl } from "@/lib/publicUrl";

/**
 * GET /api/auth/minecraft/start
 *  - 기본(flow=link): 로그인된 크리에이터가 대시보드에서 마크 계정 연동.
 *  - flow=hub: 연동 허브의 Minecraft 로그인/연결(크리에이터 세션 불필요).
 * redirect_uri 는 요청의 공개 호스트에서 동적 생성(터널 대응).
 */
export async function GET(req: NextRequest) {
  const flow = new URL(req.url).searchParams.get("flow") === "hub" ? "hub" : "link";
  const cookieStore = await cookies();

  if (flow === "link") {
    const creatorName = verifySession(cookieStore.get("session")?.value);
    if (!creatorName) return NextResponse.redirect(publicUrl(req, "/"));
    if (!isOAuthConfigured()) {
      return NextResponse.redirect(publicUrl(req, `/sites/${creatorName}/dashboard/account?mc_error=oauth_not_configured`));
    }
  } else if (!isOAuthConfigured()) {
    return NextResponse.redirect(publicUrl(req, "/auth?error=oauth_not_configured"));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = oauthRedirectUri(req, "/api/auth/minecraft/callback");
  const res = NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  };
  res.cookies.set("mc_oauth_state", state, opts);
  res.cookies.set("mc_flow", flow, opts);
  return res;
}

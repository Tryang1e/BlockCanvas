import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { buildAuthorizeUrl, isOAuthConfigured } from "@/lib/minecraftOAuth";
import { oauthRedirectUri, publicUrl, creatorUrl } from "@/lib/publicUrl";

/**
 * GET /api/auth/minecraft/start
 * 로그인된 크리에이터가 대시보드/허브에서 마크(정품) 계정을 연동한다(결과를 본인 Profile 에 붙인다).
 * 중앙화: 대시보드/허브 버튼이 단일 호스트(auth.<base>)로 보내므로 redirect_uri 도 단일(Azure 등록 1개).
 * redirect_uri 는 요청의 공개 호스트에서 동적 생성(터널 대응).
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();

  const creatorName = verifySession(cookieStore.get("session")?.value);
  if (!creatorName) return NextResponse.redirect(publicUrl(req, "/"));
  if (!isOAuthConfigured()) {
    return NextResponse.redirect(creatorUrl(req, creatorName, `/dashboard/connections?mc_error=oauth_not_configured`));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = oauthRedirectUri(req, "/api/auth/minecraft/callback");
  const res = NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
  res.cookies.set("mc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}

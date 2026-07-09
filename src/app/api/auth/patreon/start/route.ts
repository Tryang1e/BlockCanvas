import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildPatreonAuthorizeUrl, isPatreonOAuthConfigured } from "@/lib/patreonOAuth";
import { oauthRedirectUri, publicUrl } from "@/lib/publicUrl";

/** GET /api/auth/patreon/start — 허브 Patreon 후원 연결 시작. */
export async function GET(req: NextRequest) {
  if (!isPatreonOAuthConfigured()) {
    return NextResponse.redirect(publicUrl(req, "/auth?error=patreon_not_configured"));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = oauthRedirectUri(req, "/api/auth/patreon/callback");
  const res = NextResponse.redirect(buildPatreonAuthorizeUrl(state, redirectUri));
  res.cookies.set("pt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}

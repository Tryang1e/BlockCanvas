import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildDiscordAuthorizeUrl, isDiscordOAuthConfigured } from "@/lib/discordOAuth";
import { oauthRedirectUri, publicUrl } from "@/lib/publicUrl";

/** GET /api/auth/discord/start — 허브 Discord 로그인/연결 시작. */
export async function GET(req: NextRequest) {
  if (!isDiscordOAuthConfigured()) {
    return NextResponse.redirect(publicUrl(req, "/auth?error=discord_not_configured"));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = oauthRedirectUri(req, "/api/auth/discord/callback");
  const res = NextResponse.redirect(buildDiscordAuthorizeUrl(state, redirectUri));
  res.cookies.set("dc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}

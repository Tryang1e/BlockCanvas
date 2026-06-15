import { NextRequest, NextResponse } from "next/server";
import { HUB_COOKIE } from "@/lib/hubSession";
import { cookieDomain } from "@/lib/publicUrl";

/** GET /api/auth/hub/logout — 허브 세션 종료. */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/auth", req.url));
  res.cookies.set(HUB_COOKIE, "", { maxAge: 0, path: "/", domain: cookieDomain(req) });
  return res;
}

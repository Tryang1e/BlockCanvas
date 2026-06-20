import { NextRequest, NextResponse } from "next/server";
import { HUB_COOKIE } from "@/lib/hubSession";
import { cookieDomain, publicUrl } from "@/lib/publicUrl";

/**
 * GET /api/auth/hub/logout — 허브(=웹 계정) 로그아웃. session 쿠키 제거(+ 레거시 hub_session 정리).
 * 리다이렉트는 공개 오리진(auth.craftopia.work) 기준으로 한다 — req.url 은 터널 뒤 내부 호스트라 사용 금지.
 * 쿠키는 도메인(.craftopia.work)·host-only 양쪽으로 비워 어느 방식으로 설정됐든 확실히 삭제한다.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(publicUrl(req, "/auth"));
  const domain = cookieDomain(req);

  for (const name of ["session", HUB_COOKIE]) {
    // 도메인 쿠키(서브도메인 공유분) 제거
    if (domain) {
      res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; Domain=${domain}; SameSite=Lax`);
    }
    // host-only 쿠키 fallback 제거
    res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; SameSite=Lax`);
  }
  return res;
}

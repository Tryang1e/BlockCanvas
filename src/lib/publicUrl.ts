import type { NextRequest } from "next/server";

/**
 * Cloudflare 터널 등 프록시 뒤에서도 공개(외부) 오리진을 구한다.
 * req.url 은 내부 호스트(localhost)를 가리키므로 x-forwarded-* 를 우선한다.
 */
export function getPublicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");
  return `${proto}://${host}`;
}

/** 공개 오리진 기준 절대 URL. */
export function publicUrl(req: NextRequest, pathWithQuery: string): URL {
  return new URL(pathWithQuery, getPublicOrigin(req));
}

/** OAuth redirect_uri (콜백 절대 URL) — 현재 요청의 공개 호스트 기준. */
export function oauthRedirectUri(req: NextRequest, callbackPath: string): string {
  return `${getPublicOrigin(req)}${callbackPath}`;
}

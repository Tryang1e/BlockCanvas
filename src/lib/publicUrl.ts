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

/**
 * 세션 쿠키 도메인 — 서브도메인 간 공유용(auth.* ↔ {creator}.*).
 * 공개 호스트(x-forwarded-host) 기준으로 판단해 순수 localhost 면 undefined(host-only)로 둬 dev 를 깨지 않는다.
 * 크리에이터 세션(actions/auth.ts getDynamicConfig)과 동일 규칙으로 허브 세션도 .craftopia.work 공유.
 */
export function cookieDomain(req: NextRequest): string | undefined {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  return isLocal ? undefined : ".craftopia.work";
}

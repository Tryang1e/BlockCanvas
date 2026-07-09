import type { NextRequest } from "next/server";

/**
 * Cloudflare 터널 등 프록시 뒤에서도 공개(외부) 오리진을 구한다.
 * req.url 은 내부 호스트(localhost)를 가리키므로 x-forwarded-* 를 우선한다.
 */
export function getPublicOrigin(req: NextRequest): string {
  const host = publicHost(req);
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
  const host = publicHost(req);
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  return isLocal ? undefined : ".craftopia.work";
}

// 공개 베이스 도메인(허용 호스트 판정 기준). 프록시/터널이 넘기는 x-forwarded-host 를 이 목록으로 검증한다.
const CANONICAL_BASE = (process.env.PUBLIC_BASE_DOMAIN || "craftopia.work").toLowerCase();

/** 허용 호스트: localhost 계열 · <base> · *.<base>. 그 외(위조 x-forwarded-host)는 거부. */
function isAllowedHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  const bare = h.split(":")[0];
  if (bare === "localhost" || bare === "127.0.0.1" || bare.endsWith(".localhost")) return true;
  return h === CANONICAL_BASE || h.endsWith("." + CANONICAL_BASE);
}

/**
 * 공개 호스트 — x-forwarded-host(프록시) 우선, 단 허용 목록으로 검증한다.
 * 위조된 x-forwarded-host(예: evil.example)는 무시하고 canonical 베이스로 폴백해
 * 오픈리다이렉트/OAuth redirect_uri 하이재킹/쿠키 도메인 오염을 차단한다.
 */
function publicHost(req: NextRequest): string {
  const xfh = req.headers.get("x-forwarded-host");
  if (isAllowedHost(xfh)) return xfh as string;
  const host = req.headers.get("host");
  if (isAllowedHost(host)) return host as string;
  const nextHost = req.nextUrl.host;
  if (isAllowedHost(nextHost)) return nextHost;
  return CANONICAL_BASE; // 어느 것도 허용 목록에 없으면 안전한 canonical 로 폴백
}
function publicProto(req: NextRequest): string {
  return req.headers.get("x-forwarded-proto") || (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");
}

/** 베이스 도메인(끝 2 라벨). localhost 계열은 host(포트 포함) 그대로. */
export function baseDomainOf(req: NextRequest): string {
  const host = publicHost(req);
  if (host.includes("localhost") || host.includes("127.0.0.1")) return host;
  const parts = host.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}

/**
 * 중앙화된 마크 OAuth 처리 호스트(허브) 오리진.
 *  - prod: https://auth.<base> (모든 크리에이터가 단일 redirect_uri 를 공유 → Azure 등록 1개)
 *  - localhost: 현재 호스트 그대로(서브도메인 분리 없음 → 동일 호스트라 세션·state 그대로 읽힘)
 */
export function authHubOrigin(req: NextRequest): string {
  const host = publicHost(req);
  const proto = publicProto(req);
  if (host.includes("localhost") || host.includes("127.0.0.1")) return `${proto}://${host}`;
  return `${proto}://auth.${baseDomainOf(req)}`;
}

/** 크리에이터 서브도메인 절대 URL. ({creator}.<base><pathWithQuery>) */
export function creatorUrl(req: NextRequest, creatorName: string, pathWithQuery = "/dashboard"): string {
  return `${publicProto(req)}://${creatorName}.${baseDomainOf(req)}${pathWithQuery}`;
}

/**
 * 메인(루트) 도메인 절대 URL. (<base><pathWithQuery>)
 * auth.* 등 서브도메인에서 처리된 흐름을 메인 도메인의 로그인/가입 페이지로 보낼 때 사용.
 */
export function mainSiteUrl(req: NextRequest, pathWithQuery = "/"): string {
  return `${publicProto(req)}://${baseDomainOf(req)}${pathWithQuery}`;
}

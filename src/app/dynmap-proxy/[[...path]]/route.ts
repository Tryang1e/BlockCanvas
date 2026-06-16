import { NextRequest } from "next/server";

// Dynmap 리버스 프록시 (같은 출처 임베드용). dynmap.craftopia.work 서브도메인 대신
// /dynmap-proxy/* → 로컬 Dynmap(기본 8123) 으로 프록시한다.
// Dynmap 은 자신이 루트(/)에 있다고 가정한 상대경로(js/css/tiles/...)를 쓰므로,
// index HTML 에 <base href="/dynmap-proxy/"> 를 주입해 자산이 프록시 하위로 해석되게 한다.
const DYNMAP = (process.env.DYNMAP_INTERNAL_URL || "http://localhost:8123").replace(/\/$/, "");

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const sub = path && path.length ? path.join("/") : "";
  const target = `${DYNMAP}/${sub}${req.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store", redirect: "follow" });
  } catch (e) {
    return new Response("Dynmap upstream unreachable: " + (e instanceof Error ? e.message : String(e)), {
      status: 502,
    });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const headers = new Headers();
  headers.set("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) headers.set("cache-control", cacheControl);
  // 같은 출처 임베드 허용 (전역 X-Frame-Options: DENY 를 덮음 — next.config 에서 이 경로는 제외됨)
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Content-Security-Policy", "frame-ancestors 'self'");

  if (contentType.includes("text/html")) {
    let html = await upstream.text();
    if (!/<base\s/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="/dynmap-proxy/">`);
    }
    headers.set("cache-control", "no-store"); // base 주입 HTML 캐시 금지(예전 base 없는 버전 stale 방지)
    return new Response(html, { status: upstream.status, headers });
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers });
}

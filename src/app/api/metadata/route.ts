import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import net from 'net';
import { Agent } from 'undici';
import { verifySession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';

// SSRF 방어 설정: 리다이렉트/타임아웃/응답크기 제한
const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 7000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 사설/루프백/링크로컬/예약 대역 IP인지 검사한다.
 * (클라우드 메타데이터 169.254.169.254, 내부망 등 차단)
 */
function ipIsPrivate(ipRaw: string): boolean {
  let ip = ipRaw;
  // IPv4-mapped IPv6 정규화 (예: ::ffff:127.0.0.1)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) ip = mapped[1];

  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0) return true;
    if (p[0] === 10) return true;
    if (p[0] === 127) return true; // loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local (포함: 169.254.169.254)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] >= 224) return true; // multicast/reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback/unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    return false;
  }

  // 형식 불명 -> 안전하지 않은 것으로 간주
  return true;
}

/**
 * 주어진 URL이 공개 인터넷의 http(s) 자원인지 검증하고, **검증에 통과한 공개 IP를 반환**한다.
 * 스킴 위반, 내부 호스트명, 사설 IP로 해석되는 경우 throw.
 * 반환한 IP를 이후 fetch 연결에 고정(pin)해 DNS 리바인딩(검증과 fetch가 서로 다른 IP로 해석되는 TOCTOU)을 막는다.
 */
async function assertPublicUrl(raw: string): Promise<{ address: string; family: number }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }

  const host = u.hostname.replace(/^\[|\]$/g, ''); // IPv6 대괄호 제거
  const lowerHost = host.toLowerCase();

  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local') ||
    lowerHost.endsWith('.internal') ||
    lowerHost === 'metadata.google.internal'
  ) {
    throw new Error('Blocked host');
  }

  // 호스트가 IP 리터럴이면 직접 검사
  if (net.isIP(host)) {
    if (ipIsPrivate(host)) throw new Error('Blocked private IP');
    return { address: host, family: net.isIPv6(host) ? 6 : 4 };
  }

  // 도메인은 DNS 해석 후 모든 주소가 공개 대역인지 확인 (DNS 리바인딩 1차 방어)
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('DNS resolution failed');
  }
  if (!addrs.length) throw new Error('No DNS records');
  for (const a of addrs) {
    if (ipIsPrivate(a.address)) throw new Error('Blocked private IP');
  }
  // 검증된 첫 주소로 연결을 고정한다(모든 주소가 공개임을 확인했으므로 어느 것을 골라도 안전).
  return { address: addrs[0].address, family: addrs[0].family };
}

/**
 * 응답 본문을 상한(maxBytes)까지만 스트리밍으로 읽는다.
 * Content-Length 헤더에 의존하지 않으므로 chunked(transfer-encoding) 응답의 무제한 버퍼링(메모리 DoS)을 막는다.
 */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        chunks.push(Buffer.from(value)); // Uint8Array → 복사(스트림 버퍼 재사용으로부터 안전)
        total += value.byteLength;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8');
}

/**
 * 리다이렉트를 직접 따라가며 매 홉마다 공개 URL 검증을 수행하고, 최종 응답 HTML(상한까지)을 반환한다.
 * - 매 홉의 fetch 를 **검증된 IP로 고정(undici Agent connect.lookup)** 해 리바인딩을 차단한다
 *   (URL 을 IP 로 바꿔치기하지 않으므로 https SNI/인증서 검증은 원래 호스트명으로 정상 수행).
 * - 본문은 스트리밍 상한(readCapped)으로 읽어 chunked 무제한 버퍼링을 막는다.
 */
async function safeFetchHtml(initialUrl: string): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const pin = { address: '', family: 4 };
  const agent = new Agent({
    connect: {
      // 검증된 공개 IP로 DNS 를 고정 — fetch 의 connect 시점 재해석(리바인딩)을 우회한다.
      // undici 는 lookup 을 { all: true } 로 호출하므로 배열 형태로 콜백한다(단일 형태도 함께 방어).
      lookup: (
        _hostname: string,
        opts: { all?: boolean } | undefined,
        cb: (err: Error | null, address: string | { address: string; family: number }[], family?: number) => void,
      ) => {
        if (opts && opts.all) cb(null, [{ address: pin.address, family: pin.family }]);
        else cb(null, pin.address, pin.family);
      },
    },
  });
  try {
    let currentUrl = initialUrl;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const validated = await assertPublicUrl(currentUrl);
      pin.address = validated.address;
      pin.family = validated.family;
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
        dispatcher: agent,
      } as RequestInit & { dispatcher: Agent });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        await res.body?.cancel().catch(() => {});
        if (!loc) return { status: res.status, html: '' };
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        await res.body?.cancel().catch(() => {});
        return { status: res.status, html: '' };
      }
      const html = await readCapped(res, MAX_BODY_BYTES);
      return { status: res.status, html };
    }
    throw new Error('Too many redirects');
  } finally {
    clearTimeout(timeout);
    agent.destroy().catch(() => {});
  }
}

export async function GET(request: Request) {
  // 인증 필수 — 예전엔 무인증 오픈 프록시라 누구나 서버를 임의 HTTP 클라이언트로 악용(SSRF 도달성↑)했다.
  // 링크 프리뷰는 로그인 사용자(콘텐츠 편집)만 필요하므로 세션을 요구하고 사용자별 레이트리밋을 건다.
  const session = verifySession((await cookies()).get('session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`metadata:${session}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    let fetchUrl = url;
    try {
      const urlObj = new URL(url);

      if (urlObj.hostname === 'instagram.com' || urlObj.hostname === 'www.instagram.com') {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && !['p', 'reel', 'explore', 'stories'].includes(pathParts[0])) {
          const username = pathParts[0];
          return NextResponse.json({
            title: `${username} (@${username}) • Instagram photos and videos`,
            description: `View ${username}'s profile on Instagram.`,
            image: `https://unavatar.io/instagram/${username}`,
            favicon: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png',
            url
          });
        } else {
          return NextResponse.json({
            title: 'Instagram',
            description: 'View this post on Instagram',
            image: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png',
            favicon: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png',
            url
          });
        }
      }

      if (urlObj.hostname === 'twitter.com' || urlObj.hostname === 'www.twitter.com' || urlObj.hostname === 'x.com' || urlObj.hostname === 'www.x.com') {
        urlObj.hostname = 'vxtwitter.com';
        fetchUrl = urlObj.toString();
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    // SSRF 방어: 스킴/사설IP 검증 + IP 고정(리바인딩 차단) + 리다이렉트 재검증 + 타임아웃 + 본문 상한
    const { status, html } = await safeFetchHtml(fetchUrl);

    if (status < 200 || status >= 300) {
      throw new Error('Failed to fetch the URL');
    }

    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      '';

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('link[rel="apple-touch-icon"]').attr('href') ||
      '';

    let favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || '';
    if (!favicon) {
      if (url.includes('twitter.com') || url.includes('x.com')) favicon = 'https://abs.twimg.com/favicons/twitter.2.ico';
      if (url.includes('instagram.com')) favicon = 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png';
    }
    if (favicon && !favicon.startsWith('http')) {
      try {
        const urlObj = new URL(url);
        favicon = new URL(favicon, urlObj.origin).toString();
      } catch (e) {
        // ignore
      }
    }

    // Attempt to make image URL absolute if it is relative
    let absoluteImage = image;
    if (image && !image.startsWith('http')) {
       try {
         const urlObj = new URL(url);
         absoluteImage = new URL(image, urlObj.origin).toString();
       } catch (e) {
         // ignore
       }
    }

    return NextResponse.json({
      title,
      description,
      image: absoluteImage,
      favicon,
      url
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600' }
    });

  } catch (error) {
    // 내부 호스트 차단/실패 여부를 구분 노출하지 않도록 일반 오류로 응답 (SSRF 오라클 방지)
    console.error('Metadata API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}

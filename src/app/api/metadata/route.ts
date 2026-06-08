import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import net from 'net';

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
 * 주어진 URL이 공개 인터넷의 http(s) 자원인지 검증한다.
 * 스킴 위반, 내부 호스트명, 사설 IP로 해석되는 경우 throw.
 */
async function assertPublicUrl(raw: string): Promise<void> {
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
    return;
  }

  // 도메인은 DNS 해석 후 모든 주소가 공개 대역인지 확인 (DNS 리바인딩 1차 방어)
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('DNS resolution failed');
  }
  if (!addrs.length) throw new Error('No DNS records');
  for (const a of addrs) {
    if (ipIsPrivate(a.address)) throw new Error('Blocked private IP');
  }
}

/**
 * 리다이렉트를 직접 따라가며 매 홉마다 공개 URL 검증을 수행한다.
 * (공개 URL -> 내부 주소로의 리다이렉트 우회 차단)
 */
async function safeFetch(initialUrl: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let currentUrl = initialUrl;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublicUrl(currentUrl);
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: controller.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return res;
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }
      return res;
    }
    throw new Error('Too many redirects');
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
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

    // SSRF 방어: 스킴/사설IP 검증 + 리다이렉트 재검증 + 타임아웃
    const response = await safeFetch(fetchUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch the URL');
    }

    // 응답 크기 제한 (선언된 content-length가 과도하면 거부)
    const lenHeader = response.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
      throw new Error('Response too large');
    }

    const html = (await response.text()).slice(0, MAX_BODY_BYTES);
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

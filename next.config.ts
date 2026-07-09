import type { NextConfig } from "next";

// Content-Security-Policy — DOMPurify 뒤의 방어심층(주입 스크립트/폼탈취/클릭재킹 완화).
//  • script-src: 'self' + 'unsafe-inline'(Next 인라인 부트스트랩). 외부 스크립트 주입(<script src=evil>)은 차단.
//    (nonce 기반 strict-dynamic 은 미들웨어 필요 — 후속 하드닝. 현재도 외부 스크립트 차단 효과는 있음)
//  • 폰트: next/font/google 이 빌드 시 self-호스팅 → 'self'. 임베드: sanitize-html ALLOWED_IFRAME_HOSTS 와 정렬.
//  • img/connect 는 아바타·링크프리뷰·외부 API 다양성 때문에 https: 를 넓게 허용(비파괴 우선, 후속 tighten 여지).
//  • dev(NODE_ENV!=='production')는 HMR 을 위해 'unsafe-eval' + ws: 를 추가로 허용한다.
const IS_DEV = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${IS_DEV ? " ws: wss:" : ""}`,
  // ⚠ src/lib/sanitize-html.ts 의 ALLOWED_IFRAME_HOSTS 와 정확히 일치시킬 것 —
  //   DOMPurify 가 허용한 임베드를 CSP 가 막으면 크리에이터 임베드가 깨진다. 변경 시 양쪽 동시 갱신.
  "frame-src 'self' https://youtube.com https://www.youtube.com https://youtube-nocookie.com https://www.youtube-nocookie.com https://vimeo.com https://player.vimeo.com https://twitch.tv https://www.twitch.tv https://player.twitch.tv https://clips.twitch.tv https://open.spotify.com https://w.soundcloud.com",
  "media-src 'self' https: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// 프록시 경로(/dynmap-proxy)를 제외한 전 경로 공통 보안 헤더(클릭재킹 DENY 포함).
// /dynmap-proxy 는 src/app/dynmap-proxy 라우트 핸들러가 자체 헤더(SAMEORIGIN)를 설정한다.
const STRICT_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CSP },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
  },
];

const nextConfig: NextConfig = {
  // 빌드 속도: 타입체크를 빌드 핫패스에서 제외(가장 큰 비용)하고 `npm run check`(tsc --noEmit)로 따로 돌린다.
  //  ⚠ 이걸 켜면 `next build` 가 타입 에러를 더 이상 막지 않는다 — 배포 전 `npm run check` 필수.
  //  (ESLint 는 Next 16 에서 빌드와 분리됨 — 린트는 `npm run lint` 로 별도 실행)
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    // 런타임에 외부 리소스(번들 대상 아님)에 접근하는 모듈들 — NFT(파일 추적기)가 동적 경로/실행파일을
    // "matches N files in [project]" 로 과추적하는 경고는 우리 경우 오탐이다(매직코멘트 turbopackIgnore 는
    // fs/path.join/spawn 엔 적용 안 됨 — import/require 전용). 해당 파일 이슈만 좁게 억제한다.
    //  - schematics.ts      : MC 서버 디스크의 플레이어별 .schem/.bp 경로 직접 접근
    //  - schematicConvert.ts: SchemConvert jar 를 java 외부 프로세스로 spawn
    //  - blueprintGallery.ts: 갤러리 스토리지(MC_SER/Server/blueprint-gallery, 마크 서버 디스크 하위)에 원본 .bp/.schem
    //                         런타임 read/write. path.join(GALLERY_ROOT, <id>) 를 그 거대 디렉터리 전체로 과추적한다.
    //  - mcServerDir.ts     : 위 파일들의 공통 베이스 MC_SERVER_DIR = path.join(cwd, "MC_SER", "Server") 상수.
    //                         이 리터럴 경로를 폴딩해 MC_SER/Server 하위 전체(마크 월드 ~50만 파일)를 과추적한다(경로가
    //                         schematics/blueprintGallery 에서 이 파일로 중앙화되며 경고도 여기로 옮겨왔다).
    ignoreIssue: [
      { path: '**/src/lib/schematics.ts' },
      { path: '**/src/lib/schematicConvert.ts' },
      { path: '**/src/lib/blueprintGallery.ts' },
      { path: '**/src/lib/mcServerDir.ts' },
      // 위 과추적의 파생 — next.config.ts 가 NFT 목록에 들어갔다는 경고도 같은 오탐. title 로 좁게 억제(다른 config 이슈엔 영향 없음).
      { path: '**/next.config.ts', title: 'Encountered unexpected file in NFT list' },
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  allowedDevOrigins: ['localhost:3000', 'test.localhost:3000', 'craftopia.work', '*.craftopia.work'],
  experimental: {
    // ⚠ turbopackFileSystemCacheForBuild 는 이 환경에서 역효과라 제거함(2026-06-26):
    //   캐시(수 GB)가 매 빌드 무효화·재기록되며 디스크 I/O 만 늘어 오히려 빌드가 느려졌다.
    //   빌드 가속은 아래 typescript.ignoreBuildErrors(=빌드 중 tsc 스킵)만으로 충분(손해 없음).
    serverActions: {
      bodySizeLimit: '1024mb', // 1GB limit for Video/Audio
      allowedOrigins: [
        'http://craftopia.work',
        'https://craftopia.work',
        'http://*.craftopia.work',
        'https://*.craftopia.work',
        'http://sian17.craftopia.work',
        'https://sian17.craftopia.work',
        'http://tryangle.craftopia.work',
        'https://tryangle.craftopia.work',
        'http://owlhouse.craftopia.work',
        'https://owlhouse.craftopia.work',
        'http://localhost:3000',
        'http://*.localhost:3000'
      ],
    },
    proxyClientMaxBodySize: '1024mb', // Prevent Proxy from truncating stream at 10MB
  },
  async headers() {
    return [
      {
        // /dynmap-proxy 제외(라우트 핸들러가 자체 처리) — 나머지는 기존 보안 헤더 유지
        source: '/((?!dynmap-proxy).*)',
        headers: STRICT_HEADERS,
      },
    ]
  },
};

export default nextConfig;

// Forced restart for Prisma Client

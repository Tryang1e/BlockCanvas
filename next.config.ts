import type { NextConfig } from "next";

// 프록시 경로(/dynmap-proxy)를 제외한 전 경로 공통 보안 헤더(클릭재킹 DENY 포함).
// /dynmap-proxy 는 src/app/dynmap-proxy 라우트 핸들러가 자체 헤더(SAMEORIGIN)를 설정한다.
const STRICT_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
  },
];

const nextConfig: NextConfig = {
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

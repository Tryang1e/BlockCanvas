import type { NextConfig } from "next";

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
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // 최소 안전 CSP: 인라인 스타일/스크립트(script-src/style-src)는 건드리지 않아
            // 기존 기능을 깨지 않으면서 플러그인 XSS·<base> 주입·클릭재킹을 차단한다.
            // NOTE: script-src/style-src 까지 엄격히 잠그려면 Next.js 하이드레이션 인라인
            //       스크립트용 nonce 인프라가 필요하므로(미적용 시 앱 전체가 깨짐) 별도 작업으로 분리한다.
            key: 'Content-Security-Policy',
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
          {
            // 포트폴리오 사이트가 사용하지 않는 강력한 브라우저 기능을 전면 차단(프라이버시·공격면 축소).
            // 임베드(YouTube/Twitter 등)는 iframe 자체이므로 영향 없음.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
          },
        ],
      },
    ]
  },
};

export default nextConfig;

// Forced restart for Prisma Client

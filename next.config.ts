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
            key: 'Content-Security-Policy',
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ]
  },
};

export default nextConfig;

// Forced restart for Prisma Client

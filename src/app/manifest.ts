import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BlockCanvas | 블록을 쌓아 만드는 나만의 포트폴리오',
    short_name: 'BlockCanvas',
    description:
      'BlockCanvas는 드래그 앤 드롭으로 블록을 자유롭게 배치하여 만드는 크리에이터 전용 매직 캔버스 포트폴리오 플랫폼입니다.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}

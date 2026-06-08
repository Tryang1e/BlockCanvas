import type { MetadataRoute } from 'next'

const SITE_URL = 'https://craftopia.work'

// 검색엔진 크롤러 규칙. 공개 페이지는 허용하고, 내부/비공개 영역은 차단한다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/adminpage', // 관리자 영역
        '/dashboard', // 크리에이터 비공개 대시보드
        '/editor',    // 편집기
        '/settings',  // 설정
        '/login',     // 로그인
        '/api/',      // API 라우트
        '/sites/',    // 서브도메인 리라이트 내부 경로(직접 노출 방지)
        '/uploads/',  // 업로드 원본
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

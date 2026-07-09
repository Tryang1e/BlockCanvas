import type { Metadata } from "next";
// 한글 본문 폰트: Pretendard Variable (OFL) — dynamic-subset이라 쓰인 글리프의 슬라이스만 다운로드됨
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import SmoothScroll from "@/components/ui/SmoothScroll";
import { ThemeProvider } from "@/components/theme-provider";
import { PixelTransitionProvider } from "@/components/ui/PixelTransition";
import Script from "next/script";

export const metadata: Metadata = {
  // 상대 경로 메타데이터(OG 이미지/사이트맵 등)의 기준이 되는 절대 URL.
  metadataBase: new URL("https://craftopia.work"),
  title: "BlockCanvas | 블록을 쌓아 만드는 나만의 포트폴리오",
  description: "BlockCanvas는 드래그 앤 드롭으로 블록을 자유롭게 배치하여 만드는 크리에이터 전용 매직 캔버스 포트폴리오 플랫폼입니다.",
  openGraph: {
    title: "BlockCanvas | 블록을 쌓아 만드는 나만의 포트폴리오",
    description: "BlockCanvas는 드래그 앤 드롭으로 블록을 자유롭게 배치하여 만드는 크리에이터 전용 매직 캔버스 포트폴리오 플랫폼입니다.",
    url: "https://craftopia.work",
    siteName: "BlockCanvas",
    // og:image 는 app/opengraph-image.tsx(파일 컨벤션, 동적 브랜드 카드)가 담당 —
    // 예전 http://…:9000 로고 하드코딩은 mixed content 라 Discord 등에서 거부됐다.
    type: "website",
  }
};

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch site settings
  const settings = await prisma.siteSetting.findMany({
    where: {
      key: { in: ['GLOBAL_BANNER_ACTIVE', 'GLOBAL_BANNER_TEXT', 'MAINTENANCE_MODE'] }
    }
  })
  
  const settingsObj = settings.reduce((acc: Record<string, string>, curr: any) => {
    acc[curr.key] = curr.value
    return acc
  }, {} as Record<string, string>)
  
  const isBannerActive = settingsObj['GLOBAL_BANNER_ACTIVE'] === 'true'
  const bannerText = settingsObj['GLOBAL_BANNER_TEXT'] || ''
  const isMaintenance = settingsObj['MAINTENANCE_MODE'] === 'true'

  // Check if admin
  let isAdmin = false
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)
  
  if (session === 'admin') {
    isAdmin = true
  } else if (session) {
    const profile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
    if (profile && profile.role?.toLowerCase() === 'admin') {
      isAdmin = true
    }
  }

  // If maintenance mode is active and user is not admin, show maintenance screen
  if (isMaintenance && !isAdmin) {
    return (
      <html lang="ko" className="h-full antialiased">
        <body className="min-h-full flex items-center justify-center bg-neutral-900 text-white p-6">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-black mb-4 tracking-tight">서버 점검 중입니다 🛠️</h1>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              더 나은 서비스를 제공하기 위해 시스템을 점검하고 있습니다. <br/>
              조금만 기다려 주시면 금방 돌아오겠습니다!
            </p>
            <p className="text-xs text-neutral-600 font-bold uppercase tracking-widest">
              BlockCanvas Team
            </p>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        {/* 에디터 콘텐츠 폰트(전부 무료 상업용, 저장된 글이 리터럴 family명을 참조하므로 family명 유지 필수):
            기존 4종(주아/명조/손글씨/고딕) + 확장 4종(검은고딕/도현/구기/고운바탕).
            셀프호스트 확장(네오둥근모/갈무리/Uni Sans/BC Pixel)은 globals.css @font-face 참조. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jua&family=Nanum+Myeongjo:wght@400;700;800&family=Nanum+Pen+Script&family=Noto+Sans+KR:wght@300;400;500;700;900&family=Black+Han+Sans&family=Do+Hyeon&family=Gugi&family=Gowun+Batang:wght@400;700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var test = window.localStorage;
                  if (!test) throw new Error("localStorage is null");
                } catch (e) {
                  console.warn("[BlockCanvas] 스토리지 접근이 차단되어 메모리 기반 Mock 스토리지를 활성화합니다.");
                  var storageMock = {
                    _data: {},
                    getItem: function(k) { return this._data[k] || null; },
                    setItem: function(k, v) { this._data[k] = String(v); },
                    removeItem: function(k) { delete this._data[k]; },
                    clear: function() { this._data = {}; },
                    key: function(i) { return Object.keys(this._data)[i] || null; },
                    length: 0
                  };
                  Object.defineProperty(storageMock, 'length', {
                    get: function() { return Object.keys(this._data).length; }
                  });
                  try {
                    Object.defineProperty(window, 'localStorage', {
                      value: storageMock,
                      writable: true,
                      configurable: true
                    });
                  } catch (err) {
                    try {
                      window.localStorage = storageMock;
                    } catch (e2) {}
                  }
                }
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pt-0">
        {isBannerActive && bannerText && (
          <div className="w-full bg-blue-600 text-white text-center py-2 px-4 text-sm font-bold shadow-md z-[9999] relative">
            {bannerText}
          </div>
        )}
        <ThemeProvider>
          <PixelTransitionProvider>
            {children}
          </PixelTransitionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

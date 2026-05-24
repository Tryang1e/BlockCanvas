import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/ui/SmoothScroll";
import { ThemeProvider } from "@/components/theme-provider";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlockCanvas | 블록을 쌓아 만드는 나만의 포트폴리오",
  description: "BlockCanvas는 드래그 앤 드롭으로 블록을 자유롭게 배치하여 만드는 크리에이터 전용 매직 캔버스 포트폴리오 플랫폼입니다.",
  openGraph: {
    title: "BlockCanvas | 블록을 쌓아 만드는 나만의 포트폴리오",
    description: "BlockCanvas는 드래그 앤 드롭으로 블록을 자유롭게 배치하여 만드는 크리에이터 전용 매직 캔버스 포트폴리오 플랫폼입니다.",
    url: "https://blockcanvas.work",
    siteName: "BlockCanvas",
    images: [
      {
        url: "http://craftopia.work:9000/logo/white/logo.png",
        width: 1200,
        height: 630,
        alt: "BlockCanvas 로고",
      }
    ],
    type: "website",
  }
};

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

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
  const session = cookieStore.get('session')?.value
  
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
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
      </head>
      <body className="min-h-full flex flex-col pt-0">
        {isBannerActive && bannerText && (
          <div className="w-full bg-blue-600 text-white text-center py-2 px-4 text-sm font-bold shadow-md z-[9999] relative">
            {bannerText}
          </div>
        )}
        <ThemeProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}

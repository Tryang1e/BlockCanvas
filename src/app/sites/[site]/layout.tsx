import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import React from 'react'
import { verifySession } from '@/lib/session'

export default async function CreatorLayout({
  children,
  modal,
  params
}: {
  children: React.ReactNode
  modal: React.ReactNode
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const siteLower = site.toLowerCase()

  // 1. 권한 및 활성화 체크 (소유자 여부 판단을 위해 순서 변경)
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)
  const isOwner = session === siteLower

  // 2. 프로필 및 포트폴리오 상태 확인
  const profile = await prisma.profile.findUnique({
    where: { creator_name: siteLower },
    include: { portfolios: true }
  })

  // 프로필이 없는 경우 포트폴리오 접근 자체를 404 차단
  if (!profile) {
    return notFound()
  }

  const portfolio = profile.portfolios

  // 포트폴리오가 생성되어 있지 않은 경우, 소유자가 아니라면 404 에러를 반환합니다.
  if (!portfolio) {
    if (!isOwner) {
      return notFound()
    }
  }

  // 비공개 상태이고 소유자가 아닌 경우 차단 화면 표시
  if (portfolio && !portfolio.is_published && !isOwner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#111] text-white p-6 font-sans">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-black mb-4 tracking-tight">비공개 포트폴리오입니다</h1>
          <p className="text-neutral-400 leading-relaxed mb-8">
            현재 이 포트폴리오는 크리에이터에 의해 비공개로 설정되어 있습니다. <br/>
            준비가 완료되면 다시 방문해 주세요!
          </p>
          <a href="/" className="inline-block px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-colors">
            메인으로 돌아가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      {modal}
    </>
  )
}

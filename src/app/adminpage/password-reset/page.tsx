import React from 'react'
import { prisma } from '@/lib/prisma'
import PasswordResetForm from './PasswordResetForm'

export const dynamic = 'force-dynamic'

export default async function PasswordResetPage() {
  // 1. 비밀번호 초기화가 가능한 전체 크리에이터 프로필 리스트 획득 (이메일이 존재하는 계정 대상)
  const profiles = await prisma.profile.findMany({
    where: {
      AND: [
        { email: { not: null } },
        { email: { not: '' } }
      ]
    },
    select: {
      id: true,
      email: true,
      display_name: true,
      creator_name: true
    },
    orderBy: {
      email: 'asc'
    }
  })

  // 안전하게 타입 가공 처리 (Null 방어)
  const userList = profiles.map(p => ({
    email: p.email || '',
    display_name: p.display_name || p.creator_name || '이름 없음',
    creator_name: p.creator_name
  })).filter(u => u.email !== '')

  return (
    <div className="max-w-2xl mx-auto py-6">
      
      {/* 🧭 헤더 내비게이션 경로 */}
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-3">
        <span>Admin Dashboard</span>
        <span>/</span>
        <span className="text-rose-500 font-bold">비밀번호 관리</span>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 p-8 sm:p-10 shadow-[0_24px_80px_rgba(0,0,0,0.04)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.25)] relative overflow-hidden">
        
        {/* 🎆 탑 엠비언트 오라 데코레이션 */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-purple-500 to-blue-500 pointer-events-none" />

        <div className="mb-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            🔑 사용자 비밀번호 초기화 마스터
          </h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 font-medium leading-relaxed">
            특정 크리에이터의 계정 비밀번호 분실 시, 이메일을 조회하여 즉각 새 비밀번호로 안전하게 초기화합니다.
            비밀번호를 초기화하는 즉시 **관리자 활동 로그(Audit Log)**에 이력이 엄격히 기록됩니다.
          </p>
        </div>

        {/* 📝 클라이언트 인터랙티브 비밀번호 초기화 폼 카드 마운트 */}
        <PasswordResetForm userList={userList} />

      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { login, signup } from '@/app/actions/auth'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  // 'login' | 'signup' 동적 반응형 모드 관리
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (message) {
      setErrorMessage(message)
    }
  }, [message])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)
    try {
      if (mode === 'login') {
        await login(formData)
      } else {
        await signup(formData)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '인증 과정 중 알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#fafafa] dark:bg-[#070708] overflow-hidden px-6 py-20 transition-colors duration-500">
      
      {/* 🌌 하이엔드 미학적 격자(Grid) 및 은은한 HSL 네온 스무스 광원 레이어 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-neutral-200/20 to-neutral-100/10 dark:from-neutral-900/20 dark:to-neutral-900/10 blur-[120px] pointer-events-none" />
      
      {/* ◀️ 좌측 상단 세련된 미니멀 백 버튼 */}
      <Link
        href="/"
        className="absolute left-6 top-6 sm:left-10 sm:top-10 z-50 flex items-center gap-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all duration-300 group py-2 px-4 rounded-full border border-neutral-200/50 dark:border-neutral-800/40 bg-white/40 dark:bg-neutral-900/30 backdrop-blur-sm shadow-sm"
      >
        <svg 
          className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform duration-300" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        돌아가기
      </Link>

      {/* 🔒 럭셔리 모놀리스(Monolith) 로그인/회원가입 메인 카드 */}
      <div 
        className="w-full max-w-[460px] bg-white/90 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800/60 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-[0_32px_120px_rgba(0,0,0,0.06)] dark:shadow-[0_32px_120px_rgba(0,0,0,0.35)] relative z-10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-12 duration-700"
      >
        
        {/* 🏢 브랜드 로고 및 웰컴 헤더 */}
        <div className="flex flex-col items-center text-center mb-8 select-none">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image
              src="/logo_icon.png"
              alt="BlockCanvas Icon"
              width={40}
              height={40}
              className="h-10 w-auto object-contain dark:invert"
            />
            <Image
              src="/logo_text.png"
              alt="BlockCanvas Text"
              width={140}
              height={32}
              className="h-7 w-auto object-contain dark:invert"
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">
            {mode === 'login' ? '환영합니다' : '새로운 여정의 시작'}
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 font-medium tracking-wide">
            {mode === 'login' 
              ? '당신의 창의성을 세상에 아름다운 포트폴리오로 보여주세요.' 
              : 'BlockCanvas의 크리에이터가 되어 당신만의 캔버스를 펼쳐보세요.'
            }
          </p>
        </div>

        {/* 🎛️ 미끄러지듯 전환되는 고급 모드 토글러 */}
        <div className="bg-neutral-100 dark:bg-neutral-950 rounded-full p-1 flex relative mb-8 border border-neutral-200/30 dark:border-neutral-800/40 select-none">
          {/* Active indicator pill background */}
          <div 
            className={`absolute top-1 bottom-1 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 shadow-sm transition-all duration-500 ease-out`}
            style={{
              left: mode === 'login' ? '4px' : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)'
            }}
          />
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null) }}
            className={`flex-1 text-center py-2.5 text-xs font-bold rounded-full relative z-10 transition-colors duration-500 ${mode === 'login' ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'}`}
          >
            로그인
          </button>
          <button
            type="button"
            disabled
            className="flex-1 text-center py-2.5 text-xs font-bold rounded-full relative z-10 opacity-30 cursor-not-allowed text-neutral-400 dark:text-neutral-500 flex items-center justify-center gap-1.5 select-none"
            title="현재 회원가입은 임시 비활성화 상태입니다."
          >
            회원가입
            <span className="text-[9px] px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-full font-medium scale-90">준비중</span>
          </button>
        </div>

        {/* 📝 하이엔드 인풋 리스트 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 mb-1.5 tracking-wider" htmlFor="email">
              이메일 주소
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                className="w-full rounded-2xl px-4 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 focus:border-neutral-900 dark:focus:border-white focus:ring-4 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none text-sm text-neutral-950 dark:text-white placeholder-neutral-400 transition-all duration-300 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 mb-1.5 tracking-wider" htmlFor="password">
              비밀번호
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-2xl px-4 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 focus:border-neutral-900 dark:focus:border-white focus:ring-4 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none text-sm text-neutral-950 dark:text-white placeholder-neutral-400 transition-all duration-300 shadow-sm"
              />
            </div>
          </div>

          {/* ⚡ 웅장하고 미니멀한 버튼 피드백 */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 rounded-2xl py-4 font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all duration-300 shadow-md dark:shadow-sm mt-3 flex items-center justify-center gap-2 select-none disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
            ) : mode === 'login' ? (
              '로그인하기'
            ) : (
              '회원가입 완료하기'
            )}
          </button>

          {/* ⚠️ 에러/안내 메시지 레이아웃 */}
          {errorMessage && (
            <div className="mt-4 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl text-center shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              {errorMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

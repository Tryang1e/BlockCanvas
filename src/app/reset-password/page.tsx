'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '@/app/actions/auth'
import { validatePassword, PASSWORD_POLICY_HINT } from '@/lib/password-policy'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [isPending, setIsPending] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    setMessage(null)

    const fd = new FormData(e.currentTarget)
    const pw = (fd.get('password') as string) || ''
    const confirm = (fd.get('password_confirm') as string) || ''

    const pc = validatePassword(pw)
    if (!pc.ok) {
      setErrorMessage(pc.error || '비밀번호 형식을 확인해 주세요.')
      return
    }
    if (pw !== confirm) {
      setErrorMessage('비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setIsPending(true)
    try {
      const res = await resetPassword(token, pw, confirm)
      if ('error' in res) setErrorMessage(res.error || '재설정에 실패했습니다.')
      else {
        setDone(true)
        setMessage(res.message)
      }
    } catch {
      setErrorMessage('재설정 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#fafafa] dark:bg-[#070708] overflow-hidden px-6 py-20 transition-colors duration-500">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-neutral-200/20 to-neutral-100/10 dark:from-neutral-900/20 dark:to-neutral-900/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[460px] bg-white/90 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800/60 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-[0_32px_120px_rgba(0,0,0,0.06)] dark:shadow-[0_32px_120px_rgba(0,0,0,0.35)] relative z-10">
        <div className="flex flex-col items-center text-center mb-8 select-none">
          <Image src="/logo_icon.png" alt="BlockCanvas" width={40} height={40} className="h-10 w-auto object-contain dark:invert mb-4" />
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">비밀번호 재설정</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 font-medium tracking-wide">
            새로 사용하실 비밀번호를 입력해 주세요.
          </p>
        </div>

        {!token ? (
          <div className="p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl text-center">
            유효하지 않은 재설정 링크입니다. <Link href="/forgot-password" className="underline">다시 요청하기</Link>
          </div>
        ) : done ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl text-center">
              {message}
            </div>
            <Link
              href="/login"
              className="w-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 rounded-2xl py-4 font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all duration-300 shadow-md text-center select-none"
            >
              로그인하러 가기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 mb-1.5 tracking-wider" htmlFor="password">
                새 비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-2xl px-4 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 focus:border-neutral-900 dark:focus:border-white focus:ring-4 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none text-sm text-neutral-950 dark:text-white placeholder-neutral-400 transition-all duration-300 shadow-sm"
              />
              <p className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium pl-1">{PASSWORD_POLICY_HINT}</p>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 mb-1.5 tracking-wider" htmlFor="password_confirm">
                새 비밀번호 확인
              </label>
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-2xl px-4 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 focus:border-neutral-900 dark:focus:border-white focus:ring-4 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none text-sm text-neutral-950 dark:text-white placeholder-neutral-400 transition-all duration-300 shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 rounded-2xl py-4 font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all duration-300 shadow-md mt-1 flex items-center justify-center gap-2 select-none disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPending ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" /> : '비밀번호 변경하기'}
            </button>

            {errorMessage && (
              <div className="mt-2 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl text-center animate-in fade-in slide-in-from-top-4 duration-300">
                {errorMessage}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

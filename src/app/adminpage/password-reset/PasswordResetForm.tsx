'use client'

import React, { useState, useTransition, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetUserPasswordByAdminAction } from '@/app/actions/auth'

interface UserItem {
  email: string
  display_name: string
  creator_name: string
}

export default function PasswordResetForm({ userList }: { userList: UserItem[] }) {
  const [isPending, startTransition] = useTransition()
  const [selectedEmail, setSelectedEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // 0. URL Query String (?email=...) 으로 넘어온 타겟 이메일을 자동 센싱하여 박제
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')

  useEffect(() => {
    if (emailParam) {
      setSelectedEmail(emailParam)
    }
  }, [emailParam])

  // 1. 보안 규격에 부합하는 원터치 8자리 난수 임시 비밀번호 생성기
  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let randPass = 'bc-' // BlockCanvas Prefix
    for (let i = 0; i < 6; i++) {
      randPass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(randPass)
    setCopied(false)
    setStatusMessage(null)
  }

  // 2. 생성된 임시 비밀번호 클립보드 즉시 복사 피드백
  const copyToClipboard = () => {
    if (!newPassword) return
    navigator.clipboard.writeText(newPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 3. 폼 전송 핸들러
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatusMessage(null)

    if (!selectedEmail) {
      setStatusMessage({ type: 'error', text: '초기화할 사용자 이메일을 리스트에서 올바르게 선택해 주세요.' })
      return
    }

    if (!newPassword || newPassword.length < 4) {
      setStatusMessage({ type: 'error', text: '비밀번호는 최소 4글자 이상이어야 합니다.' })
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', selectedEmail)
      formData.append('newPassword', newPassword)

      try {
        const res = await resetUserPasswordByAdminAction(formData)
        if (res.error) {
          setStatusMessage({ type: 'error', text: res.error })
        } else if (res.success) {
          setStatusMessage({ type: 'success', text: res.message || '비밀번호가 성공적으로 초기화되었습니다.' })
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err?.message || '초기화 작업 중 알 수 없는 시스템 예외가 일어났습니다.' })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      
      {/* 📧 사용자 이메일 검색 및 목록 datalist 연계 자동완성 */}
      <div>
        <label className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 mb-2 tracking-wider" htmlFor="email-search">
          크리에이터 계정 이메일
        </label>
        <div className="relative">
          <input
            id="email-search"
            name="email"
            type="email"
            placeholder="이메일을 검색하거나 직접 입력해 주세요."
            list="users-datalist"
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            required
            className="w-full rounded-2xl px-4 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none text-sm text-neutral-950 dark:text-white placeholder-neutral-400 transition-all duration-300 shadow-sm"
          />
          <datalist id="users-datalist">
            {userList.map((user, idx) => (
              <option key={idx} value={user.email}>
                {user.display_name} (@{user.creator_name})
              </option>
            ))}
          </datalist>
        </div>
        <p className="text-[10px] text-neutral-400 mt-2 font-medium">
          💡 입력창을 클릭하거나 입력하면 현재 가입된 사용자 목록의 이메일이 자동 추천됩니다.
        </p>
      </div>

      {/* 🔑 새 임시 비밀번호 설정 및 난수 메이커 */}
      <div>
        <label className="block text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 mb-2 tracking-wider" htmlFor="password-input">
          설정할 임시 비밀번호
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="password-input"
              name="newPassword"
              type="text"
              placeholder="직접 작성하거나 생성 버튼을 클릭해 주세요."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-2xl px-4 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none text-sm text-neutral-950 dark:text-white placeholder-neutral-400 transition-all duration-300 shadow-sm font-mono tracking-wider"
            />
          </div>
          
          <button
            type="button"
            onClick={generateRandomPassword}
            className="px-4 py-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs rounded-2xl transition-all duration-300 border border-neutral-200/50 dark:border-neutral-700/50 flex items-center justify-center gap-1 active:scale-[0.98] select-none"
          >
            🎲 임시번호 생성
          </button>
        </div>

        {/* 생성된 난수 복사 단추 */}
        {newPassword && (
          <div className="mt-2.5 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200/50 dark:border-neutral-800/60 rounded-2xl px-4 py-2.5">
            <span className="text-[10px] text-neutral-400 font-bold font-mono">임시 비밀번호: {newPassword}</span>
            <button
              type="button"
              onClick={copyToClipboard}
              className={`text-[10px] font-extrabold px-3 py-1 rounded-lg border transition-all select-none ${copied ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40' : 'bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              {copied ? '✓ 복사완료' : '📋 클립보드 복사'}
            </button>
          </div>
        )}
      </div>

      {/* 🚀 실행 버튼 */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-rose-600 hover:bg-rose-700 text-white dark:text-white rounded-2xl py-4 font-bold text-sm active:scale-[0.99] transition-all duration-300 shadow-md shadow-rose-600/10 mt-2 flex items-center justify-center gap-2 select-none disabled:opacity-50 disabled:pointer-events-none"
      >
        {isPending ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        ) : (
          '🔒 비밀번호 안전 초기화 실행'
        )}
      </button>

      {/* ⚠️ 에러 및 성공 피드백 알림 블록 */}
      {statusMessage && (
        <div 
          className={`p-4 rounded-2xl text-xs font-semibold border shadow-sm text-center animate-in fade-in slide-in-from-top-4 duration-300 ${
            statusMessage.type === 'success' 
              ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' 
              : 'text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

    </form>
  )
}

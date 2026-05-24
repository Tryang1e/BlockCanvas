'use client'

import { useState } from 'react'
import { changePasswordAction } from '@/app/actions/auth'

export default function PasswordForm({ creatorName }: { creatorName: string }) {
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (newPass !== confirmPass) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (newPass.length < 6) {
      setError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setIsLoading(true)
    try {
      const res = await changePasswordAction(creatorName, currentPass, newPass)
      if (res.error) {
        setError(res.error)
      } else {
        setMessage('비밀번호가 성공적으로 변경되었습니다.')
        setCurrentPass('')
        setNewPass('')
        setConfirmPass('')
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {message && <p className="text-sm text-green-600 font-bold">{message}</p>}
      <input 
        type="password" 
        value={currentPass}
        onChange={(e) => setCurrentPass(e.target.value)}
        placeholder="현재 비밀번호 (기존 가입자는 비워두세요)" 
        className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" 
      />
      <input 
        type="password" 
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
        placeholder="새 비밀번호" 
        required
        className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" 
      />
      <input 
        type="password" 
        value={confirmPass}
        onChange={(e) => setConfirmPass(e.target.value)}
        placeholder="새 비밀번호 확인" 
        required
        className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" 
      />
      <button 
        className="mt-2 bg-neutral-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow hover:bg-black transition-colors disabled:opacity-50"
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? '변경 중...' : '비밀번호 업데이트'}
      </button>
    </form>
  )
}

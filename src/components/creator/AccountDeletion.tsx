'use client'

import { useState } from 'react'
import { deleteAccountAction } from '@/app/actions/auth'

export default function AccountDeletion({ creatorName, is2faEnabled = false }: { creatorName: string; is2faEnabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== '계정 영구 삭제') return
    if (!password) {
      setError('비밀번호를 입력해 주세요.')
      return
    }
    if (is2faEnabled && otpCode.length !== 6) {
      setError('6자리 OTP 인증 코드를 입력해 주세요.')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const res = await deleteAccountAction(creatorName, password, otpCode)
      if (res && res.error) {
        setError(res.error)
        setIsLoading(false)
      } else {
        window.location.href = '/'
      }
    } catch (e) {
      setError('서버 통신 중 에러가 발생했습니다.')
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-8 pt-8 border-t border-red-100">
      <h2 className="text-lg font-bold text-red-600 mb-2">위험 구역 (Danger Zone)</h2>
      <p className="text-sm text-neutral-500 mb-4">계정을 삭제하면 복구할 수 없습니다. 생성한 모든 프로젝트와 포트폴리오가 완전히 영구 삭제됩니다.</p>
      
      {error && <p className="text-sm text-red-600 font-bold mb-4">{error}</p>}

      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded transition-colors"
        >
          계정 삭제하기
        </button>
      ) : (
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-200 space-y-4 max-w-md">
          <p className="text-sm text-red-800 font-bold">
            정말로 삭제하시겠습니까? 안전을 위해 아래 정보를 확인해 주세요.
          </p>

          <div>
            <label className="block text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">
              본인 확인 비밀번호
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="현재 비밀번호 입력" 
              required
              className="w-full border border-red-200 p-2.5 rounded-xl bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium text-sm"
            />
          </div>

          {is2faEnabled && (
            <div>
              <label className="block text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">
                구글 2FA OTP 6자리 번호
              </label>
              <input 
                type="text" 
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000" 
                maxLength={6}
                required
                className="w-full border border-red-200 p-2.5 rounded-xl bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-center text-base font-bold tracking-widest"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">
              최종 확인 문구 (아래 입력)
            </label>
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="계정 영구 삭제" 
              required
              className="w-full border border-red-200 p-2.5 rounded-xl bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium text-sm"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button 
              onClick={handleDelete}
              disabled={confirmText !== '계정 영구 삭제' || !password || (is2faEnabled && otpCode.length !== 6) || isLoading}
              className="flex-1 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? '삭제 진행 중...' : '계정 삭제 실행'}
            </button>
            <button 
              onClick={() => { setIsOpen(false); setConfirmText(''); setPassword(''); setOtpCode(''); setError(''); }}
              className="flex-1 text-sm font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 px-4 py-2.5 rounded-xl transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { deleteAccountAction } from '@/app/actions/auth'

export default function AccountDeletion({ creatorName }: { creatorName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== '계정 영구 삭제') return
    setIsLoading(true)
    try {
      await deleteAccountAction(creatorName)
      // The action should redirect, so we don't necessarily need to do anything here, but just in case:
      window.location.href = '/'
    } catch (e) {
      alert('오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-8 pt-8 border-t border-red-100">
      <h2 className="text-lg font-bold text-red-600 mb-2">위험 구역 (Danger Zone)</h2>
      <p className="text-sm text-neutral-500 mb-4">계정을 삭제하면 복구할 수 없습니다. 생성한 모든 프로젝트와 포트폴리오가 완전히 영구 삭제됩니다.</p>
      
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded transition-colors"
        >
          계정 삭제하기
        </button>
      ) : (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 animate-in fade-in zoom-in-95 duration-200">
          <p className="text-sm text-red-800 font-bold mb-3">정말로 삭제하시겠습니까? 삭제하려면 아래에 "계정 영구 삭제"라고 입력하세요.</p>
          <input 
            type="text" 
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="계정 영구 삭제" 
            className="w-full border border-red-200 p-2.5 rounded bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium text-sm mb-3"
          />
          <div className="flex gap-2">
            <button 
              onClick={handleDelete}
              disabled={confirmText !== '계정 영구 삭제' || isLoading}
              className="flex-1 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? '삭제 중...' : '계정 삭제 실행'}
            </button>
            <button 
              onClick={() => { setIsOpen(false); setConfirmText(''); }}
              className="flex-1 text-sm font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 px-4 py-2.5 rounded transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserAdminAction } from '@/app/actions/admin'

export default function AddUserModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    try {
      const res = await createUserAdminAction(formData)
      if (res.error) {
        setError(res.error)
      } else {
        setIsOpen(false)
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || '사용자 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded shadow-sm transition-colors"
      >
        + 사용자 추가
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h3 className="font-extrabold text-neutral-800">새 사용자(크리에이터) 추가</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-800 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded">{error}</div>}
              
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">이메일</label>
                <input 
                  type="email" 
                  name="email"
                  required 
                  className="w-full border border-neutral-300 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">비밀번호</label>
                <input 
                  type="password" 
                  name="password"
                  required 
                  className="w-full border border-neutral-300 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  placeholder="6자리 이상 입력"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">크리에이터 닉네임 (ID)</label>
                  <input 
                    type="text" 
                    name="creator_name"
                    required 
                    className="w-full border border-neutral-300 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                    placeholder="고유 ID (URL 사용)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">표시용 이름</label>
                  <input 
                    type="text" 
                    name="display_name"
                    className="w-full border border-neutral-300 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                    placeholder="표시될 이름"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">권한 설정</label>
                <select 
                  name="role"
                  className="w-full border border-neutral-300 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="creator">일반 크리에이터 (Creator)</option>
                  <option value="admin">최고 관리자 (Admin)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-neutral-500 hover:bg-neutral-100 rounded transition-colors"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? '생성 중...' : '계정 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

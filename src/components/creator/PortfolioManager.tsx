'use client'

import { useState } from 'react'
import { createPortfolioAction, deletePortfolioAction } from '@/app/actions/portfolio'
import { useRouter } from 'next/navigation'
import { Globe, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function PortfolioManager({ 
  creatorName, 
  hasPortfolio 
}: { 
  creatorName: string
  hasPortfolio: boolean 
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const router = useRouter()

  const handleCreate = async () => {
    setIsLoading(true)
    try {
      await createPortfolioAction(creatorName)
      router.refresh()
    } catch (err) {
      alert('포트폴리오 생성에 실패했습니다.')
    }
    setIsLoading(false)
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deletePortfolioAction(creatorName)
      router.refresh()
    } catch (err) {
      alert('포트폴리오 제거에 실패했습니다.')
    }
    setIsLoading(false)
  }

  if (hasPortfolio) {
    return (
      <div className="space-y-6">
        <div className="p-6 border border-green-200 bg-green-50 rounded-2xl flex items-start gap-4">
          <CheckCircle2 className="text-green-600 mt-1 shrink-0" />
          <div>
            <h3 className="font-bold text-green-900 mb-1">인사이트 포트폴리오가 활성화되었습니다.</h3>
            <p className="text-sm text-green-800/80 mb-4 font-medium">현재 방문자들이 포트폴리오 페이지를 볼 수 있습니다. 메인 화면이나 설정 탭에서 내용을 꾸며보세요.</p>
            <div className="flex gap-3">
              <Link 
                href={`/creator/${creatorName}`}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow hover:bg-green-700 transition-colors"
              >
                내 사이트 꾸미기
              </Link>
              <Link 
                href={`/creator/${creatorName}/dashboard/settings`}
                className="bg-white text-green-700 px-5 py-2.5 rounded-lg text-sm font-bold border border-green-200 hover:bg-green-50 transition-colors"
              >
                프로필 내용 수정
              </Link>
            </div>
          </div>
        </div>

        <section className="pt-8 mt-8 border-t border-neutral-100">
          <h2 className="text-lg font-bold border-b border-red-100 pb-3 mb-5 text-red-600">위험 구역 (Danger Zone)</h2>
          <div className="p-5 border border-red-200 bg-red-50/50 rounded-xl flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-red-900 mb-1">포트폴리오 비활성화 (제거)</h3>
              <p className="text-sm text-red-700/80 font-medium">포트폴리오 소개글과 배너 등 기본 설정이 초기화되며 사이트 노출이 중단됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            </div>
            
            {showDeleteConfirm ? (
              <div className="bg-white p-4 rounded-lg border border-red-200 mt-2">
                <p className="text-sm font-bold text-neutral-800 mb-2">
                  정말 비활성화하시겠습니까? 아래에 <span className="text-red-600 bg-red-50 px-1 rounded select-all">{creatorName}/삭제</span> 라고 정확히 입력하세요.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={`${creatorName}/삭제`}
                    className="flex-1 border border-neutral-300 p-2.5 rounded-lg text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteConfirmText('')
                      }}
                      className="px-4 py-2.5 bg-neutral-100 text-neutral-600 rounded-lg text-sm font-bold hover:bg-neutral-200 transition-colors"
                    >
                      취소
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={isLoading || deleteConfirmText !== `${creatorName}/삭제`}
                      className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isLoading ? '처리 중...' : '확인 및 제거'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="whitespace-nowrap px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm transition-colors"
                >
                  포트폴리오 제거
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="text-center py-12 px-6 border-2 border-dashed border-neutral-200 rounded-2xl bg-neutral-50">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
        <Globe className="text-neutral-400" size={32} />
      </div>
      <h3 className="text-xl font-bold text-neutral-900 mb-2">아직 포트폴리오 사이트가 없습니다.</h3>
      <p className="text-neutral-500 font-medium mb-8 max-w-md mx-auto">
        크리에이터님만의 멋진 작품들을 전시할 수 있는 인사이트 포트폴리오를 지금 바로 생성해 보세요!
      </p>
      <button 
        onClick={handleCreate}
        disabled={isLoading}
        className="bg-blue-600 text-white px-8 py-3.5 rounded-full text-sm font-bold shadow hover:bg-blue-700 transition-colors disabled:opacity-50 tracking-wide"
      >
        {isLoading ? '생성 중...' : '새 포트폴리오 생성하기'}
      </button>
    </div>
  )
}

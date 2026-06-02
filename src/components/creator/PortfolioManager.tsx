'use client'

import { useState, useEffect } from 'react'
import { createPortfolioAction, deletePortfolioAction } from '@/app/actions/portfolio'
import { updateSubdomainAction } from '@/app/actions/profile'
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

  // Subdomain Change State
  const [newSubdomain, setNewSubdomain] = useState(creatorName)
  const [isSubdomainLoading, setIsSubdomainLoading] = useState(false)
  const [subdomainError, setSubdomainError] = useState('')
  const [subdomainSuccess, setSubdomainSuccess] = useState('')
  const [showSubdomainModal, setShowSubdomainModal] = useState(false)

  // Get base domain dynamically (e.g. craftopia.work or localhost:3000)
  const [baseDomain, setBaseDomain] = useState('craftopia.work')
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host
      const parts = host.split('.')
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        setBaseDomain('localhost:3000')
      } else {
        if (parts.length >= 3) {
          setBaseDomain(parts.slice(1).join('.'))
        } else {
          setBaseDomain(host)
        }
      }
    }
  }, [])

  const handleSubdomainChange = (val: string) => {
    const lowerVal = val.toLowerCase().replace(/\s+/g, '')
    setNewSubdomain(lowerVal)
    
    if (lowerVal === creatorName) {
      setSubdomainError('')
      return
    }
    
    const regex = /^[a-z0-9-]+$/
    if (lowerVal && !regex.test(lowerVal)) {
      setSubdomainError('하위 도메인은 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.')
    } else if (lowerVal.length < 3 || lowerVal.length > 20) {
      setSubdomainError('도메인 길이는 3자 이상 20자 이하여야 합니다.')
    } else {
      setSubdomainError('')
    }
  }

  const handleSubdomainSubmit = async () => {
    setIsSubdomainLoading(true)
    setSubdomainError('')
    setSubdomainSuccess('')
    try {
      const res = await updateSubdomainAction(creatorName, newSubdomain)
      if (res.error) {
        setSubdomainError(res.error)
        setShowSubdomainModal(false)
      } else if (res.success && res.redirectUrl) {
        setSubdomainSuccess('도메인이 성공적으로 변경되었습니다! 잠시 후 새로운 주소로 이동합니다...')
        setShowSubdomainModal(false)
        
        // Redirect after showing success message
        setTimeout(() => {
          window.location.href = res.redirectUrl!
        }, 2000)
      }
    } catch (err) {
      setSubdomainError('도메인 변경 처리 중 서버 에러가 발생했습니다.')
      setShowSubdomainModal(false)
      console.error(err)
    } finally {
      setIsSubdomainLoading(false)
    }
  }

  const handleCreate = async () => {
    setIsLoading(true)
    try {
      await createPortfolioAction(creatorName)
      window.location.reload()
    } catch (err) {
      alert('포트폴리오 생성에 실패했습니다.')
    }
    setIsLoading(false)
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deletePortfolioAction(creatorName)
      window.location.reload()
    } catch (err) {
      alert('포트폴리오 제거에 실패했습니다.')
    }
    setIsLoading(false)
  }

  const renderSubdomainSection = () => {
    const isLocalhost = baseDomain.includes('localhost')
    const currentUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${creatorName}.${baseDomain}`
      : `https://${creatorName}.${baseDomain}`

    return (
      <section className="pt-8 border-t border-neutral-150 animate-in fade-in duration-300">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="text-neutral-900" size={20} />
          <h2 className="text-lg font-bold text-neutral-900">개인 하위 도메인 설정</h2>
        </div>
        <p className="text-sm text-neutral-500 font-medium mb-6">
          포트폴리오에 접속할 수 있는 나만의 고유 하위 도메인 주소를 설정하세요.
        </p>

        <div className="p-6 border border-neutral-200 bg-neutral-50/50 rounded-2xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">현재 접속 주소</span>
              <div className="flex items-center gap-2">
                <Link
                  href={currentUrl}
                  target="_blank"
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                >
                  {currentUrl}
                  <span className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    방문하기
                  </span>
                </Link>
              </div>
            </div>
            
            <div className="flex-1 max-w-md">
              <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">
                새 도메인 주소 입력
              </label>
              <div className="flex rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden focus-within:border-black focus-within:ring-1 focus-within:ring-black transition-all">
                <span className="bg-neutral-100 px-3 py-3 text-neutral-400 text-sm font-semibold select-none flex items-center">
                  https://
                </span>
                <input
                  type="text"
                  value={newSubdomain}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  className="flex-1 px-3 py-3 focus:outline-none text-sm font-bold text-neutral-800 bg-transparent"
                  placeholder="domain-name"
                />
                <span className="bg-neutral-50 px-3 py-3 text-neutral-500 text-sm font-bold border-l border-neutral-100 select-none flex items-center">
                  .{baseDomain}
                </span>
              </div>
              
              {subdomainError && (
                <p className="text-xs font-bold text-red-500 mt-2 flex items-center gap-1 animate-in fade-in">
                  <AlertTriangle size={12} className="shrink-0" /> {subdomainError}
                </p>
              )}
              {subdomainSuccess && (
                <p className="text-xs font-bold text-green-600 mt-2 flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 size={12} className="shrink-0" /> {subdomainSuccess}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-neutral-200/65">
            <button
              onClick={() => setShowSubdomainModal(true)}
              disabled={isSubdomainLoading || !!subdomainError || newSubdomain === creatorName || !newSubdomain}
              className="bg-black text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-neutral-800 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubdomainLoading ? '변경 중...' : '도메인 주소 변경'}
            </button>
          </div>
        </div>
      </section>
    )
  }

  const renderSubdomainModal = () => {
    if (!showSubdomainModal) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-amber-500" size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-neutral-900 tracking-tight">도메인 주소를 변경하시겠습니까?</h3>
              <p className="text-sm text-neutral-500 font-medium leading-relaxed">
                도메인을 변경하면 기존 주소로는 더 이상 접속할 수 없게 되며, 모든 포트폴리오 리소스의 연결 경로가 변경됩니다.
              </p>
            </div>
          </div>

          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-neutral-400">기존 주소:</span>
              <span className="text-neutral-600 font-bold line-through">https://{creatorName}.{baseDomain}</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-neutral-400">변경할 주소:</span>
              <span className="text-blue-600 font-black">https://{newSubdomain}.{baseDomain}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowSubdomainModal(false)}
              disabled={isSubdomainLoading}
              className="px-4 py-2.5 bg-neutral-100 text-neutral-600 rounded-lg text-sm font-bold hover:bg-neutral-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubdomainSubmit}
              disabled={isSubdomainLoading}
              className="px-5 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-neutral-800 shadow transition-colors"
            >
              {isSubdomainLoading ? '변경 처리 중...' : '확인 및 변경'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (hasPortfolio) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="p-6 border border-green-200 bg-green-50 rounded-2xl flex items-start gap-4">
          <CheckCircle2 className="text-green-600 mt-1 shrink-0" />
          <div>
            <h3 className="font-bold text-green-900 mb-1">인사이트 포트폴리오가 활성화되었습니다.</h3>
            <p className="text-sm text-green-800/80 mb-4 font-medium">현재 방문자들이 포트폴리오 페이지를 볼 수 있습니다. 메인 화면이나 설정 탭에서 내용을 꾸며보세요.</p>
            <div className="flex gap-3">
              <Link 
                href={`/`}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow hover:bg-green-700 transition-colors"
              >
                내 사이트 꾸미기
              </Link>
              <Link 
                href={`/dashboard/settings`}
                className="bg-white text-green-700 px-5 py-2.5 rounded-lg text-sm font-bold border border-green-200 hover:bg-green-50 transition-colors"
              >
                프로필 내용 수정
              </Link>
            </div>
          </div>
        </div>

        {/* Subdomain Management */}
        {renderSubdomainSection()}

        {/* Danger Zone */}
        <section className="pt-8 border-t border-neutral-100">
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

        {/* Modal */}
        {renderSubdomainModal()}
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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

      {/* Subdomain Management */}
      {renderSubdomainSection()}

      {/* Modal */}
      {renderSubdomainModal()}
    </div>
  )
}


'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Loader2, CheckCircle2 } from 'lucide-react'

import { logout } from '@/app/actions/auth'
import { submitSystemSupport, submitSystemFeedback } from '@/app/actions/contact'
import { canManagePortfolio } from '@/lib/roles'

interface SupportFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  defaultName: string
}

function SupportFeedbackModal({ isOpen, onClose, defaultName }: SupportFeedbackModalProps) {
  const [inquiryType, setInquiryType] = useState<'support' | 'feedback'>('support')
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Reset states when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setInquiryType('support')
      setName(defaultName)
      setEmail('')
      setMessage('')
      setError(null)
      setLoading(false)
      setSuccess(false)
    }
  }, [isOpen, defaultName])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    setError(null)
    setLoading(true)

    try {
      let res
      if (inquiryType === 'support') {
        res = await submitSystemSupport({ name, email, message })
      } else {
        res = await submitSystemFeedback({ name, email, message })
      }

      if (res.success) {
        setSuccess(true)
      } else {
        setError(res.error || '접수 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      setError(err?.message || '네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const isSupport = inquiryType === 'support'

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#282828] border border-[#3f3f3f] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white p-6 flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-[#3f3f3f] pb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all duration-300 ${isSupport ? 'bg-blue-500/20 text-blue-400' : 'bg-violet-500/20 text-violet-400'}`}>
              {isSupport ? '?' : '💡'}
            </div>
            <h3 className="text-lg font-black tracking-tight">고객지원 및 의견 제안</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white hover:bg-[#3f3f3f] p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30">
              <CheckCircle2 size={36} className="animate-bounce" />
            </div>
            <h4 className="text-xl font-bold tracking-tight mb-2">접수가 완료되었습니다</h4>
            <p className="text-neutral-400 text-sm max-w-xs mb-6">
              {isSupport 
                ? '보내주신 소중한 문의 사항을 관리자가 신속하게 검토한 후 답변드리겠습니다.' 
                : '보내주신 소중한 의견과 피드백을 수렴하여 더 나은 서비스를 만들어 가겠습니다.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-semibold">
                {error}
              </div>
            )}

            {/* inquiryType Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400 font-bold">문의 유형</label>
              <div className="grid grid-cols-2 gap-2 bg-[#1e1e1e] p-1 rounded-xl border border-[#3f3f3f]">
                <button
                  type="button"
                  onClick={() => setInquiryType('support')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${isSupport ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'}`}
                >
                  1:1 고객문의
                </button>
                <button
                  type="button"
                  onClick={() => setInquiryType('feedback')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${!isSupport ? 'bg-violet-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'}`}
                >
                  의견 및 개선 제안
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400 font-bold">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                disabled={loading}
                className={`w-full bg-[#1e1e1e] border border-[#3f3f3f] outline-none rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 font-medium transition-all focus:ring-1 ${isSupport ? 'focus:border-blue-500 focus:ring-blue-500' : 'focus:border-violet-500 focus:ring-violet-500'}`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400 font-bold">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                disabled={loading}
                className={`w-full bg-[#1e1e1e] border border-[#3f3f3f] outline-none rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 font-medium transition-all focus:ring-1 ${isSupport ? 'focus:border-blue-500 focus:ring-blue-500' : 'focus:border-violet-500 focus:ring-violet-500'}`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-400 font-bold">상세 내용</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isSupport ? "문의하실 상세 내용을 적어주세요." : "더 멋진 서비스를 만들기 위한 아이디어나 피드백을 자유롭게 들려주세요."}
                rows={4}
                disabled={loading}
                className={`w-full bg-[#1e1e1e] border border-[#3f3f3f] outline-none rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 font-medium transition-all resize-none focus:ring-1 ${isSupport ? 'focus:border-blue-500 focus:ring-blue-500' : 'focus:border-violet-500 focus:ring-violet-500'}`}
              />
            </div>

            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[#3f3f3f]">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-[#3f3f3f] hover:bg-[#4f4f4f] text-neutral-200 text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-5 py-2 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md active:scale-95 disabled:pointer-events-none ${isSupport ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 shadow-blue-500/10' : 'bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 shadow-violet-500/10'}`}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>전송 중...</span>
                  </>
                ) : (
                  <span>{isSupport ? '문의하기' : '의견 전송'}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function UserSidebar({ 

  userName = "사용자 이름", 
  userHandle = "user_id", 
  avatarUrl = "",
  isOwner = false,
  userRole = "creator"
}: { 
  userName?: string, 
  userHandle?: string, 
  avatarUrl?: string,
  isOwner?: boolean,
  userRole?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSupportFeedbackOpen, setIsSupportFeedbackOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const MenuItem = ({ icon, text, hasArrow = false, onClick, className = "", type = "button" }: { icon: React.ReactNode, text: string, hasArrow?: boolean, onClick?: () => void, className?: string, type?: "button" | "submit" | "div" }) => {
    const content = (
      <>
        <div className="flex items-center gap-4">
          <div className="text-neutral-400 flex items-center justify-center w-6 h-6">
            {icon}
          </div>
          <span>{text}</span>
        </div>
        {hasArrow && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        )}
      </>
    )

    const baseClass = `flex items-center justify-between w-full px-4 py-2 hover:bg-[#3f3f3f] transition-colors text-sm text-white font-medium ${className}`

    if (type === "div") {
      return <div className={baseClass}>{content}</div>
    }

    return (
      <button type={type as "button" | "submit"} onClick={onClick} className={baseClass}>
        {content}
      </button>
    )
  }

  const Separator = () => <div className="w-full h-px bg-[#3f3f3f] my-2" />

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Avatar Button */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center text-white border border-neutral-700 hover:border-neutral-500 transition-colors shadow-lg relative"
      >
        <Image src={avatarUrl || '/default_avatar.png'} alt="Avatar" fill className="object-cover" unoptimized />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-[300px] bg-[#282828] border border-[#3f3f3f] rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.5)] z-[100] text-white flex flex-col py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-[#717171] scrollbar-track-transparent">
          
          {/* Profile Section */}
          <div className="flex items-start gap-4 px-4 py-3">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-neutral-200 flex items-center justify-center text-white mt-1 relative">
              <Image src={avatarUrl || '/default_avatar.png'} alt="Avatar" fill className="object-cover" unoptimized />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-base tracking-wide">{userName}</span>
              <span className="text-sm text-neutral-400 font-medium">@{userHandle}</span>
            </div>
          </div>

          <Separator />

          {(() => {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            const baseDomain = isLocal ? 'localhost:3000' : 'craftopia.work'
            const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
            const rootUrl = `${protocol}//${userHandle}.${baseDomain}`

            const hasPortfolioAccess = canManagePortfolio(userRole)

            return (
              <>
                {hasPortfolioAccess ? (
                  <>
                    <Link href={rootUrl}>
                      <MenuItem 
                        type="div"
                        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>} 
                        text="내 포트폴리오로 가기" 
                      />
                    </Link>
                    <Link href={`${rootUrl}/dashboard`}>
                      <MenuItem 
                        type="div"
                        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>} 
                        text="크리에이터 대시보드로 가기" 
                      />
                    </Link>
                  </>
                ) : (
                  <Link href={`${rootUrl}/dashboard`}>
                    <MenuItem 
                      type="div"
                      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>} 
                      text="대시보드로 가기" 
                    />
                  </Link>
                )}
                
                <MenuItem 
                  type="button"
                  onClick={async () => {
                    await logout()
                  }}
                  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>} 
                  text="로그아웃" 
                />

                {hasPortfolioAccess ? (
                  <>
                    <Separator />
                    <Link href={`${rootUrl}/dashboard/settings`}>
                      <MenuItem 
                        type="div"
                        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>} 
                        text="설정" 
                      />
                    </Link>
                  </>
                ) : (
                  <>
                    <Separator />
                    <Link href={`${rootUrl}/dashboard/account`}>
                      <MenuItem 
                        type="div"
                        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>} 
                        text="계정 및 보안 설정" 
                      />
                    </Link>
                  </>
                )}
              </>
            )
          })()}

          <Separator />

          <MenuItem 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>} 
            text="고객지원 및 의견 보내기" 
            onClick={() => {
              setIsOpen(false)
              setIsSupportFeedbackOpen(true)
            }}
          />

        </div>
      )}

      {/* Support & Feedback Modal */}
      <SupportFeedbackModal 
        isOpen={isSupportFeedbackOpen} 
        onClose={() => setIsSupportFeedbackOpen(false)} 
        defaultName={userName} 
      />
    </div>
  )
}

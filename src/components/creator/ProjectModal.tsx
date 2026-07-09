'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLenis } from 'lenis/react'
import SmoothScroll from '@/components/ui/SmoothScroll'

export default function ProjectModal({ children, onClose, title, description, createdAt }: { children: React.ReactNode, onClose?: () => void, title?: string, description?: string, createdAt?: string | Date }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const lenis = useLenis()

  const [mounted, setMounted] = useState(false)
  // 닫기 전환(#7): @modal 병렬 라우트는 router.back() 시 슬롯이 즉시 언마운트되어
  // 그냥 사라진다. 닫기 요청을 가로채 exit 애니메이션을 재생한 뒤 네비게이션해 부드럽게 닫는다.
  const [isClosing, setIsClosing] = useState(false)
  const isClosingRef = useRef(false)

  const EXIT_MS = 220

  const handleClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    if (lenis) lenis.start()

    // 모션 최소화 사용자는 지연 없이 즉시 닫는다(빈 화면 대기 방지).
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const navigate = () => {
      if (onClose) onClose()
      else router.back()
    }

    if (prefersReduced) {
      navigate()
      return
    }

    setIsClosing(true)
    window.setTimeout(navigate, EXIT_MS)
  }

  // 최신 handleClose를 가리키는 ref (Escape 핸들러의 stale closure 방지)
  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

  useEffect(() => {
    setMounted(true)
    if (lenis) {
      lenis.stop()
    }
    // 모달 오픈 시 부모 body의 overflow를 hidden으로 변경하면 브라우저 레이아웃 리플로우로 인해 스크롤이 맨 위로 튕기는 버그 발생.
    // 모달 자체가 fixed full-screen에 data-lenis-prevent를 가지고 있어 hidden 처리 없이도 완벽한 모달 내부 독립 스크롤이 보장됨.
    return () => {
      if (lenis) lenis.start()
    }
  }, [lenis])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle click outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current || e.target === wrapperRef.current) {
      handleClose()
    }
  }

  if (!mounted) return null

  const formattedDate = createdAt ? new Date(createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  // [SIZE:WxH] 또는 [SIZE:W] 메타 지시어 제거용 클렌저
  const cleanTitle = (rawTitle?: string) => {
    if (!rawTitle) return ''
    return rawTitle.replace(/\[\s*SIZE\s*:\s*[1-3]\s*(?:[xX]\s*[1-3])?\s*\]/gi, '').trim()
  }

  return createPortal(
    <div
      data-lenis-prevent
      className={`fixed inset-0 z-[10000] bg-black/90 ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200 ease-out'}`}
    >
      <SmoothScroll isRoot={false} className="h-full w-full overflow-y-auto overscroll-contain">
        <div 
          ref={wrapperRef}
          onClick={handleOverlayClick}
          className="min-h-screen w-full px-0 sm:px-4 md:px-12 lg:px-24 py-8 md:py-12 flex flex-col items-center justify-start relative"
        >
          <button 
            onClick={handleClose}
            className="fixed top-4 right-4 sm:top-6 sm:right-12 lg:right-24 z-[110] w-12 h-12 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg border border-white/20 hover:scale-105 active:scale-95 animate-in fade-in zoom-in duration-300 fill-mode-both"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {(title || description) && (
            <div className="w-full max-w-[1440px] text-left mb-6 px-4 sm:px-8 lg:px-12 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
              {title && <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide drop-shadow-md">{cleanTitle(title)}</h1>}
              {formattedDate && <p className="text-xs text-neutral-400 mt-1 drop-shadow">{formattedDate}</p>}
              {description && (
                <p className="text-xs text-neutral-300 max-w-2xl mt-1 drop-shadow font-medium whitespace-pre-wrap line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          )}

          <div
            className={`w-full max-w-[1440px] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.3)] ring-1 ring-black/5 relative overflow-hidden pointer-events-auto min-h-screen sm:min-h-0 ${isClosing ? 'animate-out fade-out zoom-out-[0.98] slide-out-to-bottom-4 duration-200 fill-mode-forwards' : 'animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-4 duration-300 ease-out'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </SmoothScroll>
    </div>,
    document.body
  )
}

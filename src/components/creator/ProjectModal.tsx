'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ProjectModal({ children, onClose, title, description, createdAt }: { children: React.ReactNode, onClose?: () => void, title?: string, description?: string, createdAt?: string | Date }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  
  const [mounted, setMounted] = useState(false)

  const handleClose = () => {
    if (onClose) onClose()
    else router.back()
  }

  useEffect(() => {
    setMounted(true)
    // 모달 오픈 시 부모 body의 overflow를 hidden으로 변경하면 브라우저 레이아웃 리플로우로 인해 스크롤이 맨 위로 튕기는 버그 발생.
    // 모달 자체가 fixed full-screen에 data-lenis-prevent를 가지고 있어 hidden 처리 없이도 완벽한 모달 내부 독립 스크롤이 보장됨.
    return () => {
      // Clean up if any properties were set
    }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    return rawTitle.replace(/\[SIZE:[1-3](?:x[1-3])?\]/, '').trim()
  }

  return createPortal(
    <div 
      data-lenis-prevent
      className="fixed inset-0 z-[10000] overflow-y-auto overscroll-contain bg-black/90 animate-in fade-in duration-200 ease-out"
      onClick={handleOverlayClick}
      ref={overlayRef}
    >
      <div 
        ref={wrapperRef}
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
          <div className="w-full max-w-[1440px] text-left mb-6 px-4 sm:px-0 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
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
          className="w-full max-w-[1440px] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.3)] ring-1 ring-black/5 relative overflow-hidden animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-4 duration-300 ease-out pointer-events-auto min-h-screen sm:min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

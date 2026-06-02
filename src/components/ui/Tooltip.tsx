'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface TooltipProps {
  text?: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  visualContent?: React.ReactNode
}

export default function Tooltip({ text, children, position = 'top', visualContent }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateCoords = () => {
    if (!wrapperRef.current) return
    
    // wrapperRef.current의 직계 첫 번째 실제 자식 엘리먼트를 탐색하여 정확한 기하 좌표 계산
    const targetEl = wrapperRef.current.firstElementChild || wrapperRef.current
    const rect = targetEl.getBoundingClientRect()
    
    // 스크롤 포지션 반영 절대 좌표 계산
    const scrollX = window.scrollX || window.pageXOffset
    const scrollY = window.scrollY || window.pageYOffset
    
    let t = 0
    let l = rect.left + rect.width / 2 + scrollX

    if (position === 'top') {
      t = rect.top + scrollY - 8 // 꼬리표 마진 포함
    } else if (position === 'bottom') {
      t = rect.bottom + scrollY + 8
    } else if (position === 'left') {
      l = rect.left + scrollX - 8
      t = rect.top + rect.height / 2 + scrollY
    } else if (position === 'right') {
      l = rect.right + scrollX + 8
      t = rect.top + rect.height / 2 + scrollY
    }

    setCoords({ top: t, left: l })
  }

  const handleMouseEnter = () => {
    updateCoords()
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    setIsOpen(false)
  }

  const handlePointerDown = () => {
    setIsOpen(false)
  }

  // Animate UI 의 쫀득쫀득하고 매끄러운 팝업 물리 애니메이션
  const animateVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.85, 
      x: '-50%' as string | number,
      y: (position === 'top' ? 8 : (position === 'bottom' ? -8 : 0)) as string | number
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      x: '-50%' as string | number,
      y: (position === 'top' ? '-100%' : (position === 'bottom' ? 0 : '-50%')) as string | number,
      transition: {
        type: 'spring' as const,
        damping: 15,
        stiffness: 250
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.85, 
      x: '-50%' as string | number,
      y: (position === 'top' ? '-90%' : (position === 'bottom' ? 4 : '-50%')) as string | number,
      transition: {
        duration: 0.12
      }
    }
  }

  if (position === 'left' || position === 'right') {
    animateVariants.hidden.x = position === 'left' ? '0%' : '-100%'
    animateVariants.hidden.y = '-50%'
    animateVariants.visible.x = position === 'left' ? '-100%' : '0%'
    animateVariants.visible.y = '-50%'
    animateVariants.exit.x = position === 'left' ? '-90%' : '-10%'
    animateVariants.exit.y = '-50%'
  }

  // Arrow 위치 및 클래스
  let arrowClass = ''
  if (position === 'top') {
    arrowClass = 'top-full left-1/2 -translate-x-1/2 border-t-neutral-950/90 border-x-transparent border-b-transparent'
  } else if (position === 'bottom') {
    arrowClass = 'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-950/90 border-x-transparent border-t-transparent'
  } else if (position === 'left') {
    arrowClass = 'left-full top-1/2 -translate-y-1/2 border-l-neutral-950/90 border-y-transparent border-r-transparent'
  } else if (position === 'right') {
    arrowClass = 'right-full top-1/2 -translate-y-1/2 border-r-neutral-950/90 border-y-transparent border-l-transparent'
  }

  return (
    <>
      <div
        ref={wrapperRef}
        style={{ display: 'contents' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
      >
        {children}
      </div>
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={animateVariants}
              style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                zIndex: 99999,
              }}
              className={`pointer-events-none bg-neutral-950/95 backdrop-blur-lg text-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.5)] border border-neutral-800/60 p-3.5 flex flex-col items-center justify-center text-center ${visualContent ? 'w-[245px]' : 'whitespace-nowrap text-[12.5px] font-bold px-3 py-1.8'}`}
            >
              {visualContent ? (
                <div className="flex flex-col gap-2.5 w-full items-start text-left">
                  {text && <span className="text-[11.5px] font-extrabold uppercase tracking-widest text-neutral-300 border-b border-white/5 pb-1 block w-full">{text}</span>}
                  {visualContent}
                </div>
              ) : (
                text
              )}
              <div className={`absolute border-[5px] ${arrowClass}`} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

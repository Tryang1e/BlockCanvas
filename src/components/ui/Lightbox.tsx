'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface LightboxProps {
  open: boolean
  images: string[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}

export default function Lightbox({ open, images, index, onClose, onIndexChange }: LightboxProps) {
  const [mounted, setMounted] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => setMounted(true), [])

  const hasMultiple = images.length > 1

  const prev = useCallback(() => {
    setZoomed(false)
    onIndexChange((index - 1 + images.length) % images.length)
  }, [index, images.length, onIndexChange])

  const next = useCallback(() => {
    setZoomed(false)
    onIndexChange((index + 1) % images.length)
  }, [index, images.length, onIndexChange])

  // 키보드 내비게이션 + 바디 스크롤 잠금 (열렸을 때만)
  useEffect(() => {
    if (!open) return
    setZoomed(false)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && images.length > 1) prev()
      else if (e.key === 'ArrowRight' && images.length > 1) next()
    }
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, prev, next, images.length])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && images.length > 0 && (
        <motion.div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* 닫기 */}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="absolute top-5 right-5 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={22} />
          </button>

          {/* 카운터 */}
          {hasMultiple && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 text-white/70 text-sm font-medium tracking-wide select-none">
              {index + 1} / {images.length}
            </div>
          )}

          {/* 이전 */}
          {hasMultiple && (
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              aria-label="이전 이미지"
              className="absolute left-3 sm:left-6 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft size={26} />
            </button>
          )}

          {/* 이미지 */}
          <div className="relative w-full h-full flex items-center justify-center p-6 sm:p-16 overflow-hidden">
            <motion.img
              key={images[index]}
              src={images[index]}
              alt={`확대 이미지 ${index + 1}`}
              onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z) }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: zoomed ? 1.8 : 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`max-w-full max-h-full object-contain select-none shadow-2xl ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              draggable={false}
            />
          </div>

          {/* 다음 */}
          {hasMultiple && (
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              aria-label="다음 이미지"
              className="absolute right-3 sm:right-6 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight size={26} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

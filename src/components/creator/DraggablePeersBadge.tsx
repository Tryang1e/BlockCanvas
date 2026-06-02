'use client'

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import AvatarGroup from '@/components/ui/AvatarGroup'
import { safeStorage } from '@/lib/storage'

export default function DraggablePeersBadge({
  creatorName,
  recommendedCreators
}: {
  creatorName: string
  recommendedCreators: any[]
}) {
  const [isMounted, setIsMounted] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // 1. 컴포넌트 마운트 시 로컬 스토리지에 저장되어 있던 이전 드래그 오프셋 로드
  useEffect(() => {
    setIsMounted(true)
    const savedPos = safeStorage.getItem(`peers-badge-pos-${creatorName}`)
    if (savedPos) {
      try {
        const { offsetKeyX, offsetKeyY } = JSON.parse(savedPos)
        if (typeof offsetKeyX === 'number' && typeof offsetKeyY === 'number') {
          x.set(offsetKeyX)
          y.set(offsetKeyY)
        }
      } catch (e) {
        console.error('Failed to parse saved peers badge position:', e)
      }
    }
  }, [creatorName, x, y])

  // 2. 드래그가 끝났을 때 위치를 저장
  const handleDragEnd = () => {
    const currentX = x.get()
    const currentY = y.get()
    safeStorage.setItem(
      `peers-badge-pos-${creatorName}`,
      JSON.stringify({ offsetKeyX: currentX, offsetKeyY: currentY })
    )
  }

  // 3. 더블 클릭 시 원점으로 미끄러지듯 자석 복구 (Double Click to Reset)
  const handleDoubleClick = () => {
    import('framer-motion').then(({ animate }) => {
      animate(x, 0, { type: 'spring', stiffness: 200, damping: 20 })
      animate(y, 0, { type: 'spring', stiffness: 200, damping: 20 })
      safeStorage.removeItem(`peers-badge-pos-${creatorName}`)
    })
  }

  if (!isMounted) {
    // SSR 시점에는 레이아웃 깨짐을 방지하기 위해 원래 정위치에 고정 마운트
    return (
      <div className="sm:absolute sm:left-[calc(50%+95px)] top-[20%] flex items-center gap-2.5 px-4 py-2.5 bg-black/45 backdrop-blur-2xl rounded-full border border-white/25 shadow-[0_4px_25px_rgba(0,0,0,0.35)] select-none">
        <span className="text-[10px] font-black text-neutral-350 uppercase tracking-widest font-mono">Peers</span>
        <div className="h-3.5 w-[1px] bg-white/25" />
        <AvatarGroup items={recommendedCreators} />
      </div>
    )
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.08}
      onDragEnd={handleDragEnd}
      onDoubleClick={handleDoubleClick}
      style={{ x, y }}
      className="sm:absolute sm:left-[calc(50%+95px)] top-[20%] flex items-center gap-2.5 px-4 py-2.5 bg-black/45 backdrop-blur-2xl rounded-full border border-white/25 shadow-[0_4px_25px_rgba(0,0,0,0.35)] hover:border-blue-500/50 hover:bg-black/65 transition-[border-color,background-color] duration-300 select-none cursor-grab active:cursor-grabbing hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] z-[999]"
      title="드래그하여 원하는 위치에 배치해보세요! (더블 클릭 시 원래 자리로 리셋)"
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 30px rgba(59, 130, 246, 0.25)' }}
    >
      <span className="text-[10px] font-black text-neutral-350 uppercase tracking-widest font-mono pointer-events-none">Peers</span>
      <div className="h-3.5 w-[1px] bg-white/25 pointer-events-none" />
      <div className="pointer-events-none">
        <AvatarGroup items={recommendedCreators} />
      </div>
    </motion.div>
  )
}

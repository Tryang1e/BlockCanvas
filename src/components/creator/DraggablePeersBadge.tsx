'use client'

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import AvatarGroup from '@/components/ui/AvatarGroup'
import { updatePeersBadgePositionAction } from '@/app/actions/profile'

export default function DraggablePeersBadge({
  creatorName,
  recommendedCreators,
  isOwner = false,
  initialX = 0,
  initialY = 0
}: {
  creatorName: string
  recommendedCreators: any[]
  isOwner?: boolean
  initialX?: number
  initialY?: number
}) {
  const [isMounted, setIsMounted] = useState(false)
  const x = useMotionValue(initialX)
  const y = useMotionValue(initialY)

  // 1. 컴포넌트 마운트 및 초기 좌표 동기화
  useEffect(() => {
    setIsMounted(true)
    x.set(initialX)
    y.set(initialY)
  }, [initialX, initialY, x, y])

  // 2. 드래그가 끝났을 때 위치를 DB에 영구 저장
  const handleDragEnd = async () => {
    if (!isOwner) return
    const currentX = x.get()
    const currentY = y.get()
    
    try {
      await updatePeersBadgePositionAction(creatorName, currentX, currentY)
    } catch (e) {
      console.error('Failed to save peers badge position:', e)
    }
  }

  // 3. 더블 클릭 시 원점으로 복구하고 DB에서도 리셋
  const handleDoubleClick = async () => {
    if (!isOwner) return
    const { animate } = await import('framer-motion')
    animate(x, 0, { type: 'spring', stiffness: 200, damping: 20 })
    animate(y, 0, { type: 'spring', stiffness: 200, damping: 20 })

    try {
      await updatePeersBadgePositionAction(creatorName, 0, 0)
    } catch (e) {
      console.error('Failed to reset peers badge position:', e)
    }
  }

  if (!isMounted) {
    // SSR 시점의 레이아웃 어긋남 방지를 위해 서버에서 온 초기 좌표를 스타일로 적용
    return (
      <div 
        className="sm:absolute sm:left-[calc(50%+95px)] top-[20%] flex items-center gap-2.5 px-4 py-2.5 bg-black/45 backdrop-blur-2xl rounded-full border border-white/25 shadow-[0_4px_25px_rgba(0,0,0,0.35)] select-none"
        style={{ transform: `translate(${initialX}px, ${initialY}px)` }}
      >
        <span className="text-[10px] font-black text-neutral-350 uppercase tracking-widest font-mono">Peers</span>
        <div className="h-3.5 w-[1px] bg-white/25" />
        <AvatarGroup items={recommendedCreators} />
      </div>
    )
  }

  return (
    <motion.div
      drag={isOwner}
      dragMomentum={false}
      dragElastic={0.08}
      onDragEnd={handleDragEnd}
      onDoubleClick={handleDoubleClick}
      style={{ x, y }}
      className={`sm:absolute sm:left-[calc(50%+95px)] top-[20%] flex items-center gap-2.5 px-4 py-2.5 bg-black/45 backdrop-blur-2xl rounded-full border border-white/25 shadow-[0_4px_25px_rgba(0,0,0,0.35)] transition-[border-color,background-color] duration-300 select-none z-[999] ${
        isOwner 
          ? 'cursor-grab active:cursor-grabbing hover:border-blue-500/50 hover:bg-black/65 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]' 
          : 'cursor-default'
      }`}
      title={isOwner ? "드래그하여 원하는 위치에 배치해보세요! (더블 클릭 시 원래 자리로 리셋)" : undefined}
      whileDrag={isOwner ? { scale: 1.03, boxShadow: '0 8px 30px rgba(59, 130, 246, 0.25)' } : undefined}
    >
      <span className="text-[10px] font-black text-neutral-350 uppercase tracking-widest font-mono pointer-events-none">Peers</span>
      <div className="h-3.5 w-[1px] bg-white/25 pointer-events-none" />
      <div className="pointer-events-none">
        <AvatarGroup items={recommendedCreators} />
      </div>
    </motion.div>
  )
}

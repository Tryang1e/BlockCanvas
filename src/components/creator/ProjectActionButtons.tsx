'use client'

import React, { useState } from 'react'
import { deleteProjectAction } from '@/app/actions/projects'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Tooltip from '@/components/ui/Tooltip'

export default function ProjectActionButtons({ projectId, creatorName, isOwner }: { projectId: string, creatorName: string, isOwner?: boolean }) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOwner) return null

  const handleDelete = async (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation()
    if (isDeleting) return

    try {
      setIsDeleting(true)
      await deleteProjectAction(projectId, creatorName)
      router.refresh()
      // Note: We don't need to reset isDeleting because the component will unmount
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.')
      console.error(err)
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  if (showConfirm) {
    return (
      <div 
        className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 rounded-sm pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag when interacting with modal
      >
        <p className="text-white font-bold text-sm text-center mb-3">정말로 삭제하시겠습니까?</p>
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}
            className="px-3 py-1.5 bg-neutral-600 text-white text-xs font-bold rounded hover:bg-neutral-500"
            disabled={isDeleting}
          >
            취소
          </button>
          <button 
            onClick={handleDelete}
            className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded hover:bg-red-400"
            disabled={isDeleting}
          >
            {isDeleting ? '삭제 중...' : '삭제 확인'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10 pointer-events-auto">
      <Tooltip text="수정하기" position="bottom">
        <Link 
          href={`/creator/${creatorName}/editor?project_id=${projectId}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="bg-white/90 hover:bg-white text-neutral-800 p-2 rounded-full shadow-md text-xs font-bold w-8 h-8 flex items-center justify-center transition-all cursor-pointer hover:scale-110"
        >
          ✏️
        </Link>
      </Tooltip>
      <Tooltip text="삭제하기" position="bottom">
        <button 
          onPointerDown={(e) => { e.stopPropagation(); setShowConfirm(true); }}
          className="bg-red-500/90 hover:bg-red-500 text-white p-2 rounded-full shadow-md text-xs font-bold w-8 h-8 flex items-center justify-center transition-all cursor-pointer hover:scale-110"
        >
          🗑️
        </button>
      </Tooltip>
    </div>
  )
}

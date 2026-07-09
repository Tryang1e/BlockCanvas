'use client'

import React, { useState, useEffect } from 'react'
import { deleteProjectAction, toggleProjectPublishAction } from '@/app/actions/projects'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Tooltip from '@/components/ui/Tooltip'
import { Eye, EyeOff } from 'lucide-react'

export default function ProjectActionButtons({ projectId, creatorName, isOwner, isPublished = true }: { projectId: string, creatorName: string, isOwner?: boolean, isPublished?: boolean }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const handleTogglePublish = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isToggling) return
    try {
      setIsToggling(true)
      await toggleProjectPublishAction(projectId, creatorName, !isPublished)
      router.refresh()
    } catch (err) {
      alert('공개 상태 변경에 실패했습니다.')
      console.error(err)
      setIsToggling(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOwner) return null
  if (!mounted) return <div className="absolute top-3 right-3 opacity-0 flex gap-2 z-10 w-8 h-8" />

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
      <Tooltip text={isPublished ? '비공개로 전환' : '공개로 전환'} position="bottom">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleTogglePublish}
          disabled={isToggling}
          className={`${isPublished ? 'bg-white/90 hover:bg-white text-neutral-800' : 'bg-amber-500/90 hover:bg-amber-500 text-white'} p-2 rounded-full shadow-md text-xs font-bold w-8 h-8 flex items-center justify-center transition-all cursor-pointer hover:scale-110 disabled:opacity-50`}
        >
          {isPublished ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </Tooltip>
      <Tooltip text="수정하기" position="bottom">
        <Link 
          href={`/editor?project_id=${projectId}`}
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

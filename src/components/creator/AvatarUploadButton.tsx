'use client'

import { useState, useRef } from 'react'
import { uploadFileAction } from '@/app/actions/upload'
import { updateAvatarAction } from '@/app/actions/avatar'
import { useRouter } from 'next/navigation'

export default function AvatarUploadButton({ creatorName, currentAvatar }: { creatorName: string, currentAvatar: string | null }) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const url = await uploadFileAction(formData)
      if (url) {
        await updateAvatarAction(creatorName, url)
        window.location.reload()
      }
    } catch (err) {
      alert('프로필 사진 업로드 실패')
      console.error(err)
    }
    setIsUploading(false)
  }

  return (
    <div className="relative group/avatar cursor-pointer">
      <div 
        className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-neutral-800 bg-neutral-900 overflow-hidden flex items-center justify-center shadow-2xl relative"
        onClick={() => fileInputRef.current?.click()}
      >
        <img src={currentAvatar || '/example5.png'} alt="Profile" className="w-full h-full object-cover" />
        
        {/* Hover Overlay */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${isUploading ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'}`}>
          <span className="text-white font-bold text-xs tracking-widest uppercase">
            {isUploading ? '업로드 중...' : '사진 변경'}
          </span>
        </div>
      </div>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
    </div>
  )
}

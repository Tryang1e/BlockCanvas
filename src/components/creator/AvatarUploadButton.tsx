'use client'

import { useState, useRef } from 'react'
import { updateAvatarAction } from '@/app/actions/avatar'
import { useRouter } from 'next/navigation'
import ImageCropperModal from '@/components/ui/ImageCropperModal'

export default function AvatarUploadButton({ creatorName, currentAvatar }: { creatorName: string, currentAvatar: string | null }) {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setIsCropperOpen(true)
  }

  const handleCropComplete = async (croppedFile: File) => {
    setIsCropperOpen(false)
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', croppedFile)
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '프로필 사진 업로드에 실패했습니다.')
      }
      const data = await response.json()
      const url = data.url
      if (url) {
        await updateAvatarAction(creatorName, url)
        window.location.reload()
      }
    } catch (err: any) {
      alert(err?.message || '프로필 사진 업로드 실패')
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
        <img src={currentAvatar || '/default_avatar.png'} alt="Profile" className="w-full h-full object-cover" />
        
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

      <ImageCropperModal
        isOpen={isCropperOpen}
        file={selectedFile}
        cropType="circle"
        onClose={() => setIsCropperOpen(false)}
        onCrop={handleCropComplete}
      />
    </div>
  )
}

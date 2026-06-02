'use client'

import { useState, useRef } from 'react'
import { updateBannerAction } from '@/app/actions/banner'
import { useRouter } from 'next/navigation'
import ImageCropperModal from '@/components/ui/ImageCropperModal'

export default function BannerUploadButton({ creatorName, currentBanner }: { creatorName: string, currentBanner: string }) {
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
        throw new Error(errorData.error || '배너 업로드에 실패했습니다.')
      }
      const data = await response.json()
      const url = data.url
      if (url) {
        await updateBannerAction(creatorName, url)
        window.location.reload()
      }
    } catch (err: any) {
      alert(err?.message || '배너 업로드 실패')
      console.error(err)
    }
    setIsUploading(false)
  }

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsUploading(true)
    try {
      await updateBannerAction(creatorName, null)
      router.refresh()
    } catch (err) {
      alert('배너 제거 실패')
    }
    setIsUploading(false)
  }

  return (
    <div className="flex gap-4 pointer-events-auto">
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-full shadow-xl transition-all text-sm disabled:opacity-50"
      >
        {isUploading ? '업로드 중...' : '이미지 바꾸기'}
      </button>
      {currentBanner && (
        <button 
          onClick={handleRemove}
          disabled={isUploading}
          className="bg-black/60 hover:bg-black/80 text-white font-bold px-6 py-2.5 rounded-full border border-white/20 transition-all text-sm backdrop-blur-md disabled:opacity-50"
        >
          제거
        </button>
      )}
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
        cropType="rect"
        onClose={() => setIsCropperOpen(false)}
        onCrop={handleCropComplete}
      />
    </div>
  )
}

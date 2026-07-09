'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLenis } from 'lenis/react'

interface ImageCropperModalProps {
  isOpen: boolean
  file: File | null
  cropType: 'circle' | 'rect' // circle for avatar, rect for banner
  onClose: () => void
  onCrop: (croppedFile: File) => void
}

export default function ImageCropperModal({
  isOpen,
  file,
  cropType,
  onClose,
  onCrop
}: ImageCropperModalProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const lenis = useLenis()
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Dimensions of the viewport mask
  const cropWidth = cropType === 'circle' ? 300 : 450
  const cropHeight = cropType === 'circle' ? 300 : 150

  useEffect(() => {
    if (!file) {
      setImgSrc(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(reader.result as string)
      setZoom(1.0)
      setOffset({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }, [file])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const zoomStep = 0.08
      const direction = e.deltaY < 0 ? 1 : -1
      setZoom(prev => Math.min(Math.max(prev + direction * zoomStep, 0.1), 8.0))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [isOpen, imgSrc])

  // Lock body scroll globally when modal is open to prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isOpen])

  // Stop Lenis smooth scrolling when the cropper modal is active to prevent background scrolling
  useEffect(() => {
    if (isOpen && lenis) {
      lenis.stop()
      return () => {
        lenis.start()
      }
    }
  }, [isOpen, lenis])

  if (!isOpen || !imgSrc || !mounted || typeof document === 'undefined') return null

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStart.current.x
    const newY = e.clientY - dragStart.current.y
    setOffset({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      const touch = e.touches[0]
      dragStart.current = {
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    const newX = touch.clientX - dragStart.current.x
    const newY = touch.clientY - dragStart.current.y
    setOffset({ x: newX, y: newY })
  }

  const handleApply = () => {
    const img = imgRef.current
    if (!img) return

    // 4x High-Density Upscaling to prevent blurriness when zoomed in or stretched on full-screen displays
    const upscaleFactor = 4
    const canvas = document.createElement('canvas')
    canvas.width = cropWidth * upscaleFactor
    canvas.height = cropHeight * upscaleFactor
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Enable high-quality image smoothing interpolation for high-resolution upscaling
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate natural rendering scales
    // We need to map the visual layout coordinate system back to the image's original dimensions
    const displayWidth = img.clientWidth * zoom
    const displayHeight = img.clientHeight * zoom

    // Source image dimensions
    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight

    // Calculate scaling ratio
    const scaleX = naturalWidth / img.clientWidth
    const scaleY = naturalHeight / img.clientHeight

    // Relative offset of visual image inside the crop window
    // Visual crop window is centered in the container
    // Visual container is 500x400
    const containerWidth = 500
    const containerHeight = 400

    const cropWindowX = (containerWidth - cropWidth) / 2
    const cropWindowY = (containerHeight - cropHeight) / 2

    // The current image position relative to the crop window top-left corner
    // Image visual left = containerWidth/2 + offset.x - (img.clientWidth * zoom)/2
    // Image visual top = containerHeight/2 + offset.y - (img.clientHeight * zoom)/2
    const imgVisualLeft = (containerWidth / 2) + offset.x - (displayWidth / 2)
    const imgVisualTop = (containerHeight / 2) + offset.y - (displayHeight / 2)

    // Offset relative to the crop viewport
    const relX = imgVisualLeft - cropWindowX
    const relY = imgVisualTop - cropWindowY

    // Draw onto canvas with 4x high-resolution multiplier
    ctx.drawImage(
      img,
      0, 0, naturalWidth, naturalHeight, // source rect
      relX * upscaleFactor, relY * upscaleFactor, displayWidth * upscaleFactor, displayHeight * upscaleFactor // destination rect
    )

    // Export cropped canvas to file
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], file?.name || 'cropped-image.png', {
          type: 'image/png',
          lastModified: Date.now()
        })
        onCrop(croppedFile)
      }
    }, 'image/png')
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300"
      data-lenis-prevent="true"
    >
      <div 
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-between"
        onMouseUp={handleMouseUp}
      >
        {/* Header */}
        <div className="w-full px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-black/20">
          <span className="text-sm font-bold text-white tracking-widest uppercase">
            {cropType === 'circle' ? '프로필 사진 편집' : '배너 이미지 편집'}
          </span>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xs font-bold uppercase transition-colors"
          >
            취소
          </button>
        </div>

        {/* Viewport Container */}
        <div 
          ref={containerRef}
          className="relative w-[500px] h-[400px] bg-black/90 overflow-hidden flex items-center justify-center cursor-move select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          {/* Draggable Image */}
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Cropping View"
              className="max-w-full max-h-full pointer-events-none select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              draggable={false}
            />
          )}

          {/* Mask Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {cropType === 'circle' ? (
              <div 
                className="rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]" 
                style={{ width: `${cropWidth}px`, height: `${cropHeight}px` }}
              />
            ) : (
              <div 
                className="border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]" 
                style={{ width: `${cropWidth}px`, height: `${cropHeight}px` }}
              />
            )}
          </div>
        </div>

        {/* Zoom Slider Control */}
        <div className="w-full px-8 py-5 border-t border-neutral-800 bg-black/10 flex flex-col gap-3">
          <div className="flex justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-widest">
            <span>크기 조절 (Zoom)</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="8.0"
            step="0.02"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-white bg-neutral-800 h-1 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Action Buttons */}
        <div className="w-full px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            취소 (Cancel)
          </button>
          <button
            onClick={handleApply}
            className="bg-white hover:bg-neutral-200 text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg transition-all"
          >
            적용하기 (Apply)
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

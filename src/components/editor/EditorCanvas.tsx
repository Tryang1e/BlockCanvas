'use client'

import Link from 'next/link'
import Image from 'next/image'
import PublishSettingsModal from '@/components/editor/PublishSettingsModal'
import ProjectDetailsViewer from '@/components/creator/ProjectDetailsViewer'
import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import RichTextEditor from './RichTextEditor'
import { getProfileForPreviewAction } from '@/app/actions/profile'
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import { Tweet } from 'react-tweet'
import ReactPlayer from 'react-player'





// Types
type WidgetType = 'text' | 'image_grid' | 'video' | 'embed'

type Widget = {
  id: string
  type: WidgetType
  content: any
}

type Draft = {
  sessionId: string;
  projectId: string | null;
  updatedAt: number;
  previewText: string;
  widgets: Widget[];
}

// -------------------------------------------------------------
// Sidebar Sortable Miniature Map Item Component
// -------------------------------------------------------------
function SidebarSortableItem({ id, widget, idx, onDelete, onClick }: { id: string; widget: Widget; idx: number; onDelete: () => void; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.35 : 1,
  }

  // Generate clean preview based on widget type
  let icon = '📝'
  let label = '텍스트'
  let labelStyle = 'bg-blue-50 text-blue-600 border-blue-100'
  let preview = '내용 없음'

  if (widget.type === 'text') {
    icon = '📝'
    label = '텍스트'
    labelStyle = 'bg-blue-50 text-blue-600 border-blue-100'
    const rawHtml = typeof widget.content === 'string' ? widget.content : ''
    const cleanText = rawHtml.replace(/<[^>]*>/g, '').trim()
    preview = cleanText ? (cleanText.substring(0, 16) + (cleanText.length > 16 ? '...' : '')) : '빈 텍스트 블록'
  } else if (widget.type === 'image_grid') {
    icon = '🖼️'
    label = '이미지'
    labelStyle = 'bg-emerald-50 text-emerald-600 border-emerald-100'
    const imagesCount = Array.isArray(widget.content) ? widget.content.length : 0
    preview = `사진 그리드 · ${imagesCount}장`
  } else if (widget.type === 'video') {
    icon = '▶'
    label = '미디어'
    labelStyle = 'bg-rose-50 text-rose-600 border-rose-100'
    preview = widget.content ? '비디오/오디오 스트리머' : '파일 업로드 대기중'
  } else if (widget.type === 'embed') {
    icon = '🔗'
    label = '임베드'
    labelStyle = 'bg-purple-50 text-purple-600 border-purple-100'
    const codeStr = typeof widget.content === 'string'
      ? widget.content
      : (widget.content && typeof widget.content === 'object' && (widget.content as any).html)
        ? (widget.content as any).html
        : ''
    if (codeStr.includes('twitter.com') || codeStr.includes('x.com')) {
      preview = 'X (트위터) 트윗 연동'
    } else if (codeStr.includes('youtube.com') || codeStr.includes('youtu.be')) {
      preview = 'YouTube 플레이어 연동'
    } else {
      preview = codeStr ? '외부 연동 프레임' : '링크/임베드 주소 입력 대기'
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`group select-none flex items-center gap-3 p-3 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200/60 hover:border-neutral-300 rounded-xl cursor-pointer transition-[box-shadow,background-color,border-color] duration-200 ease-out shadow-sm ${isDragging ? 'shadow-lg border-indigo-400 bg-indigo-50/10' : ''}`}
    >
      {/* Grab Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 px-2 py-2 text-sm font-black transition-colors select-none"
        onClick={(e) => e.stopPropagation()}
      >
        ⣿
      </div>

      {/* Info Core */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs shrink-0">{icon}</span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${labelStyle}`}>
            {label}
          </span>
          <span className="text-[9px] text-neutral-400 font-mono font-bold">#{idx + 1}</span>
        </div>
        <p className="text-[10px] text-neutral-600 font-bold truncate leading-none mt-1">
          {preview}
        </p>
      </div>

      {/* Delete button wrapper */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[11px] text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md shadow-sm border border-transparent hover:border-red-100 bg-white"
        title="이 블록 삭제"
      >
        🗑
      </button>
    </div>
  )
}

// -------------------------------------------------------------
// Sortable Wrapper Component
// -------------------------------------------------------------
function SortableWidget({ id, type, children, onDelete }: { id: string, type: string, children: React.ReactNode, onDelete: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div 
      id={`widget-card-${id}`}
      ref={setNodeRef} 
      style={style} 
      className={`relative flex mb-8 flex-col group focus-within:z-30 rounded-3xl transition-[box-shadow,background-color] duration-250 ease-out ${isDragging ? 'shadow-2xl' : ''}`}
    >
      {/* Drag Handle Badge - Absolute positioned on top of the border */}
      <div
        {...attributes}
        {...listeners}
        style={{ position: 'absolute', top: '-12px', left: '16px', zIndex: 10 }}
        className="cursor-move flex items-center gap-2 hover:text-neutral-800 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.06),_0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] hover:scale-[1.02] text-xs font-bold uppercase tracking-widest text-neutral-400 hover:border-neutral-300 select-none transition-all duration-250 ease-out"
      >
        <span className="text-[10px]">⣿</span> {type.replace('_', ' ')} BLOCK
      </div>

      {/* Delete Button - Absolute positioned on top of the border */}
      <div style={{ position: 'absolute', top: '-12px', right: '16px', zIndex: 10 }}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (isConfirming) {
              onDelete();
            } else {
              setIsConfirming(true);
              setTimeout(() => setIsConfirming(false), 3000);
            }
          }}
          className={`p-1.5 text-xs border rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.06),_0_1px_3px_rgba(0,0,0,0.02)] hover:scale-[1.05] transition-all duration-250 ease-out ${isConfirming ? 'text-white bg-red-500 border-red-500 font-bold px-3' : 'bg-white border-neutral-200 hover:text-red-500 hover:border-red-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] text-neutral-400'}`}
          title={isConfirming ? '한 번 더 클릭하면 완전히 삭제됩니다' : '삭제하기'}
        >
          {isConfirming ? '삭제 확정' : '🗑'}
        </button>
      </div>

      <div className="w-full">
        {children}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Image Grid Component (Local Upload)
// -------------------------------------------------------------
function ImageGridWidget({ urls, onChange }: { urls: string[], onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setUploading(true)
    const newUrls = [...(urls || [])]

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]
      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '이미지 업로드에 실패했습니다.')
        }
        const data = await response.json()
        if (data.url) newUrls.push(data.url)
      } catch (err: any) {
        console.error(err)
        alert(err?.message || '이미지 업로드에 실패했습니다.')
      }
    }
    onChange(newUrls)
    setUploading(false)
  }

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-md p-4 shadow-sm">
      {(!urls || urls.length === 0) && (
        <label className="flex flex-col items-center justify-center p-12 py-20 border-2 border-dashed border-neutral-300 rounded-md cursor-pointer hover:bg-blue-50/50 hover:border-blue-300 transition-all group">
          <span className="bg-blue-600 text-white font-bold px-6 py-2 rounded-full mb-3 shadow group-hover:scale-105 transition-transform">+ 미디어 사진 업로드</span>
          <span className="text-xs text-neutral-400 font-medium">여러 장을 선택하면 그리드로 자동 배치됩니다 (로컬 드라이브 저장)</span>
          <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}

      {urls && urls.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5 w-full">
            {urls.map((url, idx) => {
              const getFlexBasis = (i: number, total: number) => {
                if (total === 1) return '100%';
                const remainder = total % 3;
                if (remainder === 0) {
                  return '31.5%';
                } else if (remainder === 2) {
                  return i >= total - 2 ? '48%' : '31.5%';
                } else { // remainder === 1
                  return i >= total - 4 ? '48%' : '31.5%';
                }
              };

              return (
                <div 
                  key={idx} 
                  className="relative group overflow-hidden flex-grow"
                  style={{ flexBasis: getFlexBasis(idx, urls.length) }}
                >
                  {urls.length === 1 ? (
                    <img src={url} alt="Uploaded block" className="w-full h-auto block mx-auto" />
                  ) : (
                    <img src={url} alt="Uploaded block" className="w-full h-full aspect-video object-cover block mx-auto transition-all duration-500 group-hover:scale-105" />
                  )}
                  <button
                    onClick={() => onChange(urls.filter((_, i) => i !== idx))}
                    className="absolute top-3 right-3 bg-red-500/90 text-white w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-sm shadow-md z-10"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-2 border-t border-neutral-100 mt-2">
            <label className="text-xs font-bold text-blue-600 cursor-pointer hover:underline uppercase tracking-wide">
              + 사진 추가 연동
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}

      {uploading && <div className="text-center py-4 text-xs font-bold text-blue-500 animate-pulse">이미지 업로드 중...</div>}
    </div>
  )
}

// -------------------------------------------------------------
// Video / Audio Component (1GB Limit)
// -------------------------------------------------------------
function MediaWidget({ url, onChange }: { url: string, onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Extremely safe URL normalization defensively
  const safeUrl = (() => {
    if (!url) return ''
    if (typeof url === 'object') {
      return (url as any).url || (url as any).html || ''
    }
    if (typeof url === 'string') {
      const trimmed = url.trim()
      if (trimmed === '[object Object]') {
        return ''
      }
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed)
          return parsed.url || parsed.html || trimmed
        } catch (e) {
          return trimmed
        }
      }
      return trimmed
    }
    return String(url)
  })()

  const [inputUrl, setInputUrl] = useState(safeUrl || '')
  const [isEditing, setIsEditing] = useState(!safeUrl)

  // Sync state if url changes externally (e.g., loaded draft)
  useEffect(() => {
    setInputUrl(safeUrl || '')
    setIsEditing(!safeUrl)
  }, [safeUrl])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const file = e.target.files[0]

    // Client Side Size Check (1GB)
    if (file.size > 1024 * 1024 * 1024) {
      setErrorMsg('용량이 1GB를 초과하는 파일은 업로드할 수 없습니다.')
      return
    }

    setErrorMsg('')
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '업로드에 실패했습니다.')
      }
      const data = await response.json()
      if (data.url) {
        onChange(data.url)
        setIsEditing(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || '업로드 중 오류가 발생했습니다.')
      console.error(err)
    }
    setUploading(false)
  }

  const applyUrl = () => {
    const trimmed = inputUrl.trim()
    if (!trimmed) return
    onChange(trimmed)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyUrl()
    }
  }

  const handleEditStart = () => {
    setInputUrl(safeUrl)
    setIsEditing(true)
  }

  const isAudio = safeUrl && safeUrl.match(/\.(mp3|wav|ogg)$/i)
  const isExternalVideo = safeUrl && !isAudio && (
    safeUrl.includes('youtube.com') || 
    safeUrl.includes('youtu.be') || 
    safeUrl.includes('vimeo.com') || 
    safeUrl.includes('twitch.tv')
  )

  useEffect(() => {
    console.log('[MediaWidget] Raw URL Prop:', url)
    console.log('[MediaWidget] Safe Extracted URL:', safeUrl)
    console.log('[MediaWidget] isExternalVideo Evaluated:', isExternalVideo)
    console.log('[MediaWidget] isAudio Evaluated:', isAudio)
  }, [url, safeUrl, isExternalVideo, isAudio])

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-md p-4 shadow-sm">
      {isEditing ? (
        <div className="w-full flex flex-col md:flex-row items-stretch gap-6 min-h-[220px]">
          {/* Left Column: Local Media File Upload */}
          <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-200 hover:border-red-300 rounded-xl cursor-pointer hover:bg-red-50/20 transition-all group relative">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 3 3m-3-3v12" />
              </svg>
            </div>
            <span className="text-sm font-bold text-neutral-700 mb-1 group-hover:text-red-600 transition-colors">📁 로컬 미디어 파일 업로드</span>
            <span className="text-[11px] text-neutral-400 font-medium text-center leading-normal">
              MP4, WEBM, MP3 파일<br />(최대 1GB 제한)
            </span>
            <input type="file" accept="video/*,audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

          {/* Divider */}
          <div className="flex md:flex-col items-center justify-center gap-3 py-2 md:py-0">
            <div className="h-[1px] md:h-12 w-12 md:w-[1px] bg-neutral-200" />
            <span className="text-xs font-extrabold text-neutral-400 bg-neutral-50 px-2 py-1 rounded-full border border-neutral-100 uppercase tracking-wider select-none">또는</span>
            <div className="h-[1px] md:h-12 w-12 md:w-[1px] bg-neutral-200" />
          </div>

          {/* Right Column: YouTube & Streaming Link Paste */}
          <div className="flex-1 flex flex-col justify-center p-6 bg-slate-50/50 border border-neutral-100 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-rose-100 text-rose-600 flex items-center justify-center text-xs">
                ▶
              </div>
              <span className="text-sm font-bold text-neutral-700">스트리밍 주소 연동</span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium leading-normal mb-3">
              유튜브, 비메오, 트위치 등 스트리밍 주소를 입력하면 실시간 플레이어로 재생됩니다.
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <button
                onClick={applyUrl}
                className="bg-red-600 text-white font-extrabold text-xs px-4 py-2 rounded-lg shadow-sm hover:bg-red-700 transition-all active:scale-95 shrink-0"
              >
                연동
              </button>
            </div>
            
            {safeUrl && (
              <button
                onClick={() => setIsEditing(false)}
                className="mt-3 text-[10px] font-bold text-neutral-400 hover:text-neutral-600 self-end transition-colors"
              >
                취소하고 돌아가기
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full relative group">
          {isAudio ? (
            <audio src={safeUrl} controls className="w-full max-w-md my-6 outline-none rounded" />
          ) : isExternalVideo ? (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black shadow-md border border-neutral-800 relative">
              {/* @ts-ignore */}
              <ReactPlayer src={safeUrl} width="100%" height="100%" controls />
            </div>
          ) : (
            <video src={safeUrl} controls className="w-full h-auto max-h-[800px] bg-black rounded shadow" />
          )}

          {/* Interactive Overlay when hovering over the preview */}
          <div className="absolute inset-0 z-10 hover:bg-black/5 transition-colors cursor-pointer rounded-lg" onClick={handleEditStart}>
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="bg-white/95 border border-neutral-200 text-neutral-700 text-[11px] font-extrabold px-3 py-1.5 rounded-full shadow-md hover:bg-white hover:text-red-600 transition-all flex items-center gap-1.5 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                미디어 교체 / 링크 수정
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div className="mt-2 mb-2 text-xs text-red-500 font-bold text-center">{errorMsg}</div>}

      {uploading && <div className="text-center py-4 text-xs font-bold text-red-500 animate-pulse">대용량 미디어 업로드 중... 창을 닫지 마세요.</div>}
    </div>
  )
}

// -------------------------------------------------------------
// Embed Component (iFrame)
// -------------------------------------------------------------
function EmbedWidget({ code, onChange }: { code: string, onChange: (code: string) => void }) {
  // code가 객체로 넘어올 경우(예: { html: "..." })를 위한 방어형 복원 로직
  const safeCode = typeof code === 'string'
    ? code
    : (code && typeof code === 'object' && (code as any).html)
      ? (code as any).html
      : ''

  const [inputCode, setInputCode] = useState(safeCode || '')
  const [isEditing, setIsEditing] = useState(!safeCode)

  const applyEmbed = () => {
    onChange(inputCode.trim())
    setIsEditing(false)
  }

  // Detect Tweet URL
  const tweetMatch = safeCode?.match(/twitter\.com\/.*\/status\/(\d+)|x\.com\/.*\/status\/(\d+)/)
  const tweetId = tweetMatch ? (tweetMatch[1] || tweetMatch[2]) : null

  // Detect general Video URL (YouTube, Vimeo, etc)
  const isVideoUrl = safeCode && !safeCode.includes('<iframe') && !tweetId && (safeCode.includes('youtube.com') || safeCode.includes('youtu.be') || safeCode.includes('vimeo.com') || safeCode.includes('twitch.tv'))

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-md p-4 shadow-sm flex flex-col items-center">
      {isEditing ? (
        <div className="w-full flex flex-col gap-3">
          <h4 className="text-sm font-bold text-neutral-700 uppercase">🔗 링크 / 임베드 삽입</h4>
          <p className="text-xs text-neutral-500">X(트위터), YouTube 링크를 붙여넣거나 &lt;iframe&gt; 코드를 직접 입력하세요.</p>
          <textarea
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            rows={3}
            className="w-full border border-neutral-300 bg-slate-50 text-neutral-900 placeholder:text-neutral-400 rounded p-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-inner"
            placeholder="https://x.com/username/status/123456789 또는 유튜브 링크"
          />
          <div className="flex justify-end gap-2 mt-2">
            {safeCode && <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-neutral-500 hover:text-neutral-800 py-2 px-4 transition-colors">취소</button>}
            <button onClick={applyEmbed} className="bg-purple-600 text-white font-bold text-xs py-2 px-6 rounded shadow hover:bg-purple-700 transition-colors">적용하기</button>
          </div>
        </div>
      ) : (
        <div className="w-full relative group">
          <div className="w-full flex justify-center bg-neutral-50 rounded p-4 py-6 overflow-hidden min-h-[100px]">
            {tweetId ? (
              <div className="light w-full max-w-lg flex justify-center pointer-events-none">
                <Tweet id={tweetId} />
              </div>
            ) : isVideoUrl ? (
              <div className="w-full max-w-3xl aspect-video relative pointer-events-none">
                {/* @ts-ignore */}
                <ReactPlayer url={safeCode} width="100%" height="100%" controls />
              </div>
            ) : (
              <div className="w-full flex justify-center pointer-events-none" dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? sanitizeRichHtml(safeCode) : safeCode }} />
            )}
          </div>

          {/* Interactive Overlay to prevent accidental clicks while dragging, but allow editing */}
          <div className="absolute inset-0 z-10 hover:bg-black/5 transition-colors cursor-pointer" onClick={() => setIsEditing(true)}>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="bg-white/90 border border-neutral-200 text-neutral-700 text-xs font-bold px-3 py-1 rounded shadow-md hover:bg-white transition-colors">
                코드/링크 수정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Onboarding Creator Guide Accordion Definitions
// -------------------------------------------------------------
interface GuideAccordionItem {
  id: number
  title: string
  subtitle: string
  description: string
  icon: string
  badge: string
  renderVisual: () => React.ReactNode
}

const CursorSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="drop-shadow-md select-none pointer-events-none">
    <path d="M4 4L12 20L15 15L20 12L4 4Z" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

const GUIDE_ACCORDIONS: GuideAccordionItem[] = [
  {
    id: 0,
    title: "1. 블록 순서 정렬",
    subtitle: "드래그 핸들(⠿)을 끌어 상하 순서를 교체합니다.",
    description: "각 블록 좌측 상단의 ⠿ 드래그 영역을 마우스로 잡고 위아래로 끌어다 놓아 순서를 스왑 정렬할 수 있습니다.",
    icon: "↕",
    badge: "Drag & Drop",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex flex-col justify-center items-center gap-5 overflow-hidden select-none">
        <div className="w-60 h-10 bg-neutral-900 border border-neutral-800 rounded-lg relative block-a-anim flex items-center px-3 shadow-md">
          <div className="absolute top-[-8px] left-[10px] bg-[#18181b] border border-neutral-800 rounded px-1.5 py-0.5 text-[6px] font-bold text-neutral-400 shadow-sm flex items-center gap-1">
            <span>⣿</span> TEXT BLOCK
          </div>
          <div className="absolute top-[-8px] right-[10px] bg-[#18181b] border border-neutral-800 rounded p-0.5 text-[6px] text-neutral-400">
            🗑
          </div>
          <div className="text-[7px] text-neutral-500 font-mono mt-1">내용을 입력하세요...</div>
        </div>
        <div className="w-60 h-10 bg-neutral-900 border border-neutral-800 rounded-lg relative block-b-anim flex items-center px-3 shadow-md">
          <div className="absolute top-[-8px] left-[10px] bg-[#18181b] border border-neutral-800 rounded px-1.5 py-0.5 text-[6px] font-bold text-neutral-400 shadow-sm flex items-center gap-1">
            <span>⣿</span> IMAGE BLOCK
          </div>
          <div className="absolute top-[-8px] right-[10px] bg-[#18181b] border border-neutral-800 rounded p-0.5 text-[6px] text-neutral-400">
            🗑
          </div>
          <div className="text-[7px] text-neutral-500 font-mono mt-1">🖼️ 업로드된 사진 파일</div>
        </div>
        <div className="absolute mouse-grab-anim">
          <CursorSvg />
        </div>
      </div>
    )
  },
  {
    id: 1,
    title: "2. 텍스트 블록",
    subtitle: "문단을 작성하고 내용을 편집하는 기본 영역입니다.",
    description: "자유롭게 본문 글을 작성하고 엔터를 입력하여 문단을 생성하는 에디터의 가장 본질적인 텍스트 영역입니다.",
    icon: "📝",
    badge: "Text Block",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex flex-col justify-center items-center select-none">
        <div className="w-60 bg-neutral-900/60 border border-neutral-800 rounded-lg p-3 pt-4 text-left relative shadow-md">
          <div className="absolute top-[-8px] left-[10px] bg-[#18181b] border border-neutral-800 rounded px-1.5 py-0.5 text-[6px] font-bold text-neutral-400 shadow-sm flex items-center gap-1">
            <span>⣿</span> TEXT BLOCK
          </div>
          <div className="absolute top-[-8px] right-[10px] bg-[#18181b] border border-neutral-800 rounded p-0.5 text-[6px] text-neutral-400">
            🗑
          </div>
          <div className="text-[10px] text-neutral-300 font-mono tracking-wide min-h-[16px] flex items-center mt-1">
            <span className="typing-text-anim"></span>
            <span className="w-1.5 h-3.5 bg-indigo-500 inline-block caret-blink-anim ml-0.5" />
          </div>
          <div className="w-full h-1 bg-neutral-850 rounded-full mt-2.5 opacity-60" />
          <div className="w-4/5 h-1 bg-neutral-850 rounded-full mt-1.5 opacity-40" />
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: "3. 포토 그리드",
    subtitle: "여러 이미지를 올리면 격자형 그리드로 자동 배치됩니다.",
    description: "다중 이미지 업로드 시 가로 폭과 그리드 구성을 자동 계산하여 다채로운 연출을 지원하는 미디어 갤러리입니다.",
    icon: "🖼️",
    badge: "Image Grid",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex items-center justify-center select-none">
        <div className="w-60 bg-neutral-900/60 border border-neutral-800 rounded-lg p-3 pt-4 relative shadow-md">
          <div className="absolute top-[-8px] left-[10px] bg-[#18181b] border border-neutral-800 rounded px-1.5 py-0.5 text-[6px] font-bold text-neutral-400 shadow-sm flex items-center gap-1">
            <span>⣿</span> IMAGE GRID BLOCK
          </div>
          <div className="absolute top-[-8px] right-[10px] bg-[#18181b] border border-neutral-800 rounded p-0.5 text-[6px] text-neutral-400">
            🗑
          </div>
          <div className="flex gap-2 mt-1">
            <div className="flex-1 h-14 bg-neutral-800 border border-neutral-700/50 rounded overflow-hidden relative flex items-center justify-center img-grid-anim-1">
              <span className="text-lg opacity-45">🖼️</span>
            </div>
            <div className="flex-1 h-14 bg-neutral-800 border border-neutral-700/50 rounded overflow-hidden relative flex items-center justify-center img-grid-anim-2">
              <span className="text-lg opacity-45">🖼️</span>
            </div>
            <div className="flex-1 h-14 bg-neutral-800 border border-neutral-700/50 rounded overflow-hidden relative flex items-center justify-center img-grid-anim-3">
              <span className="text-lg opacity-45">🖼️</span>
            </div>
          </div>
          <div className="text-[8px] text-neutral-500 font-bold text-center mt-2.5 uppercase tracking-wider">
            Grid Auto Layout System
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: "4. 비디오 & 오디오",
    subtitle: "미디어 파일을 스트리밍 재생하고 타임라인을 확인합니다.",
    description: "최대 1GB 대용량 MP4, MP3 파일을 에디터 내부 스토리지에 업로드하여 다이렉트 재생 플레이어로 띄웁니다.",
    icon: "▶",
    badge: "Media Widget",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex items-center justify-center select-none">
        <div className="w-60 bg-neutral-900 border border-neutral-800 rounded-lg p-3 pt-4 flex flex-col gap-2 relative shadow-md">
          <div className="absolute top-[-8px] left-[10px] bg-[#18181b] border border-neutral-800 rounded px-1.5 py-0.5 text-[6px] font-bold text-neutral-400 shadow-sm flex items-center gap-1">
            <span>⣿</span> VIDEO BLOCK
          </div>
          <div className="absolute top-[-8px] right-[10px] bg-[#18181b] border border-neutral-800 rounded p-0.5 text-[6px] text-neutral-400">
            🗑
          </div>
          <div className="h-16 bg-neutral-950 border border-neutral-850 rounded relative flex items-center justify-center overflow-hidden mt-1">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-md play-btn-anim z-10">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white" className="ml-0.5">
                <path d="M8 5V19L19 12L8 5Z" />
              </svg>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 playbar-progress-anim" />
            </div>
            <span className="text-[8px] text-neutral-400 font-mono time-count-anim" />
          </div>
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: "5. 외부 링크 임베드",
    subtitle: "유튜브나 트위터 링크를 붙여넣어 화면에 삽입합니다.",
    description: "URL을 삽입하면 백엔드 샌드박스 보안 처리를 거쳐 실제 반응형 플레이어로 인터랙티브하게 변환합니다.",
    icon: "🔗",
    badge: "iFrame Embed",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex items-center justify-center select-none">
        <div className="w-60 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 pt-4 flex flex-col gap-2 relative shadow-md">
          <div className="absolute top-[-8px] left-[10px] bg-[#18181b] border border-neutral-800 rounded px-1.5 py-0.5 text-[6px] font-bold text-neutral-400 shadow-sm flex items-center gap-1">
            <span>⣿</span> EMBED BLOCK
          </div>
          <div className="absolute top-[-8px] right-[10px] bg-[#18181b] border border-neutral-800 rounded p-0.5 text-[6px] text-neutral-400">
            🗑
          </div>
          <div className="h-6 bg-neutral-950 border border-neutral-850 rounded px-2 flex items-center text-[8px] text-neutral-400 font-mono mt-1">
            <span className="embed-type-anim"></span>
            <span className="w-1 h-2.5 bg-neutral-500 inline-block caret-blink-anim ml-0.5" />
          </div>
          <div className="h-14 bg-neutral-950 border border-neutral-850 rounded relative flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full embed-spinner-anim absolute" />
            <div className="w-full h-full bg-[#1e1e24] flex flex-col items-center justify-center gap-1.5 embed-player-anim">
              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white" className="ml-0.5">
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </div>
              <span className="text-[7px] text-neutral-400 tracking-wider font-bold">YouTube Player Connected</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 5,
    title: "6. 텍스트 애니메이션",
    subtitle: "글자를 드래그하여 버블 메뉴에서 화려한 효과를 입힙니다.",
    description: "블록 내부의 원하는 글자 범위를 드래그하면 띄워지는 버블 메뉴에서 ✨ 효과를 선택해 타이핑, 펄서 등 효과를 부여합니다.",
    icon: "✨",
    badge: "Text Effects",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex flex-col items-center justify-center select-none overflow-hidden">
        <div className="absolute bg-[#222] border border-neutral-800 rounded p-1 px-1.5 flex items-center gap-1.5 shadow-xl bubble-menu-anim z-10 scale-95">
          <span className="text-[8px] text-neutral-500 font-bold px-1 py-0.5 border border-neutral-850 rounded">B</span>
          <span className="text-[8px] text-neutral-500 font-bold px-1 py-0.5 border border-neutral-850 rounded">I</span>
          <span className="text-[8px] text-indigo-400 font-bold px-1.5 py-0.5 border border-indigo-900/60 bg-indigo-950/40 rounded flex items-center gap-0.5 scale-105">
            ✨ Effect
          </span>
          <span className="text-[8px] text-neutral-500 font-bold px-1 py-0.5 border border-neutral-850 rounded">🔗</span>
        </div>
        <div className="w-60 bg-neutral-900/60 border border-neutral-800 rounded p-3 text-center relative mt-4">
          <div className="text-[10px] text-white font-bold flex items-center justify-center gap-1">
            <span>Make it</span>
            <span className="relative inline-block text-indigo-300 shimmer-effect-anim">
              <div className="absolute inset-0 bg-blue-600/30 rounded highlight-sweep-anim z-0" />
              <span className="relative z-10">Creative</span>
            </span>
          </div>
        </div>
        <div className="absolute click-menu-anim z-20">
          <CursorSvg />
        </div>
      </div>
    )
  },
  {
    id: 6,
    title: "7. 버튼 스타일 링크",
    subtitle: "텍스트 범위 선택 후 버튼 스타일의 링크를 생성합니다.",
    description: "버블 메뉴의 🔗 (링크) 버튼 클릭 시, 아웃링크를 일반 텍스트 대신 화려하고 세련된 박스형 버튼 형태로 꾸밀 수 있습니다.",
    icon: "⬚",
    badge: "Button Links",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex flex-col items-center justify-center select-none overflow-hidden">
        <div className="absolute bg-[#222] border border-neutral-850 rounded px-2 py-1 text-[8px] font-bold text-neutral-300 hover:text-white shadow-xl btn-tooltip-anim z-10 flex items-center gap-1">
          <span>🔗 바로가기</span>
          <span className="text-blue-400 font-extrabold">[수정]</span>
        </div>
        <div className="w-40 h-8 rounded-lg flex items-center justify-center font-bold text-[9px] text-white shadow-md cursor-pointer btn-hover-anim btn-color-anim mt-3">
          📂 포트폴리오 보러가기
        </div>
        <div className="absolute click-btn-mod-anim z-20">
          <CursorSvg />
        </div>
      </div>
    )
  },
  {
    id: 7,
    title: "8. 다단 컬럼 레이아웃",
    subtitle: "빈 줄에서 플로팅 메뉴를 열고 단 분할 레이아웃을 생성합니다.",
    description: "빈 라인 좌측에 뜨는 + 버튼을 누르고 5:5, 3:3:3 등 다단 옵션을 클릭해 화면을 분할 배치할 수 있습니다.",
    icon: "▥",
    badge: "Columns Block",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex flex-col items-center justify-center select-none overflow-hidden">
        <div className="absolute left-6 w-4 h-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center font-bold text-[9px] float-menu-trigger-anim cursor-pointer">
          +
        </div>
        <div className="absolute bg-[#222] border border-neutral-850 rounded-lg p-1.5 flex flex-col gap-1 shadow-2xl float-menu-options-anim z-10">
          <div className="text-[7px] text-neutral-500 font-extrabold px-1 tracking-wider uppercase mb-0.5">Split Columns</div>
          <div className="flex gap-1">
            <button className="px-1.5 py-1 text-[7px] bg-indigo-950/60 border border-indigo-900 text-indigo-300 rounded font-bold">5:5</button>
            <button className="px-1.5 py-1 text-[7px] bg-neutral-900 border border-neutral-800 text-neutral-400 rounded font-bold">3:3:3</button>
            <button className="px-1.5 py-1 text-[7px] bg-neutral-900 border border-neutral-800 text-neutral-400 rounded font-bold">3:7</button>
          </div>
        </div>
        <div className="w-60 h-10 border border-transparent rounded flex items-center justify-between gap-2 px-1 relative">
          <div className="h-full rounded border border-neutral-800/80 flex items-center justify-center col-layout-split-anim">
            <span className="text-[8px] font-mono tracking-wider font-extrabold select-none">50% COLUMN</span>
          </div>
          <div className="h-full rounded border border-neutral-800/80 flex items-center justify-center col-layout-split-anim">
            <span className="text-[8px] font-mono tracking-wider font-extrabold select-none">50% COLUMN</span>
          </div>
        </div>
        <div className="absolute click-col-menu-anim z-20">
          <CursorSvg />
        </div>
      </div>
    )
  },
  {
    id: 8,
    title: "9. 아코디언 상자 (FAQ)",
    subtitle: "질문을 클릭하면 아래로 답변 상자가 부드럽게 펼쳐집니다.",
    description: "FAQ 레이아웃이나 상세 접기/펼치기 상자가 필요할 때 질문바를 클릭해 답변 상자를 확장하여 화면을 아낄 수 있습니다.",
    icon: "📂",
    badge: "FAQ Accordion",
    renderVisual: () => (
      <div className="w-full h-full p-4 relative flex flex-col justify-center items-center select-none overflow-hidden">
        <div className="w-64 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-neutral-850 p-2.5 flex items-center justify-between text-[9px] font-bold text-white border-b border-neutral-800/80 cursor-pointer">
            <span className="flex items-center gap-1.5"><span className="text-indigo-400 font-extrabold">Q.</span> 자주 묻는 질문이 들어갑니다.</span>
            <span className="text-neutral-400 arrow-rotate-anim">▼</span>
          </div>
          <div className="bg-neutral-900 text-[8px] text-neutral-400 px-2.5 leading-relaxed font-medium faq-content-expand-anim">
            <span className="text-red-400 font-extrabold mr-1">A.</span> 아코디언 본문 텍스트 내용이 부드러운 펼침 효과와 함께 실시간 노출됩니다.
          </div>
        </div>
        <div className="absolute click-faq-anim z-20">
          <CursorSvg />
        </div>
      </div>
    )
  }
]

// -------------------------------------------------------------
// Main Editor Canvas
// -------------------------------------------------------------
export default function EditorCanvas({ creatorName, sectionId, initialProject, initialWidgets, categories = [] }: { creatorName: string, sectionId?: string, initialProject?: any, initialWidgets?: any, categories?: any[] }) {
  const [isMounted, setIsMounted] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [isGuideClosing, setIsGuideClosing] = useState(false)
  const [guideViewMode, setGuideViewMode] = useState<'drawer' | 'modal'>('drawer')
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null)
  
  // Realtime Preview Simulator States
  const [showPreview, setShowPreview] = useState(false)
  const [isPreviewClosing, setIsPreviewClosing] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)

  // Premium System Toast Notifications
  const [toasts, setToasts] = useState<{ id: string; title: string; description: string; icon?: string }[]>([])
  const [isDraggingActive, setIsDraggingActive] = useState(false)
  const [isPublishOpen, setIsPublishOpen] = useState(false)

  const showToast = (title: string, description: string, icon?: string) => {
    const newId = Date.now().toString()
    const newToast = { id: newId, title, description, icon }
    setToasts(prev => [newToast, ...prev].slice(0, 3)) // Max 3 items stack

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newId))
    }, 3500)
  }

  useEffect(() => {
    if (creatorName) {
      getProfileForPreviewAction(creatorName)
        .then((data) => {
          if (data) setProfileData(data)
        })
        .catch((err) => console.error('[Editor] Profile fetch failed:', err))
    }
  }, [creatorName])

  const closeGuide = () => {
    setIsGuideClosing(true)
    setTimeout(() => {
      setShowGuide(false)
      setIsGuideClosing(false)
    }, 280)
  }

  const closePreview = () => {
    setIsPreviewClosing(true)
    setTimeout(() => {
      setShowPreview(false)
      setIsPreviewClosing(false)
    }, 280)
  }

  const draftsKey = `blockcanvas_drafts_v2_${creatorName}`
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isDirty, setIsDirty] = useState(false)

  const [draftSessionId, setDraftSessionId] = useState(() => Date.now().toString())
  const [draftsList, setDraftsList] = useState<Draft[]>([])
  const [showDrafts, setShowDrafts] = useState(false)
  const [draftWarning, setDraftWarning] = useState(false)

  const [widgets, setWidgets] = useState<Widget[]>(
    initialWidgets && initialWidgets.length > 0 ? initialWidgets : [
      { id: 'start-text', type: 'text', content: '<p>나의 새로운 작품을 설명해보세요...</p>' },
    ]
  )

  useEffect(() => {
    setIsMounted(true)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(draftsKey)
        if (saved) {
          const parsed = JSON.parse(saved) as Draft[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDraftsList(parsed)
          }
        }
      } catch (e) { }
    }
  }, [draftsKey])

  const saveToDrafts = (isManual: boolean = false, ignoreLimit: boolean = false) => {
    let currentDrafts: Draft[] = []
    try {
      const saved = localStorage.getItem(draftsKey)
      if (saved) currentDrafts = JSON.parse(saved)
    } catch (e) { }

    const existingIndex = currentDrafts.findIndex(d => d.sessionId === draftSessionId)

    // Limit check for new drafts
    if (existingIndex < 0 && currentDrafts.length >= 5 && !ignoreLimit) {
      setDraftWarning(true)
      return false
    }

    // Extract preview text
    let previewText = '새로운 작품 초안'
    const firstTextWidget = widgets.find(w => w.type === 'text')
    if (firstTextWidget && typeof firstTextWidget.content === 'string') {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = firstTextWidget.content
      previewText = tempDiv.textContent || tempDiv.innerText || previewText
      previewText = previewText.trim().substring(0, 20) + (previewText.length > 20 ? '...' : '')
    } else if (widgets.find(w => w.type === 'image_grid')) {
      previewText = '이미지 블록 포함 초안'
    } else if (widgets.find(w => w.type === 'video')) {
      previewText = '비디오 블록 포함 초안'
    } else if (widgets.find(w => w.type === 'embed')) {
      previewText = '임베드 블록 포함 초안'
    }

    const newDraft: Draft = {
      sessionId: draftSessionId,
      projectId: initialProject?.id || null,
      updatedAt: Date.now(),
      previewText,
      widgets
    }

    if (existingIndex >= 0) {
      currentDrafts[existingIndex] = newDraft
    } else {
      currentDrafts.unshift(newDraft)
    }

    currentDrafts.sort((a, b) => b.updatedAt - a.updatedAt)
    if (currentDrafts.length > 5) currentDrafts = currentDrafts.slice(0, 5)

    localStorage.setItem(draftsKey, JSON.stringify(currentDrafts))
    setDraftsList(currentDrafts)
    return true
  }

  // Auto-save tracking
  useEffect(() => {
    if (!isMounted || !isDirty) return

    const timer = setTimeout(() => {
      saveToDrafts()
    }, 2000) // Auto-save after 2s of inactivity

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets, isMounted, isDirty])

  // Prevent leaving if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const handleManualSave = () => {
    const saved = saveToDrafts(true)
    if (!saved) return // Cancelled by user
    setSaveStatus('saving')
    setIsDirty(false)
    setTimeout(() => {
      setSaveStatus('saved')
      showToast('임시 초안 저장 완료', '방금 전 • 로컬 세션에 안전하게 백업되었습니다!', '💾')
    }, 300)
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const loadDraft = (draft: Draft) => {
    setWidgets(draft.widgets)
    setDraftSessionId(draft.sessionId)
    setIsDirty(false)
    setShowDrafts(false)
  }

  const deleteDraft = (sessionIdToDelete: string) => {
    try {
      const saved = localStorage.getItem(draftsKey)
      if (saved) {
        let currentDrafts = JSON.parse(saved) as Draft[]
        currentDrafts = currentDrafts.filter(d => d.sessionId !== sessionIdToDelete)
        localStorage.setItem(draftsKey, JSON.stringify(currentDrafts))
        setDraftsList(currentDrafts)
        if (currentDrafts.length === 0) {
          setShowDrafts(false)
        }
      }
    } catch (e) { }
  }

  const removeCurrentDraft = () => {
    try {
      const saved = localStorage.getItem(draftsKey)
      if (saved) {
        let currentDrafts = JSON.parse(saved) as Draft[]
        currentDrafts = currentDrafts.filter(d => d.sessionId !== draftSessionId)
        localStorage.setItem(draftsKey, JSON.stringify(currentDrafts))
        setDraftsList(currentDrafts)
      }
    } catch (e) { }
  }

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sidebarSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setIsDirty(true)
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSidebarDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setIsDirty(true)
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
      showToast('레이아웃 순서 변경됨', '방금 전 • 블록 배치가 실시간으로 업데이트되었습니다!', '🧩')
    }
  }

  const addWidget = (type: WidgetType) => {
    setIsDirty(true)
    const newId = Date.now().toString()
    setWidgets([...widgets, { id: newId, type, content: type === 'text' ? '' : type === 'image_grid' ? [] : '' }])
    
    if (type === 'text') {
      showToast('텍스트 블록 추가됨', '방금 전 • 1개의 텍스트 블록이 배치되었습니다!', '📝')
    } else if (type === 'image_grid') {
      showToast('포토 그리드 추가됨', '방금 전 • 1개의 이미지 그리드 위젯이 배치되었습니다!', '🖼️')
    } else if (type === 'video') {
      showToast('미디어 위젯 추가됨', '방금 전 • 1개의 비디오/오디오 위젯이 배치되었습니다!', '▶')
    } else if (type === 'embed') {
      showToast('외부 임베드 추가됨', '방금 전 • 1개의 iframe 임베드 링크가 연동되었습니다!', '🔗')
    }
  }

  const updateWidgetContent = (id: string, newContent: any) => {
    setIsDirty(true)
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, content: newContent } : w))
  }

  const deleteWidget = (id: string) => {
    setIsDirty(true)
    setWidgets(prev => prev.filter(w => w.id !== id))
    showToast('콘텐츠 블록 삭제됨', '방금 전 • 1개의 위젯이 화면에서 완전히 제거되었습니다!', '🗑')
  }

  if (!isMounted) return null // dnd-kit Client-side hydration safeguard

  return (
    <>
      <header className="h-14 border-b border-neutral-200 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-40 relative">
        <div className="flex items-center gap-4">
          <Link href={`/creator/${creatorName}`} className="hover:opacity-80 transition-opacity flex items-center gap-2 group/logo">
            <Image 
              src="/logo_icon.png" 
              alt="BlockCanvas Icon" 
              width={32} 
              height={32} 
              className="h-8 w-auto object-contain group-hover/logo:rotate-12 transition-transform"
            />
            <Image 
              src="/logo_text.png" 
              alt="BlockCanvas" 
              width={100} 
              height={24} 
              className="h-5 w-auto object-contain"
            />
          </Link>
          <span className="text-neutral-300">|</span>
          <span className="text-xs sm:text-sm tracking-wide text-neutral-500 font-medium whitespace-nowrap">에디터 v3.0 (임베드 확장)</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 relative">
          {draftsList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowDrafts(!showDrafts)}
                className="text-[11px] sm:text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors px-2 sm:px-3 py-1.5 rounded flex items-center gap-1"
              >
                초안 불러오기 <span className="bg-blue-200 text-blue-700 px-1.5 rounded-full text-[10px]">{draftsList.length}</span>
              </button>

              {showDrafts && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDrafts(false)}></div>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-neutral-200 shadow-xl rounded-lg overflow-hidden z-50 flex flex-col">
                    <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 text-xs font-bold text-neutral-500">
                      최근 초안 리스트 (최대 5개)
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {draftsList.map((draft) => {
                        const d = new Date(draft.updatedAt)
                        const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
                        return (
                          <div
                            key={draft.sessionId}
                            className="w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors group relative"
                          >
                            <button className="w-full" onClick={() => loadDraft(draft)}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-neutral-800 group-hover:text-blue-600 transition-colors line-clamp-1 pr-24">{draft.previewText}</span>
                              </div>
                              <div className="text-[10px] text-neutral-400">
                                {draft.projectId ? '기존 게시글 수정' : '새로운 게시글 작성'}
                              </div>
                            </button>
                            <div className="absolute top-3 right-4 flex items-center gap-2">
                              <span className="text-[10px] text-neutral-400 whitespace-nowrap">{timeStr}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteDraft(draft.sessionId); }}
                                className="text-neutral-300 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                                title="초안 삭제"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="text-[11px] sm:text-xs font-bold text-neutral-500 bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-800 transition-colors px-2 sm:px-3 py-1.5 rounded disabled:opacity-50"
          >
            {saveStatus === 'idle' ? '초안으로 저장' : saveStatus === 'saving' ? '저장 중...' : '✅ 임시 저장됨'}
          </button>

          <PublishSettingsModal
            creatorName={creatorName}
            widgets={widgets}
            sectionId={sectionId}
            initialProject={initialProject}
            categories={categories}
            isOpen={isPublishOpen}
            setIsOpen={setIsPublishOpen}
            onPublishStart={() => {
              setIsDirty(false);
              removeCurrentDraft();
            }}
          />

          <button
            onClick={() => {
              if (showGuide && !isGuideClosing) {
                closeGuide();
              } else {
                setShowGuide(true);
                setIsGuideClosing(false);
                setActiveAccordion(0);
              }
            }}
            className="text-[11px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors px-2 sm:px-3 py-1.5 rounded flex items-center gap-1.5 shadow-sm active:scale-95 duration-200 transition-transform cursor-pointer"
          >
            ❓ 도움말 & 가이드
          </button>
        </div>
      </header>

      {/* Draft Warning Toast (Y/N prompt) */}
      {draftWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 bg-orange-100 border border-orange-300 text-orange-800 text-sm px-6 py-4 rounded-xl shadow-2xl font-bold flex flex-col items-center gap-4">
          <span>⚠️ 가장 오래된 초안이 삭제됩니다. 진행하시겠습니까?</span>
          <div className="flex gap-3 w-full justify-center">
            <button
              onClick={() => {
                setDraftWarning(false);
                saveToDrafts(true, true);
                setIsDirty(false);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000)
              }}
              className="bg-orange-600 text-white px-8 py-2 rounded-md shadow hover:bg-orange-700 transition-colors"
            >
              Y (예)
            </button>
            <button
              onClick={() => setDraftWarning(false)}
              className="bg-white text-orange-600 border border-orange-300 px-8 py-2 rounded-md shadow hover:bg-orange-50 transition-colors"
            >
              N (아니오)
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto bg-[#fafafa] p-4 sm:p-10 flex flex-col items-center justify-start pb-64">

          <div className="w-full max-w-[850px]">

            {widgets.length === 0 ? (
              <div className="w-full h-40 flex items-center justify-center border-2 border-dashed border-neutral-300 rounded text-neutral-400 font-medium">
                우측 메뉴를 사용하여 위젯을 추가하세요.
              </div>
            ) : (
              <DndContext id="editor-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                  {widgets.map((w) => (
                    <SortableWidget key={w.id} id={w.id} type={w.type} onDelete={() => deleteWidget(w.id)}>
                      {w.type === 'text' && (
                        <RichTextEditor content={w.content as string} onChange={(newContent) => updateWidgetContent(w.id, newContent)} />
                      )}
                      {w.type === 'image_grid' && (
                        <ImageGridWidget urls={w.content as string[]} onChange={(newUrls) => updateWidgetContent(w.id, newUrls)} />
                      )}
                      {w.type === 'video' && (
                        <MediaWidget url={w.content as string} onChange={(newUrl) => updateWidgetContent(w.id, newUrl)} />
                      )}
                      {w.type === 'embed' && (
                        <EmbedWidget code={w.content as string} onChange={(newCode) => updateWidgetContent(w.id, newCode)} />
                      )}
                    </SortableWidget>
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Bottom inline insert bar */}
            <div className="mt-12 flex flex-wrap justify-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
              <button onClick={() => addWidget('text')} className="px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-xs font-bold shadow-sm hover:shadow text-neutral-600 transition-all hover:text-blue-600">
                + 텍스트 서식
              </button>
              <button onClick={() => addWidget('image_grid')} className="px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-xs font-bold shadow-sm hover:shadow text-neutral-600 transition-all hover:text-blue-600">
                + 이미지
              </button>
              <button onClick={() => addWidget('video')} className="px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-xs font-bold shadow-sm hover:shadow text-neutral-600 transition-all hover:text-red-600">
                + 비디오/오디오
              </button>
              <button onClick={() => addWidget('embed')} className="px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-xs font-bold shadow-sm hover:shadow text-neutral-600 transition-all hover:text-purple-600">
                + 임베드 추가
              </button>
            </div>

          </div>
        </div>

        {/* Properties Sidebar */}
        <div className="w-80 ml-0 shrink-0 bg-white border-l border-neutral-200 shadow-sm p-6 hidden lg:flex flex-col z-10 uppercase h-full overflow-y-auto">
          <h3 className="font-extrabold text-sm text-neutral-800 tracking-wider mb-8 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" /> 콘텐츠 추가
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => addWidget('image_grid')} className="flex flex-col items-center justify-center p-6 bg-neutral-50 hover:bg-blue-50 hover:border-blue-200 border border-neutral-200 rounded-xl group transition-all">
              <span className="text-2xl mb-3 opacity-60 group-hover:opacity-100 group-hover:text-blue-600">🖼️</span>
              <span className="text-[11px] font-bold text-neutral-500 tracking-wide group-hover:text-blue-700">포토 그리드</span>
            </button>

            <button onClick={() => addWidget('text')} className="flex flex-col items-center justify-center p-6 bg-neutral-50 hover:bg-blue-50 hover:border-blue-200 border border-neutral-200 rounded-xl group transition-all">
              <span className="text-2xl mb-3 opacity-60 group-hover:opacity-100 group-hover:text-blue-600">📝</span>
              <span className="text-[11px] font-bold text-neutral-500 tracking-wide group-hover:text-blue-700">텍스트 서식</span>
            </button>

            <button onClick={() => addWidget('video')} className="flex flex-col items-center justify-center p-6 bg-neutral-50 hover:bg-red-50 hover:border-red-200 border border-neutral-200 rounded-xl group transition-all">
              <span className="text-2xl mb-3 opacity-60 group-hover:opacity-100 group-hover:text-red-600">▶</span>
              <span className="text-[11px] font-bold text-neutral-500 tracking-wide group-hover:text-red-700">비디오/오디오</span>
            </button>

            <button onClick={() => addWidget('embed')} className="flex flex-col items-center justify-center p-6 bg-neutral-50 hover:bg-purple-50 hover:border-purple-200 border border-neutral-200 rounded-xl group transition-all">
              <span className="text-2xl mb-3 opacity-60 group-hover:opacity-100 group-hover:text-purple-600">&lt;/&gt;</span>
              <span className="text-[11px] font-bold text-neutral-500 tracking-wide group-hover:text-purple-700">임베드 (Embed)</span>
            </button>
          </div>

          <div className="border-t border-neutral-100 pt-6">
            <div className="bg-red-50 p-4 rounded-xl text-xs text-red-800 leading-relaxed font-medium">
              🚨 비디오 업로드는 **1GB 용량 제한**이 작동 중입니다. 하드디스크 자원 관리에 유의하세요.
            </div>
          </div>

          {/* 🧩 블록 레이아웃 미니맵 (Navigator Map) */}
          <div className="mt-8 border-t border-neutral-100 pt-6 flex-1 flex flex-col min-h-0">
            <h3 className="font-extrabold text-xs text-neutral-800 tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 select-none">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse" />
                블록 레이아웃 미니맵 ({widgets.length})
              </span>
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide select-none">Navigator</span>
            </h3>
            <p className="text-[10px] text-neutral-400 font-semibold mb-4 leading-normal select-none">
              카드를 드래그하여 순서를 조절하거나, 클릭하여 해당 본문 위치로 즉시 이동할 수 있습니다.
            </p>

            <div className="flex-1 overflow-y-auto max-h-[610px] pr-1 custom-scrollbar-preview">
              <DndContext 
                id="sidebar-dnd-context" 
                autoScroll={false} 
                sensors={sidebarSensors} 
                collisionDetection={closestCenter} 
                onDragStart={() => setIsDraggingActive(true)}
                onDragEnd={(event) => {
                  handleSidebarDragEnd(event);
                  setTimeout(() => setIsDraggingActive(false), 80);
                }}
              >
                <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2.5 pb-4">
                    {widgets.map((w, idx) => (
                      <SidebarSortableItem
                        key={w.id}
                        id={w.id}
                        widget={w}
                        idx={idx}
                        onDelete={() => deleteWidget(w.id)}
                        onClick={() => {
                          if (isDraggingActive) return
                          const element = document.getElementById(`widget-card-${w.id}`)
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            element.classList.add('ring-4', 'ring-indigo-500/40', 'ring-offset-2', 'scale-[1.01]', 'shadow-2xl')
                            setTimeout(() => {
                              element.classList.remove('ring-4', 'ring-indigo-500/40', 'ring-offset-2', 'scale-[1.01]', 'shadow-2xl')
                            }, 1500)
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Creator Guide Dual View Overlay */}
      {(showGuide || isGuideClosing) && (
        <>
          {/* Shared Scoped Animations Stylesheet */}
          <style>{`
            /* Scoped Animation Classes */
            .guide-drawer-scope .mouse-grab-anim {
              animation: mouse-grab-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .block-a-anim {
              animation: block-a-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .block-b-anim {
              animation: block-b-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .typing-text-anim::after {
              content: "";
              animation: typing-text-anim-kf 4s infinite steps(1);
            }
            .guide-drawer-scope .caret-blink-anim {
              animation: caret-blink-anim-kf 0.8s infinite step-end;
            }
            .guide-drawer-scope .img-grid-anim-1 {
              animation: img-grid-anim-1-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .img-grid-anim-2 {
              animation: img-grid-anim-2-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .img-grid-anim-3 {
              animation: img-grid-anim-3-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .play-btn-anim {
              animation: play-btn-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .playbar-progress-anim {
              animation: playbar-progress-anim-kf 4s infinite linear;
            }
            .guide-drawer-scope .time-count-anim::after {
              content: "0:00";
              animation: time-count-anim-kf 4s infinite steps(1);
            }
            .guide-drawer-scope .embed-type-anim::after {
              content: "";
              animation: embed-type-anim-kf 4s infinite steps(1);
            }
            .guide-drawer-scope .embed-spinner-anim {
              animation: embed-spinner-anim-kf 4s infinite linear;
            }
            .guide-drawer-scope .embed-player-anim {
              animation: embed-player-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .highlight-sweep-anim {
              animation: highlight-sweep-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .bubble-menu-anim {
              animation: bubble-menu-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .shimmer-effect-anim {
              animation: shimmer-effect-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .click-menu-anim {
              animation: click-menu-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .btn-hover-anim {
              animation: btn-hover-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .btn-tooltip-anim {
              animation: btn-tooltip-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .btn-color-anim {
              animation: btn-color-anim-kf 4s infinite step-end;
            }
            .guide-drawer-scope .click-btn-mod-anim {
              animation: click-btn-mod-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .float-menu-trigger-anim {
              animation: float-menu-trigger-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .float-menu-options-anim {
              animation: float-menu-options-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .col-layout-split-anim {
              animation: col-layout-split-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .click-col-menu-anim {
              animation: click-col-menu-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .arrow-rotate-anim {
              animation: arrow-rotate-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .faq-content-expand-anim {
              animation: faq-content-expand-anim-kf 4s infinite ease-in-out;
            }
            .guide-drawer-scope .click-faq-anim {
              animation: click-faq-anim-kf 4s infinite ease-in-out;
            }

            /* Keyframes Declarations */
            @keyframes mouse-grab-anim-kf {
              0% { transform: translate(60px, 40px); opacity: 0; }
              10% { transform: translate(30px, -15px); opacity: 1; }
              25% { transform: translate(30px, -15px); opacity: 1; }
              45% { transform: translate(30px, 20px); opacity: 1; }
              65% { transform: translate(30px, 20px); opacity: 1; }
              75% { transform: translate(60px, 40px); opacity: 0; }
              100% { transform: translate(60px, 40px); opacity: 0; }
            }
            @keyframes block-a-anim-kf {
              0%, 25% { transform: translateY(0); border-color: #262626; box-shadow: none; }
              45%, 65% { transform: translateY(44px); border-color: #4f46e5; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); }
              75%, 100% { transform: translateY(0); border-color: #262626; box-shadow: none; }
            }
            @keyframes block-b-anim-kf {
              0%, 25% { transform: translateY(0); }
              45%, 65% { transform: translateY(-44px); }
              75%, 100% { transform: translateY(0); }
            }
            @keyframes typing-text-anim-kf {
              0%, 10% { content: ""; }
              18% { content: "B"; }
              26% { content: "Bl"; }
              34% { content: "Blo"; }
              42% { content: "Bloc"; }
              50% { content: "Block"; }
              58% { content: "BlockC"; }
              66% { content: "BlockCan"; }
              74% { content: "BlockCanva"; }
              82%, 90% { content: "BlockCanvas"; }
              96%, 100% { content: ""; }
            }
            @keyframes caret-blink-anim-kf {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            @keyframes img-grid-anim-1-kf {
              0%, 10% { opacity: 0; transform: scale(0.9); }
              20%, 85% { opacity: 1; transform: scale(1); }
              95%, 100% { opacity: 0; }
            }
            @keyframes img-grid-anim-2-kf {
              0%, 25% { opacity: 0; transform: scale(0.9); }
              35%, 85% { opacity: 1; transform: scale(1); }
              95%, 100% { opacity: 0; }
            }
            @keyframes img-grid-anim-3-kf {
              0%, 40% { opacity: 0; transform: scale(0.9); }
              50%, 85% { opacity: 1; transform: scale(1); }
              95%, 100% { opacity: 0; }
            }
            @keyframes play-btn-anim-kf {
              0%, 10% { transform: scale(1); background-color: #dc2626; }
              15%, 20% { transform: scale(0.85); }
              25%, 85% { transform: scale(1); background-color: #059669; }
              90%, 100% { transform: scale(1); background-color: #dc2626; }
            }
            @keyframes playbar-progress-anim-kf {
              0%, 20% { width: 0%; }
              80% { width: 100%; }
              90%, 100% { width: 100%; }
            }
            @keyframes time-count-anim-kf {
              0%, 20% { content: "0:00"; }
              40% { content: "0:01"; }
              60% { content: "0:02"; }
              80%, 100% { content: "0:03"; }
            }
            @keyframes embed-type-anim-kf {
              0%, 5% { content: ""; }
              20%, 90% { content: "youtu.be/craft-oriental"; }
              95%, 100% { content: ""; }
            }
            @keyframes embed-spinner-anim-kf {
              0%, 20% { opacity: 0; transform: rotate(0deg); }
              21% { opacity: 1; }
              40% { opacity: 1; transform: rotate(360deg); }
              41%, 100% { opacity: 0; }
            }
            @keyframes embed-player-anim-kf {
              0%, 40% { opacity: 0; transform: scale(0.95); }
              50%, 90% { opacity: 1; transform: scale(1); }
              95%, 100% { opacity: 0; }
            }
            @keyframes highlight-sweep-anim-kf {
              0%, 10% { width: 0%; opacity: 0; }
              25% { width: 100%; opacity: 0.3; }
              80% { width: 100%; opacity: 0.3; }
              90%, 100% { width: 0%; opacity: 0; }
            }
            @keyframes bubble-menu-anim-kf {
              0%, 20% { opacity: 0; transform: translateY(8px) scale(0.95); }
              30%, 80% { opacity: 1; transform: translateY(0) scale(1); }
              90%, 100% { opacity: 0; transform: translateY(8px) scale(0.95); }
            }
            @keyframes shimmer-effect-anim-kf {
              0%, 45% { filter: drop-shadow(0 0 0px #818cf8); color: #a5b4fc; text-shadow: none; }
              55%, 80% { filter: drop-shadow(0 0 4px #c084fc); color: #e9d5ff; text-shadow: 0 0 8px rgba(192, 132, 252, 0.8); }
              90%, 100% { filter: drop-shadow(0 0 0px #818cf8); color: #a5b4fc; text-shadow: none; }
            }
            @keyframes click-menu-anim-kf {
              0%, 10% { transform: translate(140px, 45px); opacity: 0; }
              22% { transform: translate(45px, 20px); opacity: 1; }
              35% { transform: translate(25px, -15px); opacity: 1; }
              40% { transform: translate(25px, -15px) scale(0.85); }
              45%, 80% { transform: translate(25px, -15px); opacity: 1; }
              90%, 100% { transform: translate(140px, 45px); opacity: 0; }
            }
            @keyframes btn-hover-anim-kf {
              0%, 15% { transform: scale(1); }
              25%, 35% { transform: scale(1.04); }
              40% { transform: scale(0.96); }
              45%, 80% { transform: scale(1.04); }
              90%, 100% { transform: scale(1); }
            }
            @keyframes btn-tooltip-anim-kf {
              0%, 20% { opacity: 0; transform: translateY(6px); }
              30%, 80% { opacity: 1; transform: translateY(0); }
              90%, 100% { opacity: 0; }
            }
            @keyframes btn-color-anim-kf {
              0%, 38% { background-color: #2563eb; }
              42%, 80% { background-color: #7c3aed; }
              90%, 100% { background-color: #2563eb; }
            }
            @keyframes click-btn-mod-anim-kf {
              0%, 15% { transform: translate(140px, 45px); opacity: 0; }
              25% { transform: translate(65px, 20px); opacity: 1; }
              35% { transform: translate(50px, -15px); opacity: 1; }
              40% { transform: translate(50px, -15px) scale(0.85); }
              45%, 80% { transform: translate(50px, -15px); opacity: 1; }
              90%, 100% { transform: translate(140px, 45px); opacity: 0; }
            }
            @keyframes float-menu-trigger-anim-kf {
              0%, 15% { opacity: 0; transform: scale(0.8); }
              25%, 80% { opacity: 1; transform: scale(1); }
              90%, 100% { opacity: 0; }
            }
            @keyframes float-menu-options-anim-kf {
              0%, 30% { opacity: 0; transform: translate(0, 8px) scale(0.95); }
              40%, 80% { opacity: 1; transform: translate(0, 0) scale(1); }
              90%, 100% { opacity: 0; transform: translate(0, 8px) scale(0.95); }
            }
            @keyframes col-layout-split-anim-kf {
              0%, 48% { width: 100%; border-style: none; background: transparent; color: transparent; }
              58%, 85% { width: 48%; border-style: dashed; background: rgba(255,255,255,0.02); color: #737373; }
              95%, 100% { width: 100%; border-style: none; background: transparent; color: transparent; }
            }
            @keyframes click-col-menu-anim-kf {
              0%, 15% { transform: translate(140px, 45px); opacity: 0; }
              25% { transform: translate(-80px, 0px); opacity: 1; }
              30% { transform: translate(-80px, 0px) scale(0.85); }
              42% { transform: translate(-25px, -30px); }
              48% { transform: translate(-25px, -30px) scale(0.85); }
              55%, 80% { transform: translate(-25px, -30px); opacity: 1; }
              90%, 100% { transform: translate(140px, 45px); opacity: 0; }
            }
            @keyframes arrow-rotate-anim-kf {
              0%, 25% { transform: rotate(0deg); color: #a3a3a3; }
              40%, 80% { transform: rotate(180deg); color: #818cf8; }
              90%, 100% { transform: rotate(0deg); color: #a3a3a3; }
            }
            @keyframes faq-content-expand-anim-kf {
              0%, 25% { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; }
              40%, 80% { max-height: 48px; opacity: 1; padding-top: 8px; padding-bottom: 8px; }
              90%, 100% { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; }
            }
            @keyframes click-faq-anim-kf {
              0%, 15% { transform: translate(140px, 45px); opacity: 0; }
              25% { transform: translate(90px, -20px); opacity: 1; }
              35% { transform: translate(90px, -20px) scale(0.85); }
              45%, 80% { transform: translate(90px, -20px); opacity: 1; }
              90%, 100% { transform: translate(140px, 45px); opacity: 0; }
            }
            
            /* Custom scrollbar to keep drawer premium */
            .custom-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
              overscroll-behavior-y: contain;
              -webkit-overflow-scrolling: touch;
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 5px;
              height: 5px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.16);
              border-radius: 9999px;
              transition: background-color 0.2s ease;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.32);
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:active {
              background: rgba(255, 255, 255, 0.45);
            }
            
            /* Custom scrollbar to keep preview modal modern */
            .custom-scrollbar-preview {
              scrollbar-width: thin;
              scrollbar-color: rgba(0, 0, 0, 0.16) transparent;
              overscroll-behavior-y: contain;
              -webkit-overflow-scrolling: touch;
            }
            .custom-scrollbar-preview::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            .custom-scrollbar-preview::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar-preview::-webkit-scrollbar-thumb {
              background: rgba(0, 0, 0, 0.15);
              border-radius: 9999px;
              transition: background-color 0.2s ease;
            }
            .custom-scrollbar-preview::-webkit-scrollbar-thumb:hover {
              background: rgba(0, 0, 0, 0.3);
            }
            .custom-scrollbar-preview::-webkit-scrollbar-thumb:active {
              background: rgba(0, 0, 0, 0.45);
            }
          `}</style>

          {guideViewMode === 'drawer' ? (
            /* ========================================================= */
            /* 1. SIDE DRAWER VIEW                                       */
            /* ========================================================= */
            <div data-lenis-prevent="true" className={`fixed right-0 top-0 bottom-0 w-[420px] max-w-full bg-[#0c0c0f]/95 backdrop-blur-md border-l border-neutral-800 text-neutral-100 shadow-2xl flex flex-col z-[9999] font-sans ${isGuideClosing ? 'animate-out slide-out-to-right fade-out duration-300 ease-in' : 'animate-in slide-in-from-right fade-in duration-300 ease-out'}`}>
              {/* Header */}
              <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">💡</span>
                  <div className="text-left">
                    <h3 className="font-extrabold text-xs text-white tracking-wider uppercase">
                      BLOCKCANVAS CREATOR GUIDE
                    </h3>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5">
                      에디터 핵심 기능별 모션 가이드
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setGuideViewMode('modal')}
                    className="text-[9px] font-bold text-indigo-400 hover:text-white transition-colors px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex items-center gap-1 cursor-pointer"
                    title="플로팅 모달 화면으로 전환"
                  >
                    🖥️ 크게 보기
                  </button>
                  <button
                    onClick={closeGuide}
                    className="text-neutral-500 hover:text-white transition-colors p-1.5 hover:bg-neutral-900 rounded-full cursor-pointer border border-neutral-850"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Accordion Scroll Container */}
              <div data-lenis-prevent="true" className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar guide-drawer-scope" style={{ overscrollBehaviorY: 'contain' }}>
                {GUIDE_ACCORDIONS.map((item) => {
                  const isOpen = activeAccordion === item.id
                  return (
                    <div
                      key={item.id}
                      className={`border border-neutral-850 rounded-xl overflow-hidden transition-all duration-300 bg-neutral-950/40 hover:bg-neutral-950/70 ${isOpen ? 'ring-1 ring-indigo-500/50 bg-[#111115]/95 shadow-lg border-indigo-950' : ''}`}
                    >
                      {/* Header trigger button */}
                      <button
                        onClick={() => setActiveAccordion(isOpen ? null : item.id)}
                        className="w-full text-left p-3.5 flex items-center justify-between gap-3 select-none outline-none focus:outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg shrink-0 w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center border border-neutral-800">{item.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[11px] font-extrabold text-white tracking-wide">
                                {item.title}
                              </h4>
                              <span className="text-[7px] bg-indigo-950/50 text-indigo-400 border border-indigo-900/40 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest scale-90 origin-left">
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[9px] text-neutral-500 mt-0.5 font-medium line-clamp-1">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[8px] text-neutral-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {/* Expandable Box */}
                      <div
                        className="transition-all duration-300 ease-in-out overflow-hidden"
                        style={{
                          maxHeight: isOpen ? '360px' : '0px',
                          opacity: isOpen ? 1 : 0,
                        }}
                      >
                        <div className="px-4 pb-4">
                          {/* Simulation Visual Frame (h-32 bg-[#0e0e0e]) */}
                          <div className="h-32 bg-[#0e0e10] rounded-lg overflow-hidden flex items-center justify-center border border-neutral-850 relative">
                            {isOpen && item.renderVisual()}
                          </div>
                          {/* Summary Explanations (1-2 punchy sentences) */}
                          <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed font-semibold bg-neutral-950/80 p-2.5 border border-neutral-850/50 rounded-md">
                            💡 {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* 2. FLOATING TWO-COLUMN MODAL VIEW                         */
            /* ========================================================= */
            <div data-lenis-prevent="true" className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] max-w-[95%] h-[580px] bg-[#0c0c0f]/95 backdrop-blur-md border border-neutral-800 text-neutral-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[9999] font-sans ${isGuideClosing ? 'animate-out zoom-out-95 fade-out duration-300 ease-in' : 'animate-in zoom-in-95 fade-in duration-300 ease-out'}`}>
              {/* Header */}
              <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">💡</span>
                  <div className="text-left">
                    <h3 className="font-extrabold text-xs text-white tracking-wider uppercase">
                      BLOCKCANVAS CREATOR GUIDE
                    </h3>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5">
                      에디터 핵심 기능별 플로팅 시뮬레이션 모드
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setGuideViewMode('drawer')}
                    className="text-[9px] font-bold text-indigo-400 hover:text-white transition-colors px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex items-center gap-1 cursor-pointer"
                    title="사이드 서랍 화면으로 복귀"
                  >
                    📱 서랍으로 보기
                  </button>
                  <button
                    onClick={closeGuide}
                    className="text-neutral-500 hover:text-white transition-colors p-1.5 hover:bg-neutral-900 rounded-full cursor-pointer border border-neutral-850"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content Body - Two Column Layout */}
              <div className="flex-1 flex overflow-hidden guide-drawer-scope">
                {/* Left Column: List of 9 items */}
                <div data-lenis-prevent="true" className="w-[300px] border-r border-neutral-850 p-4 space-y-1.5 overflow-y-auto custom-scrollbar bg-neutral-950/20" style={{ overscrollBehaviorY: 'contain' }}>
                  {GUIDE_ACCORDIONS.map((item) => {
                    const isActive = activeAccordion === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveAccordion(item.id)}
                        className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all outline-none focus:outline-none border cursor-pointer ${isActive ? 'bg-[#111115]/95 border-indigo-500/50 shadow-lg text-white ring-1 ring-indigo-500/30' : 'bg-transparent border-transparent text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200'}`}
                      >
                        <span className={`text-base shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border ${isActive ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-neutral-900/50 border-neutral-850/50 text-neutral-400'}`}>{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[11px] font-extrabold tracking-wide truncate">{item.title}</span>
                            <span className={`text-[6px] px-1 py-0.5 rounded-full font-bold uppercase shrink-0 scale-90 ${isActive ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/40' : 'bg-neutral-900 text-neutral-500'}`}>{item.badge}</span>
                          </div>
                          <p className="text-[8px] text-neutral-500 truncate mt-0.5 font-medium">{item.subtitle}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Right Column: Visual Simulation Card */}
                {(() => {
                  const activeItem = GUIDE_ACCORDIONS.find(a => a.id === activeAccordion) || GUIDE_ACCORDIONS[0]
                  return (
                    <div data-lenis-prevent="true" className="flex-1 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar bg-neutral-950/10 text-left" style={{ overscrollBehaviorY: 'contain' }}>
                      <div className="space-y-4">
                        {/* Title & Badge */}
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className="text-xs font-black text-white tracking-wide">{activeItem.title}</h4>
                            <p className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider mt-0.5">{activeItem.subtitle}</p>
                          </div>
                          <span className="text-[7px] bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 px-2 py-1 rounded-full font-extrabold uppercase tracking-widest scale-90">{activeItem.badge}</span>
                        </div>

                        {/* Animation Simulation Frame */}
                        <div className="h-[260px] bg-[#0e0e10] rounded-xl overflow-hidden flex items-center justify-center border border-neutral-850 relative shadow-inner">
                          {activeItem.renderVisual()}
                        </div>
                      </div>

                      {/* Description Banner */}
                      <div className="bg-neutral-950/80 p-3 border border-neutral-850/50 rounded-xl flex items-start gap-2.5 mt-4">
                        <span className="text-base shrink-0 mt-0.5">💡</span>
                        <p className="text-[10px] text-neutral-300 leading-relaxed font-semibold">
                          {activeItem.description}
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Bottom Command Bar */}
      {!isPublishOpen && !showPreview && (
        <div className="fixed bottom-[20px] left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur border border-neutral-200/80 px-4 py-2.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-2.5 z-[99999] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.16)] sm:gap-4 font-sans select-none animate-in slide-in-from-bottom duration-300">
          <button
            onClick={() => addWidget('text')}
            className="text-xs font-bold text-neutral-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-neutral-50"
          >
            <span>📝</span> <span className="hidden sm:inline">텍스트 서식</span><span className="sm:hidden">텍스트</span>
          </button>
          <button
            onClick={() => addWidget('image_grid')}
            className="text-xs font-bold text-neutral-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-neutral-50"
          >
            <span>🖼️</span> <span className="hidden sm:inline">포토 그리드</span><span className="sm:hidden">이미지</span>
          </button>
          <button
            onClick={() => addWidget('video')}
            className="text-xs font-bold text-neutral-600 hover:text-red-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-neutral-50"
          >
            <span>▶</span> <span className="hidden sm:inline">비디오/오디오</span><span className="sm:hidden">미디어</span>
          </button>
          <button
            onClick={() => addWidget('embed')}
            className="text-xs font-bold text-neutral-600 hover:text-purple-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-neutral-50"
          >
            <span>🔗</span> <span className="hidden sm:inline">외부 임베드</span><span className="sm:hidden">임베드</span>
          </button>

          <span className="h-4 w-px bg-neutral-200" />

          <button
            onClick={() => {
              setShowPreview(true);
              setIsPreviewClosing(false);
            }}
            className="text-xs font-bold text-neutral-600 hover:text-blue-600 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95 duration-200 transition-transform"
          >
            <span>👁️</span> <span>미리보기</span>
          </button>

          <button
            onClick={() => {
              if (showGuide && !isGuideClosing) {
                closeGuide();
              } else {
                setShowGuide(true);
                setIsGuideClosing(false);
                setActiveAccordion(0);
              }
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 duration-200 transition-transform ${showGuide ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'}`}
          >
            <span>❓</span> <span>도움말</span>
          </button>
        </div>
      )}

      {/* 🖥️ Realtime Project Details Full Modal Preview */}
      {(showPreview || isPreviewClosing) && (() => {
        // 1. Convert Editor widgets to ProjectDetailsViewer widgets layout format
        const previewWidgets = widgets.map(w => {
          return {
            id: w.id,
            widget_type: w.type === 'image_grid' ? 'image' : w.type,
            content: w.type === 'text' ? { html: w.content }
                   : w.type === 'image_grid' ? { urls: w.content }
                   : w.type === 'video' ? { url: w.content }
                   : w.type === 'embed' ? { html: w.content }
                   : null
          }
        })

        // 2. Build mock/filled Project schema based on actual editor values
        const previewProject = {
          id: initialProject?.id || 'preview-project-id',
          title: initialProject?.title || cleanProjectTitle(initialProject?.title) || '작품 제목 미리보기',
          description: initialProject?.description || '작품 상세 설명 미리보기',
          created_at: initialProject?.created_at || new Date().toISOString(),
          creator: {
            display_name: profileData?.display_name || creatorName,
            creator_name: creatorName,
            avatar_url: profileData?.avatar_url || null,
            portfolios: profileData?.portfolios || null
          }
        }

        // Helper to safely fetch project clean title
        function cleanProjectTitle(title: string) {
          if (!title) return ''
          return title.replace(/\[SIZE:[1-3](?:x[1-3])?\]/, '').trim()
        }

        return (
          <div 
            className={`fixed inset-0 bg-[#030303]/85 backdrop-blur-xl z-[100000] flex items-center justify-center p-4 md:p-8 font-sans ${isPreviewClosing ? 'animate-out fade-out duration-300 ease-in' : 'animate-in fade-in duration-300 ease-out'}`}
            onClick={closePreview}
          >
            {/* Close Button on Top Right (floating relative) */}
            <button 
              onClick={(e) => { e.stopPropagation(); closePreview(); }}
              className="absolute top-5 right-5 z-[100020] w-9 h-9 rounded-full bg-white/70 backdrop-blur-md hover:bg-white text-neutral-500 hover:text-black border border-neutral-200/50 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer"
              title="미리보기 닫기"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Modal Card Structure */}
            <div 
              className={`relative w-full max-w-[1250px] h-[90vh] bg-white rounded-[28px] border border-neutral-100/50 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3),_0_0_0_1px_rgba(0,0,0,0.01)] flex flex-col overflow-hidden transition-all duration-300 ${isPreviewClosing ? 'animate-out zoom-out-95 duration-300 ease-in' : 'animate-in zoom-in-95 duration-300 ease-out'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Detailed Viewer Content Scroller Container */}
              <div 
                data-lenis-prevent="true"
                className="flex-1 overflow-y-auto custom-scrollbar-preview bg-white"
                style={{ overscrollBehaviorY: 'contain' }}
              >
                <ProjectDetailsViewer 
                  project={previewProject}
                  widgets={previewWidgets}
                  creatorName={creatorName}
                  isModal={true}
                  profileData={profileData}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* 🔔 Premium Dark-Themed Floating Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[1000000] flex flex-col gap-2.5 max-w-[340px] w-full font-sans pointer-events-none">
          <div className="flex flex-col gap-2.5 w-full items-end">
            {toasts.map((t) => (
              <div 
                key={t.id} 
                className="pointer-events-auto bg-[#1c1c1f]/95 backdrop-blur-md border border-neutral-800 text-white p-4 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.5)] flex items-start gap-3.5 w-full transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in ease-out hover:border-neutral-700 hover:scale-[1.01]"
              >
                {t.icon && <span className="text-base shrink-0 mt-0.5 select-none">{t.icon}</span>}
                <div className="flex-1 text-left">
                  <h4 className="font-bold text-xs text-neutral-100 tracking-tight leading-none">{t.title}</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold mt-1.5 leading-snug">{t.description}</p>
                </div>
              </div>
            ))}
            
            {/* View All / Clear Decorator */}
            <div className="flex items-center gap-2 mt-1 px-1 animate-in fade-in duration-300 pointer-events-auto self-start">
              <span className="bg-neutral-800 text-neutral-300 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black">{toasts.length}</span>
              <button 
                onClick={() => setToasts([])} 
                className="text-[11px] font-black text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                전체 지우기 ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

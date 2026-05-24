'use client'

import Link from 'next/link'
import Image from 'next/image'
import PublishSettingsModal from '@/components/editor/PublishSettingsModal'
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
import { uploadFileAction } from '@/app/actions/upload'
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
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`relative flex gap-3 mb-6 flex-col group ${isDragging ? 'shadow-2xl' : ''}`}>
      <div className="flex items-center justify-between px-2 text-neutral-400">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move flex items-center gap-2 hover:text-neutral-800 transition-colors bg-white px-3 py-1.5 rounded border border-neutral-200 shadow-sm text-xs font-bold uppercase tracking-widest"
        >
          <span className="text-[10px]">⣿</span> {type.replace('_', ' ')} BLOCK
        </div>
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
          className={`transition-colors p-1.5 text-xs border rounded ${isConfirming ? 'text-white bg-red-500 border-red-500 font-bold px-3' : 'bg-white border-neutral-200 hover:text-red-500 hover:border-red-200 text-neutral-400'}`}
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
        const url = await uploadFileAction(formData)
        if (url) newUrls.push(url)
      } catch (err) {
        console.error(err)
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
          <div className="flex flex-wrap gap-2 w-full">
            {urls.map((url, idx) => (
              <div key={idx} className="relative group overflow-hidden bg-neutral-100 rounded flex-grow" style={{ flexBasis: urls.length >= 3 ? '30%' : urls.length === 2 ? '48%' : '100%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Uploaded block" className="w-full h-auto max-h-[800px] object-cover" />
                <button
                  onClick={() => onChange(urls.filter((_, i) => i !== idx))}
                  className="absolute top-3 right-3 bg-red-500/90 text-white w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-sm shadow-md"
                >
                  ✕
                </button>
              </div>
            ))}
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
      const url = await uploadFileAction(formData)
      if (url) onChange(url)
    } catch (err: any) {
      setErrorMsg(err.message || '업로드 중 오류가 발생했습니다.')
      console.error(err)
    }
    setUploading(false)
  }

  const isAudio = url && url.match(/\.(mp3|wav|ogg)$/i)

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-md p-4 shadow-sm">
      {!url && (
        <label className="flex flex-col items-center justify-center p-12 py-20 border-2 border-dashed border-neutral-300 rounded-md cursor-pointer hover:bg-red-50/50 hover:border-red-300 transition-all group">
          <span className="bg-red-600 text-white font-bold px-6 py-2 rounded-full mb-3 shadow group-hover:scale-105 transition-transform">▶ 비디오/오디오 업로드</span>
          <span className="text-xs text-neutral-400 font-medium">MP4, WEBM, MP3 파일 (최대 1GB 제한)</span>
          <input type="file" accept="video/*,audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}

      {errorMsg && <div className="mt-2 mb-2 text-xs text-red-500 font-bold text-center">{errorMsg}</div>}

      {url && (
        <div className="flex flex-col items-center">
          {isAudio ? (
            <audio src={url} controls className="w-full max-w-md my-4 outline-none rounded" />
          ) : (
            <video src={url} controls className="w-full h-auto max-h-[800px] bg-black rounded shadow" />
          )}
          <div className="flex justify-end w-full pt-2 border-t border-neutral-100 mt-4">
            <label className="text-xs font-bold text-red-600 cursor-pointer hover:underline uppercase tracking-wide">
              미디어 교체
              <input type="file" accept="video/*,audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}

      {uploading && <div className="text-center py-4 text-xs font-bold text-red-500 animate-pulse">대용량 미디어 업로드 중... 창을 닫지 마세요.</div>}
    </div>
  )
}

// -------------------------------------------------------------
// Embed Component (iFrame)
// -------------------------------------------------------------
function EmbedWidget({ code, onChange }: { code: string, onChange: (code: string) => void }) {
  const [inputCode, setInputCode] = useState(code || '')
  const [isEditing, setIsEditing] = useState(!code)

  const applyEmbed = () => {
    onChange(inputCode.trim())
    setIsEditing(false)
  }

  // Detect Tweet URL
  const tweetMatch = code?.match(/twitter\.com\/.*\/status\/(\d+)|x\.com\/.*\/status\/(\d+)/)
  const tweetId = tweetMatch ? (tweetMatch[1] || tweetMatch[2]) : null

  // Detect general Video URL (YouTube, Vimeo, etc)
  const isVideoUrl = code && !code.includes('<iframe') && !tweetId && (code.includes('youtube.com') || code.includes('youtu.be') || code.includes('vimeo.com') || code.includes('twitch.tv'))

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
            {code && <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-neutral-500 hover:text-neutral-800 py-2 px-4 transition-colors">취소</button>}
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
                <ReactPlayer url={code} width="100%" height="100%" controls />
              </div>
            ) : (
              <div className="w-full flex justify-center pointer-events-none" dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? require('isomorphic-dompurify').sanitize(code, { ADD_TAGS: ['iframe'] }) : code }} />
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
// Main Editor Canvas
// -------------------------------------------------------------
export default function EditorCanvas({ creatorName, sectionId, initialProject, initialWidgets, categories = [] }: { creatorName: string, sectionId?: string, initialProject?: any, initialWidgets?: any, categories?: any[] }) {
  const [isMounted, setIsMounted] = useState(false)
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
    setTimeout(() => setSaveStatus('saved'), 300)
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

  const addWidget = (type: WidgetType) => {
    setIsDirty(true)
    const newId = Date.now().toString()
    setWidgets([...widgets, { id: newId, type, content: type === 'text' ? '' : type === 'image_grid' ? [] : '' }])
  }

  const updateWidgetContent = (id: string, newContent: any) => {
    setIsDirty(true)
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, content: newContent } : w))
  }

  const deleteWidget = (id: string) => {
    setIsDirty(true)
    setWidgets(prev => prev.filter(w => w.id !== id))
  }

  if (!isMounted) return null // dnd-kit Client-side hydration safeguard

  return (
    <>
      <header className="h-14 border-b border-neutral-200 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-20 relative">
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
            onPublishStart={() => {
              setIsDirty(false);
              removeCurrentDraft();
            }}
          />
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

          <div className="grid grid-cols-2 gap-4 mb-8">
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

          <div className="mt-auto border-t border-neutral-100 pt-6">
            <div className="bg-red-50 p-4 rounded-xl text-xs text-red-800 leading-relaxed font-medium">
              🚨 비디오 업로드는 **1GB 용량 제한**이 작동 중입니다. 하드디스크 자원 관리에 유의하세요.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

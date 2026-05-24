'use client'

import { useState } from 'react'
import { publishProjectAction } from '@/app/actions/publish'
import { uploadFileAction } from '@/app/actions/upload'

export default function PublishSettingsModal({ creatorName, widgets, sectionId, initialProject, categories = [], onPublishStart }: { creatorName: string, widgets: any[], sectionId?: string, initialProject?: any, categories?: any[], onPublishStart?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(initialProject?.thumbnail_url || null)
  const [uploading, setUploading] = useState(false)

  // Parse [SIZE:WxH] or [SIZE:W] and clean title from initialProject
  const getInitialSizeAndCleanTitle = () => {
    const rawTitle = initialProject?.title || ''
    const sizeMatch = rawTitle.match(/\[SIZE:([1-3])(?:x([1-3]))?\]/)
    const width = sizeMatch ? sizeMatch[1] : '1'
    const height = sizeMatch && sizeMatch[2] ? sizeMatch[2] : '1'
    const cleanTitle = rawTitle.replace(/\[SIZE:[1-3](?:x[1-3])?\]/, '').trim()
    return { width, height, cleanTitle }
  }

  const initialData = getInitialSizeAndCleanTitle()
  const [cardWidth, setCardWidth] = useState<string>(initialData.width)
  const [cardHeight, setCardHeight] = useState<string>(initialData.height)
  const [title, setTitle] = useState<string>(initialData.cleanTitle)

  // 프로젝트 제작 연도 및 월 설정 상태 추가
  const getInitialYearAndMonth = () => {
    const d = initialProject?.created_at ? new Date(initialProject.created_at) : new Date()
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1)
    }
  }

  const initDate = getInitialYearAndMonth()
  const [projectYear, setProjectYear] = useState<string>(initDate.year)
  const [projectMonth, setProjectMonth] = useState<string>(initDate.month)

  // Extract all images uploaded inside the editor widgets
  const canvasImages = widgets
    .filter(w => w.type === 'image_grid' && Array.isArray(w.content))
    .flatMap(w => w.content as string[])

  const finalCoverUrl = coverUrl || (canvasImages.length > 0 ? canvasImages[0] : null)

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setUploading(true)
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    try {
      const url = await uploadFileAction(formData)
      if (url) setCoverUrl(url)
    } catch (err) {
      console.error(err)
    }
    setUploading(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs sm:text-sm px-4 sm:px-6 py-2 rounded-full transition-colors shadow-sm"
      >
        계속
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-2 sm:p-4 backdrop-blur-[2px]">
          <form 
            action={publishProjectAction} 
            onSubmit={() => {
              if (onPublishStart) onPublishStart();
            }}
            className="bg-[#f8f8f8] w-full max-w-[1000px] max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Hidden fields mapped for Server Action Payload */}
            {initialProject?.id && <input type="hidden" name="project_id" value={initialProject.id} />}
            <input type="hidden" name="creator_name" value={creatorName} />
            <input type="hidden" name="widgets_json" value={JSON.stringify(widgets)} />
            {sectionId && <input type="hidden" name="section_id" value={sectionId} />}
            {finalCoverUrl && <input type="hidden" name="thumbnail_url" value={finalCoverUrl} />}
            <input type="hidden" name="created_at" value={`${projectYear}-${String(projectMonth).padStart(2, '0')}-01T00:00:00.000Z`} />

            {/* Header */}
            <div className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-6 shrink-0">
              <h2 className="font-bold text-neutral-800 tracking-tight">프로젝트 설정</h2>
              <button type="button" onClick={() => setIsOpen(false)} className="text-2xl font-light text-neutral-400 hover:text-neutral-800 transition-colors">
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col md:flex-row gap-8">

              {/* Left Column: Cover Selector */}
              <div className="w-full md:w-[320px] shrink-0">
                <p className="text-xs font-bold text-neutral-500 mb-3 uppercase tracking-wide">프로젝트 표지 (필수)</p>

                <div className="bg-white border hover:border-blue-300 border-neutral-200 rounded-lg flex items-center justify-center text-neutral-500 transition-all duration-300 min-h-[220px] relative overflow-hidden shadow-sm group">
                  {finalCoverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={finalCoverUrl} alt="Cover" className="w-full h-full absolute inset-0 object-cover" />
                  ) : (
                    <p className="text-xs text-neutral-400 text-center px-4 leading-relaxed z-10">
                      표지 이미지가 없습니다.<br />캔버스에 이미지를 추가하거나<br />아래에서 업로드하세요.
                    </p>
                  )}
                </div>

                {uploading && <div className="text-blue-500 text-xs font-bold mt-2 text-center">사진 업로드 중...</div>}

                {/* Canvas Image Carousel Picker */}
                {canvasImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-bold text-neutral-500 mb-2">본문에서 선택하기</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {canvasImages.map((url, idx) => (
                        <div
                          key={idx}
                          onClick={() => setCoverUrl(url)}
                          className={`w-16 h-12 shrink-0 rounded cursor-pointer border-2 transition-all overflow-hidden ${finalCoverUrl === url ? 'border-blue-600 shadow-md ring-2 ring-blue-200' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Canvas img ${idx}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <label className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-center cursor-pointer border py-2 rounded font-bold text-xs transition-colors">
                    새로운 파일로 교체
                    <input type="file" className="hidden" accept="image/*" onChange={handleCustomUpload} disabled={uploading} />
                  </label>
                </div>

              </div>

              {/* Right Column: Metadata */}
              <div className="flex-1 flex flex-col gap-6">

                <div className="bg-white border border-neutral-200 p-6 rounded-lg shadow-sm">
                  <h3 className="text-sm font-extrabold text-neutral-800 mb-5 pb-3 border-b border-neutral-100">프로젝트 정보</h3>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-2">제목 (필수)</label>
                      <input 
                        type="text" 
                        required 
                        value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        placeholder="프로젝트 제목 입력" 
                        className="w-full border border-neutral-300 rounded bg-white text-neutral-900 font-medium p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow mb-4" 
                      />
                      
                      {/* Hidden Title input containing merged metadata tag for Server Action */}
                      <input 
                        type="hidden" 
                        name="title" 
                        value={title.trim() + (cardWidth !== '1' || cardHeight !== '1' ? ` [SIZE:${cardWidth}x${cardHeight}]` : '')} 
                      />

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-neutral-600 mb-2">카드 가로 크기 (Width)</label>
                          <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-lg border border-neutral-200/60">
                            {[
                              { value: '1', label: '1칸', desc: '기본 폭' },
                              { value: '2', label: '2칸', desc: '넓은 폭' },
                              { value: '3', label: '3칸', desc: '전체 폭' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setCardWidth(opt.value)}
                                className={`flex-1 py-2 px-3 rounded-md text-xs font-extrabold transition-all duration-200 ${
                                  cardWidth === opt.value
                                    ? 'bg-white text-blue-600 shadow-sm border border-neutral-200/40 scale-[1.02]'
                                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-white/40'
                                }`}
                              >
                                <div>{opt.label}</div>
                                <div className="text-[9px] text-neutral-400 font-medium mt-0.5">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-neutral-600 mb-2">카드 세로 크기 (Height)</label>
                          <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-lg border border-neutral-200/60">
                            {[
                              { value: '1', label: '1칸', desc: '기본 높이' },
                              { value: '2', label: '2칸', desc: '높은 높이' },
                              { value: '3', label: '3칸', desc: '전체 높이' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setCardHeight(opt.value)}
                                className={`flex-1 py-2 px-3 rounded-md text-xs font-extrabold transition-all duration-200 ${
                                  cardHeight === opt.value
                                    ? 'bg-white text-emerald-600 shadow-sm border border-neutral-200/40 scale-[1.02]'
                                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-white/40'
                                }`}
                              >
                                <div>{opt.label}</div>
                                <div className="text-[9px] text-neutral-400 font-medium mt-0.5">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-500">최종 카드 크기 레이아웃</span>
                          <span className="font-mono font-extrabold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded text-sm tracking-wide">
                            {cardWidth} x {cardHeight}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-2">제작 연도 및 월 설정</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select 
                            value={projectYear} 
                            onChange={e => setProjectYear(e.target.value)} 
                            className="w-full border border-neutral-300 rounded bg-white text-neutral-900 font-medium p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
                          >
                            {Array.from({ length: 2035 - 1995 + 1 }, (_, i) => String(1995 + i)).reverse().map(yr => (
                              <option key={yr} value={yr}>{yr}년</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select 
                            value={projectMonth} 
                            onChange={e => setProjectMonth(e.target.value)} 
                            className="w-full border border-neutral-300 rounded bg-white text-neutral-900 font-medium p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
                          >
                            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(mon => (
                              <option key={mon} value={mon}>{mon}월</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1.5">
                        선택하신 년도와 월이 포트폴리오 메인 카드 하단에 노출됩니다.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-2">카테고리 (선택)</label>
                      <select name="category_id" defaultValue={initialProject?.category_id || ''} className="w-full border border-neutral-300 rounded bg-white text-neutral-900 font-medium p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow">
                        <option value="">카테고리 없음</option>
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 p-6 rounded-lg shadow-sm">
                  <h3 className="text-sm font-extrabold text-neutral-800 mb-5 pb-3 border-b border-neutral-100">추가 세부 정보</h3>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-2">설명</label>
                      <textarea rows={3} name="description" defaultValue={initialProject?.description || ''} placeholder="프로젝트에 대한 간단한 설명 추가" className="w-full border border-neutral-300 rounded bg-white text-neutral-900 font-medium p-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow resize-none" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-2">
                        유튜브 영상 등록 (선택사항)
                      </label>
                      <input 
                        type="url" 
                        name="youtube_url" 
                        defaultValue={initialProject?.youtube_url || ''}
                        placeholder="https://www.youtube.com/watch?v=..." 
                        className="w-full border border-neutral-300 rounded bg-white text-neutral-900 font-medium p-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-shadow" 
                      />
                      <p className="text-[11px] text-neutral-500 mt-2">
                        유튜브 링크를 등록하면 사진 썸네일 대신 포트폴리오 메인에서 영상이 직접 재생됩니다.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="h-16 border-t border-neutral-200 bg-white flex items-center justify-between px-6 shrink-0 relative z-10">
              <button type="button" onClick={() => setIsOpen(false)} className="text-sm font-bold text-neutral-500 hover:text-neutral-800 transition-colors">
                취소
              </button>
              <button type="submit" className="bg-[#00c853] hover:bg-green-600 text-white font-bold text-sm px-8 py-2.5 rounded-full transition-colors shadow">
                게시
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

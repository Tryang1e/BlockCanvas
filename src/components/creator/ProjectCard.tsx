'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Sparkles, EyeOff } from 'lucide-react'
import ProjectActionButtons from './ProjectActionButtons'
import ScrollReveal from '@/components/ui/ScrollReveal'
import BlockImage from '@/components/ui/BlockImage'

// Helper to extract first image from widgets or Tiptap JSON content
const getFirstImageFromContent = (contentStr: string | null): string | null => {
  if (!contentStr) return null
  try {
    const parsed = JSON.parse(contentStr)
    if (Array.isArray(parsed)) {
      for (const widget of parsed) {
        if (widget.type === 'image' || widget.widget_type === 'image' || widget.type === 'image_grid') {
          const urls = widget.content?.urls || widget.content || []
          if (Array.isArray(urls) && urls[0]) {
            return urls[0]
          } else if (typeof urls === 'string') {
            return urls
          }
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      if (parsed.content && Array.isArray(parsed.content)) {
        for (const node of parsed.content) {
          if (node.type === 'image' && node.attrs && node.attrs.src) {
            return node.attrs.src
          }
        }
      }
    }
  } catch (e) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/i
    const match = contentStr.match(imgRegex)
    if (match && match[1]) return match[1]
  }
  return null
}

const premiumGradients = [
  'from-neutral-900 via-zinc-800 to-neutral-950',
  'from-slate-900 via-slate-800 to-neutral-950',
  'from-stone-900 via-stone-800 to-neutral-950',
  'from-zinc-900 via-neutral-800 to-zinc-950'
]

interface ProjectCardProps {
  project: any
  creatorName: string
  isOwner?: boolean
  isOverlay?: boolean
  onOpenProject?: (projectId: string) => void
  globalIsDragging?: boolean
  isGridItem?: boolean
  /** 도록(카탈로그) 번호용 카드 순번 — 목록 map 인덱스(0-base). 없으면 № 표기를 생략 */
  index?: number
}

// YouTube URL to Embed URL converter
function getYouTubeEmbedUrl(url: string | null) {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`
  }
  return null
}

// 프로젝트 제목에서 [SIZE:WxH] 또는 [SIZE:W] 메타 지시어를 제거하여 렌더링용 순수 타이틀을 발굴하는 헬퍼
export function parseProjectTitleAndSize(title: string) {
  if (!title) return { displayTitle: '', colSpanClass: 'lg:col-span-1', rowSpanClass: 'row-span-1', w: 1, h: 1 }
  const match = title.match(/\[\s*SIZE\s*:\s*([1-3])\s*(?:[xX]\s*([1-3]))?\s*\]/i)
  if (match) {
    const wStr = match[1]
    const hStr = match[2] || '1'
    const w = parseInt(wStr, 10)
    const h = parseInt(hStr, 10)
    const displayTitle = title.replace(/\[\s*SIZE\s*:\s*[1-3]\s*(?:[xX]\s*[1-3])?\s*\]/gi, '').trim()
    
    let colSpanClass = 'lg:col-span-1'
    if (wStr === '2') colSpanClass = 'lg:col-span-2 sm:col-span-2'
    if (wStr === '3') colSpanClass = 'lg:col-span-3 sm:col-span-2 lg:col-span-3'
    
    let rowSpanClass = 'row-span-1'
    if (hStr === '2') rowSpanClass = 'row-span-2'
    if (hStr === '3') rowSpanClass = 'row-span-3'
    
    return { displayTitle, colSpanClass, rowSpanClass, w, h }
  }
  return { displayTitle: title, colSpanClass: 'lg:col-span-1', rowSpanClass: 'row-span-1', w: 1, h: 1 }
}

function ProjectCard({ project, creatorName, isOwner, isOverlay, onOpenProject, globalIsDragging, isGridItem, index }: ProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    disabled: !isOwner,
    data: {
      type: 'Project',
      project,
    },
  })

  const embedUrl = getYouTubeEmbedUrl(project.youtube_url)
  const { displayTitle, w, h } = parseProjectTitleAndSize(project.title)

  // 도록 캡션용 날짜(YYYY.MM, 월 제로패딩) — 기존 "2026 7 7" 구분자 누락 렌더 버그 수정
  const createdAt = new Date(project.created_at)
  const dateLabel = `${createdAt.getFullYear()}.${String(createdAt.getMonth() + 1).padStart(2, '0')}`
  // 도록 번호(№ 01) — index prop이 있을 때만 표기(0-base → 1-base, 2자리 제로패딩)
  const indexLabel = typeof index === 'number' && index >= 0 ? String(index + 1).padStart(2, '0') : null
  const fallbackGradient = premiumGradients[Math.abs(project.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % 4]
  const projectThumbnail = project.thumbnail_url || getFirstImageFromContent(project.content)

  // 100% 퍼센트 붕괴를 영원히 소멸시키는 궁극의 Container Query 단일 픽셀 수식!!!
  // 부모 그리드가 이미 컨테이너 실시간 가로 너비를 환산하여 완벽한 1칸 너비 var(--col-width)를 넘겨주므로,
  // 퍼센트 기호(%)를 단 한 글자도 쓰지 않고 오직 100% cqw 픽셀 변수로만 높이를 연산하여 붕괴를 원천 방어합니다!!!
  const colWidthVar = 'var(--col-width, 100cqw)'
  const rowHeightFormula = `calc(${colWidthVar} * 9 / 16)`
  const calculatedHeight = `calc(${h} * ${rowHeightFormula} + (${h} - 1) * var(--grid-gap, 24px))`

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isOverlay ? 999 : isDragging ? 0 : 1,
    opacity: isDragging && !isOverlay ? 0.35 : 1,
    border: isDragging && !isOverlay ? '3px dashed rgba(59,130,246,0.6)' : undefined,
    backgroundColor: isDragging && !isOverlay ? 'rgba(59,130,246,0.03)' : undefined,
    borderRadius: 'var(--card-corner-radius, 0px)',
    height: isGridItem ? calculatedHeight : undefined, // 이미지 그리드일 때만 기하학적 정밀 수식 작동!
    aspectRatio: isGridItem ? undefined : '16 / 9', // 일반 비디오 섹션 등에서는 오리지널 16:9 보장!
  }

  return (
    <div 
      ref={isOverlay ? undefined : setNodeRef} 
      style={style} 
      {...(!isOverlay ? attributes : {})} 
      {...(!isOverlay ? listeners : {})}
      className={`block group break-inside-avoid relative w-full ${isGridItem ? 'h-full' : ''} ${isOwner && !isOverlay ? 'cursor-grab active:cursor-grabbing touch-none select-none' : ''}`}
    >
      <ScrollReveal animationClass="opacity-0 translate-y-12 scale-95" className="w-full h-full" disableAnimation={globalIsDragging || isOverlay}>
        {/* 이미지/미디어 자체가 단 1px의 오차나 잘림 여백 없이 카드의 물리 WxH 전체를 100% 꽉 채우도록 구성 */}
        <div
          className={`w-full h-full relative border border-neutral-100 dark:border-neutral-800/80 overflow-hidden shadow-sm transition-all duration-500 bg-neutral-100 dark:bg-neutral-900 ${isOwner && project.is_published === false ? 'opacity-55' : ''}`}
          style={{ borderRadius: 'var(--card-corner-radius, 0px)' }}
        >
          {/* 소유자에게만: 비공개 게시물 배지(항상 노출). 방문자에겐 비공개 글 자체가 안 보임. */}
          {isOwner && project.is_published === false && (
            <div className="absolute top-3 left-3 z-40 bg-black/75 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none shadow-md">
              <EyeOff size={11} /> 비공개
            </div>
          )}

          {/* Hover Overlay Action Buttons */}
          <div className="absolute inset-0 z-30 pointer-events-none">
             <ProjectActionButtons projectId={project.id} creatorName={creatorName} isOwner={isOwner} isPublished={project.is_published !== false} />
          </div>

          {/* Media Layer (w-full h-full object-cover를 통해 이미지 왜곡 없이 가로/세로 영역 가득 채움) */}
          {embedUrl ? (
            // YouTube Embed
            <div className="w-full h-full pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
              <iframe 
                src={embedUrl} 
                title={displayTitle}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            </div>
          ) : (
            // Standard Image Thumbnail (100% image-fill & object-cover)
            <div onClick={() => onOpenProject?.(project.id)} className="absolute inset-0 z-10 block cursor-pointer w-full h-full">
              {projectThumbnail ? (
                <BlockImage
                  src={projectThumbnail}
                  alt={displayTitle}
                  blurDataURL={project.blur_data_url}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  draggable={false}
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                  <div className="text-[8px] text-white/30 tracking-[0.2em] font-black uppercase mb-3">
                    PORTFOLIO
                  </div>
                  <h3 className="text-xs md:text-sm font-extrabold text-white/90 leading-snug tracking-tight max-w-[160px] line-clamp-3 my-1 break-keep">
                    {displayTitle}
                  </h3>
                  <div className="flex items-center gap-1 mt-3 opacity-30">
                    <span className="h-[1px] w-3 bg-white/40" />
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                    <span className="h-[1px] w-3 bg-white/40" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clean Overlay information — 미술관 도록(카탈로그) 3단 캡션, 60ms 계단식 등장(호버 시에만).
              터치 기기(hover:none)에는 호버가 없어 캡션이 영영 안 보이므로 상시 노출 폴백:
              전체 딤 대신 하단 그라디언트 스크림만 깔아 썸네일 시인성을 지킨다(데스크톱 동작 불변). */}
          {!embedUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 pointer-events-none z-20 [@media(hover:none)]:opacity-100 [@media(hover:none)]:from-black/70 [@media(hover:none)]:via-transparent">
              {/* 래퍼는 pointer-events-none — 라벨/칩 등 비인터랙티브 영역 탭이 아래 미디어 레이어로 통과해 카드 탭 내비게이션 유지 */}
              <div className="pointer-events-none">
                {/* Tier 1 — 모노 마이크로 라벨: № {순번} — {YYYY.MM} (№·—는 Minecraft.ttf에 없으므로 픽셀폰트 스팬 밖에 유지) */}
                <div className="flex items-baseline gap-2 mb-2 text-neutral-300 font-mono text-[10px] uppercase tracking-[0.25em] drop-shadow-md opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0">
                  {indexLabel && (
                    <>
                      <span aria-hidden="true">№</span>
                      <span className="bc-pixel-num text-[11px]">{indexLabel}</span>
                      <span aria-hidden="true" className="text-white/40">—</span>
                    </>
                  )}
                  <span className="bc-pixel-num text-[11px]">{dateLabel}</span>
                </div>

                {/* Tier 2 — 제목(기존 타이포 유지, 클릭 시 프로젝트 열기) */}
                <div className="opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out delay-0 group-hover:delay-[60ms] [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0">
                  <div onClick={() => onOpenProject?.(project.id)} className="pointer-events-auto inline-block hover:opacity-80 transition-opacity cursor-pointer">
                    <h3 className="text-white font-extrabold text-2xl tracking-tight leading-tight drop-shadow-md">{displayTitle}</h3>
                  </div>
                </div>

                {/* Tier 3 — 작가(크리에이터) 칩: 프로젝트 데이터에 카테고리명이 없어(category_id만 존재) 크리에이터명으로 표기 */}
                <div className="mt-3 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out delay-0 group-hover:delay-[120ms] [@media(hover:none)]:opacity-100 [@media(hover:none)]:translate-y-0">
                  <span className="inline-flex items-center border border-white/30 rounded-full px-2.5 py-[3px] text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-200 drop-shadow-md backdrop-blur-[2px]">
                    {creatorName}
                  </span>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </ScrollReveal>
    </div>
  )
}

export default React.memo(ProjectCard)

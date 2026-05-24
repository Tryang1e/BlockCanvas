'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProjectActionButtons from './ProjectActionButtons'
import ScrollReveal from '@/components/ui/ScrollReveal'

interface ProjectCardProps {
  project: any
  creatorName: string
  isOwner?: boolean
  isOverlay?: boolean
  onOpenProject?: (projectId: string) => void
  globalIsDragging?: boolean
  isGridItem?: boolean
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
  const match = title.match(/\[SIZE:([1-3])(?:x([1-3]))?\]/)
  if (match) {
    const wStr = match[1]
    const hStr = match[2] || '1'
    const w = parseInt(wStr, 10)
    const h = parseInt(hStr, 10)
    const displayTitle = title.replace(/\[SIZE:[1-3](?:x[1-3])?\]/, '').trim()
    
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

function ProjectCard({ project, creatorName, isOwner, isOverlay, onOpenProject, globalIsDragging, isGridItem }: ProjectCardProps) {
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
    opacity: isDragging && !isOverlay ? 0 : 1,
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
          className="w-full h-full relative border border-neutral-100 dark:border-neutral-800/80 overflow-hidden shadow-sm transition-all duration-500 bg-neutral-100 dark:bg-neutral-900"
          style={{ borderRadius: 'var(--card-corner-radius, 0px)' }}
        >
          {/* Hover Overlay Action Buttons */}
          <div className="absolute inset-0 z-30 pointer-events-none">
             <ProjectActionButtons projectId={project.id} creatorName={creatorName} isOwner={isOwner} />
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
              {project.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={project.thumbnail_url} alt={displayTitle} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" draggable={false} />
              ) : (
                <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800 flex flex-col items-center justify-center text-neutral-400 font-medium">
                  <span className="text-3xl mb-2">🖼️</span>
                  <span>No Thumbnail</span>
                </div>
              )}
            </div>
          )}

          {/* Clean Overlay information (Only shown on Hover over the media area) */}
          {!embedUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 pointer-events-none z-20">
              <div className="pointer-events-auto transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                {/* Clickable title link */}
                <div onClick={() => onOpenProject?.(project.id)} className="inline-block hover:opacity-80 transition-opacity cursor-pointer">
                  <h3 className="text-white font-extrabold text-2xl tracking-tight leading-tight drop-shadow-md">{displayTitle}</h3>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                  <p className="text-neutral-300 text-sm font-medium drop-shadow-md line-clamp-1 tracking-wider">
                    {new Date(project.created_at).getFullYear()} {new Date(project.created_at).getMonth() + 1}
                  </p>
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

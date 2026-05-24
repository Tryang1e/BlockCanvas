'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import ProjectCard from './ProjectCard'
import Link from 'next/link'
import { updateSectionTitleVisibilityAction, updateSectionAnimationAction, updateSectionVisibilityAction } from '@/app/actions/section'
import { Eye, EyeOff, Sparkles, Type, Trash2, GripHorizontal, Globe, Lock, ChevronDown } from 'lucide-react'
import HTMLRenderer from '@/components/ui/HTMLRenderer'
import WipTimelineSection from './WipTimelineSection'
import Tooltip from '@/components/ui/Tooltip'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 1. 텍스트 섹션 내부용 고품격 커스터마이징 FAQ 아코디언 토글 컴포넌트
function FaqAccordion({ 
  question, 
  answer, 
  styles = {} 
}: { 
  question: string, 
  answer: string, 
  styles?: Record<string, string> 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cleanQuestion = (question || '').replace(/^Q\s*\.\s*/i, '').replace(/^Q\s+/i, '');

  const qFont = styles['q-font'] || 'inherit'
  const qSize = styles['q-size'] || '15px'
  const qColor = styles['q-color'] || ''
  const qBold = styles['q-bold'] === 'true'
  const qItalic = styles['q-italic'] === 'true'

  const aFont = styles['a-font'] || 'inherit'
  const aSize = styles['a-size'] || '14px'
  const aColor = styles['a-color'] || ''
  const aBold = styles['a-bold'] === 'true'
  const aItalic = styles['a-italic'] === 'true'

  const borderStyle = styles['border-style'] || 'minimal'
  const hoverBg = styles['hover-bg'] || 'tint'

  // 테마별/보더 스타일별 래퍼 클래스 및 장식적 요소 빌드
  let wrapperClass = "transition-all duration-300 select-none group/faq relative overflow-hidden "
  let decorationLeftBar = null
  let listDotIndicator = null

  if (borderStyle === 'glass') {
    // 1. 피그마 글래스모피즘: 화이트 바탕에서도 완벽히 입체적으로 구별되는 영롱한 Glass Card
    wrapperClass += "bg-gradient-to-br from-white/95 to-white/40 dark:from-neutral-900/95 dark:to-neutral-900/40 backdrop-blur-md border border-white/80 dark:border-neutral-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] rounded-2xl px-6 py-5 my-4 hover:border-blue-500/30 dark:hover:border-blue-400/30 transform hover:-translate-y-0.5 "
  } else if (borderStyle === 'solid') {
    // 2. 모던 솔리드 블록: 좌측 시그니처 굵은 블루 바가 박혀 확실한 존재감을 드러내는 위젯 형태
    wrapperClass += "border border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 rounded-xl pl-6 pr-5 py-4.5 my-3 "
    decorationLeftBar = (
      <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-blue-600 dark:bg-blue-500" />
    )
  } else {
    // 3. Stripe Minimal: 극도로 얇고 깔끔한 하단선에 깜찍한 블루 도트 리스트 지시자가 달린 명품형
    wrapperClass += "border-b border-neutral-200/80 dark:border-neutral-800/60 py-5 "
    listDotIndicator = (
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mr-2.5 shrink-0 transition-transform duration-300 group-hover/faq:scale-130" />
    )
  }

  if (hoverBg === 'tint' && borderStyle !== 'glass') {
    wrapperClass += "hover:bg-blue-50/20 dark:hover:bg-blue-950/5 rounded-lg px-2.5 -mx-2.5 "
  }

  const questionStyle: React.CSSProperties = {
    fontFamily: qFont !== 'inherit' ? qFont : undefined,
    fontSize: qSize,
    color: qColor || undefined,
    fontWeight: qBold ? 'bold' : 'normal',
    fontStyle: qItalic ? 'italic' : 'normal',
  }

  const answerStyle: React.CSSProperties = {
    fontFamily: aFont !== 'inherit' ? aFont : undefined,
    fontSize: aSize,
    color: aColor || undefined,
    fontWeight: aBold ? 'bold' : 'normal',
    fontStyle: aItalic ? 'italic' : 'normal',
  }

  return (
    <div className={wrapperClass}>
      {decorationLeftBar}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer text-neutral-900 dark:text-neutral-100 pr-1 gap-6 hover:opacity-85 transition-opacity"
      >
        <div className="flex items-center select-text">
          {listDotIndicator}
          <span 
            style={questionStyle}
            className="tracking-tight leading-relaxed font-semibold"
          >
            {cleanQuestion || '질문이 비어있습니다.'}
          </span>
        </div>
        <ChevronDown 
          size={16} 
          strokeWidth={2.5}
          className={`text-neutral-450 dark:text-neutral-550 transition-all duration-300 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-450 scale-105' : 'group-hover/faq:text-neutral-700 dark:group-hover/faq:text-neutral-300'
          }`}
        />
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{
              overflow: 'hidden',
            }}
          >
            <p 
              style={answerStyle}
              className="leading-relaxed whitespace-pre-wrap mt-3.5 pr-2 text-left select-text"
            >
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 2. 텍스트 본문에서 [FAQ: 질문] 답변 형태 및 HTML faq-block 형태를 자동 감지 파싱해주는 컴포넌트
function ParsedTextContent({ content }: { content: string }) {
  // 신규 Tiptap 에디터 마크업(아코디언 또는 컬럼)이 존재할 경우 마크업 깨짐을 원천 차단하기 위해 HTMLRenderer 단일 렌더러로 통째 호출
  if (content && (content.includes('data-type="faq-block"') || content.includes('data-type="column-block"'))) {
    return <HTMLRenderer html={content} />
  }

  const parts = useMemo(() => {
    if (!content) return []

    // 1단계: HTML faq-block 파싱 정규식 (중첩 태그 닫기 꼬임을 원천 차단하기 위해 자식 없는 단일 닫는 태그 형태로 파싱)
    const htmlFaqRegex = /<div\s+data-type="faq-block"\s+data-question="([^"]*)"\s+data-answer="([^"]*)"([^>]*?)>\s*([\s\S]*?)<\/div>/g
    const results = []
    let lastIndex = 0
    let match

    while ((match = htmlFaqRegex.exec(content)) !== null) {
      const beforeContent = content.substring(lastIndex, match.index)
      if (beforeContent.trim()) {
        results.push({ type: 'html_raw', value: beforeContent })
      }

      // 나머지 data- 스타일 어트리뷰트 파싱
      const attrString = match[3] || ''
      const styles: Record<string, string> = {}
      const attrRegex = /data-([a-zA-Z0-9\-]+)="([^"]*)"/g
      let attrMatch
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        styles[attrMatch[1]] = attrMatch[2]
      }

      results.push({ 
        type: 'faq', 
        question: match[1], 
        answer: match[2],
        styles 
      })
      lastIndex = htmlFaqRegex.lastIndex
    }

    const afterContent = content.substring(lastIndex)
    if (afterContent.trim() || results.length === 0) {
      results.push({ type: 'html_raw', value: afterContent || content })
    }

    // 2단계: 각각의 html_raw 파트 내부에서 텍스트 형식의 [FAQ: 질문] 답변 매칭 수행
    const finalResults: any[] = []
    const legacyFaqRegex = /\[FAQ:\s*(.*?)\s*\]\s*([\s\S]*?)(?=(?:\[FAQ:|$))/g

    for (const part of results) {
      if (part.type === 'faq') {
        finalResults.push(part)
      } else {
        const textContent = part.value || ''
        let legacyLastIndex = 0
        let legacyMatch
        let matchedLegacy = false

        while ((legacyMatch = legacyFaqRegex.exec(textContent)) !== null) {
          matchedLegacy = true
          const textBefore = textContent.substring(legacyLastIndex, legacyMatch.index)
          if (textBefore.trim()) {
            finalResults.push({ type: 'text', value: textBefore })
          }
          finalResults.push({ type: 'faq', question: legacyMatch[1], answer: legacyMatch[2], styles: {} })
          legacyLastIndex = legacyFaqRegex.lastIndex
        }

        const textAfter = textContent.substring(legacyLastIndex)
        if (textAfter.trim() || !matchedLegacy) {
          finalResults.push({ type: 'text', value: textAfter || textContent })
        }
      }
    }

    return finalResults
  }, [content])

  return (
    <div className="w-full">
      {parts.map((part, index) => {
        if (part.type === 'faq') {
          return <FaqAccordion key={index} question={part.question!} answer={part.answer!} styles={part.styles} />
        }
        return <HTMLRenderer key={index} html={part.value!} />
      })}
    </div>
  )
}

// 3. 프로젝트 제목에서 [SIZE:WxH] 또는 [SIZE:W] 메타 태그를 읽어 col-span 및 row-span 클래스로 매핑해주는 파서
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
    
    // 사용자가 입력한 세로 스팬 h를 그대로 살려 gap을 완벽히 흡수하는 기하학적 격자 박스를 구현!
    let rowSpanClass = 'row-span-1'
    if (hStr === '2') rowSpanClass = 'row-span-2'
    if (hStr === '3') rowSpanClass = 'row-span-3'
    
    return { displayTitle, colSpanClass, rowSpanClass, w, h }
  }
  return { displayTitle: title, colSpanClass: 'lg:col-span-1', rowSpanClass: 'row-span-1', w: 1, h: 1 }
}

interface SectionContainerProps {
  section: any
  projects: any[]
  allProjects?: any[]
  wipLogs?: any[]
  creatorName: string
  isOwner?: boolean
  onRename: () => void
  onDelete: () => void
  onAddVideoProject?: (sectionId: string) => void
  onEditText?: () => void
  onOpenProject?: (projectId: string) => void
  isOverlay?: boolean
  globalIsDragging?: boolean
}

function SectionContainer({
  section,
  projects,
  allProjects = [],
  wipLogs = [],
  creatorName,
  isOwner = false,
  onRename,
  onDelete,
  onAddVideoProject,
  onEditText,
  onOpenProject,
  isOverlay = false,
  globalIsDragging = false
}: SectionContainerProps) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [showTitle, setShowTitle] = useState(section.show_title !== false) // defaults to true
  const [isPublic, setIsPublic] = useState(section.is_visible !== false) // defaults to true

  const handleToggleTitle = async (e: React.PointerEvent) => {
    e.stopPropagation()
    const newShowTitle = !showTitle
    setShowTitle(newShowTitle)
    await updateSectionTitleVisibilityAction(section.id, newShowTitle, creatorName)
  }

  const handleToggleVisibility = async (e: React.PointerEvent) => {
    e.stopPropagation()
    const newVisibility = !isPublic
    setIsPublic(newVisibility)
    await updateSectionVisibilityAction(section.id, newVisibility, creatorName)
  }

  const [isAnimDropdownOpen, setIsAnimDropdownOpen] = useState(false)
  const [animType, setAnimType] = useState(section.animation_type || 'fade-up')
  const handleAnimationChange = async (newType: string) => {
    setAnimType(newType)
    await updateSectionAnimationAction(section.id, newType, creatorName)
  }

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: section.id,
    data: {
      type: 'Section',
      section,
    },
  })

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    disabled: !isOwner,
    data: {
      type: 'Section',
      section,
    },
  })

  useEffect(() => {
    if (isDragging || !sectionRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsVisible(entry.isIntersecting)
        }
      },
      {
        threshold: 0,
        rootMargin: '-15% 0px -15% 0px' // Trigger slightly inside the viewport
      }
    )

    observer.observe(sectionRef.current)

    return () => observer.disconnect()
  }, [isDragging])

  const scrollLeft = () => {
    if (sliderRef.current) {
      const scrollAmount = sliderRef.current.clientWidth * 0.8
      sliderRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (sliderRef.current) {
      const scrollAmount = sliderRef.current.clientWidth * 0.8
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }


  const style = {
    transform: CSS.Transform.toString(transform) || 'translate3d(0,0,0)',
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1,
    willChange: 'transform',
  }

  const sectionType = section.section_type || 'image_grid'

  let hiddenClass = 'opacity-0 scale-95 translate-y-12' // fade-up default
  let visibleClass = 'opacity-100 scale-100 translate-y-0'

  const projectIds = useMemo(() => projects.map(p => p.id), [projects])

  if (animType === 'fade-in') {
    hiddenClass = 'opacity-0'
    visibleClass = 'opacity-100'
  } else if (animType === 'zoom-in') {
    hiddenClass = 'opacity-0 scale-75'
    visibleClass = 'opacity-100 scale-100'
  } else if (animType === 'slide-right') {
    hiddenClass = 'opacity-0 -translate-x-24'
    visibleClass = 'opacity-100 translate-x-0'
  } else if (animType === 'slide-left') {
    hiddenClass = 'opacity-0 translate-x-24'
    visibleClass = 'opacity-100 translate-x-0'
  } else if (animType === 'slide-up') {
    hiddenClass = 'opacity-0 translate-y-24'
    visibleClass = 'opacity-100 translate-y-0'
  }

  const getAnimLabel = (type: string) => {
    switch(type) {
      case 'fade-up': return '위로 등장'
      case 'fade-in': return '제자리 등장'
      case 'zoom-in': return '팝업 확대'
      case 'slide-right': return '왼쪽에서 밀기'
      case 'slide-left': return '오른쪽에서 밀기'
      case 'slide-up': return '아래에서 밀기'
      default: return '위로 등장'
    }
  }

  return (
    <div id={`section-${section.id}`} ref={isOverlay ? undefined : setNodeRef} style={{ ...style, borderRadius: 'var(--section-corner-radius, 0px)' }} className={`w-full mb-24 scroll-mt-32 overflow-hidden ${!isPublic && isOwner && !isOverlay ? 'opacity-50 ring-2 ring-dashed ring-neutral-300 p-4 bg-neutral-50' : ''}`}>
      <div ref={sectionRef} className="w-full">
        <div
          className={`w-full transition-all duration-1000 ease-out transform-gpu will-change-[transform,opacity] ${globalIsDragging || isVisible ? visibleClass : hiddenClass} ${globalIsDragging ? '!duration-0' : ''}`}
        >
          {/* Section Header */}
          <div className="flex items-center justify-between mb-8 group/header w-full px-2">
            <div className="flex items-center gap-3 relative">
              {isOwner && !isOverlay && (
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-move p-2 -ml-2 text-neutral-300 hover:text-neutral-900 transition-colors bg-transparent hover:bg-neutral-100 rounded-md touch-none select-none"
                >
                  <GripHorizontal size={20} />
                </div>
              )}

              {(!showTitle && !isOwner) ? null : (
                <h2 className={`text-3xl lg:text-4xl 2xl:text-5xl font-black text-neutral-900 tracking-tight transition-opacity ${!showTitle ? 'opacity-30 line-through' : ''}`}>
                  {section.name}
                </h2>
              )}

              {/* Management Bar (Animate UI Style) */}
              {isOwner && (
                <div className="flex gap-1 opacity-0 group-hover/header:opacity-100 transition-all duration-300 translate-y-1 group-hover/header:translate-y-0 ml-4 z-20 relative bg-white/80 border border-neutral-200/60 shadow-sm backdrop-blur-xl rounded-full p-1 items-center">
                  
                  <Tooltip text="제목 표시 여부 토글" position="bottom">
                    <button
                      onPointerDown={handleToggleTitle}
                      className={`p-2 rounded-full transition-all flex items-center justify-center ${showTitle ? 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900' : 'bg-neutral-800 text-white shadow-md'}`}
                    >
                      {showTitle ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </Tooltip>

                  <Tooltip text="섹션 공개/비공개 토글" position="bottom">
                    <button
                      onPointerDown={handleToggleVisibility}
                      className={`p-2 rounded-full transition-all flex items-center justify-center ${isPublic ? 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900' : 'bg-amber-100 text-amber-700 shadow-sm'}`}
                    >
                      {isPublic ? <Globe size={16} /> : <Lock size={16} />}
                    </button>
                  </Tooltip>

                  <div className="w-px h-4 bg-neutral-200 mx-1" />

                  <div className="relative" onPointerLeave={() => setIsAnimDropdownOpen(false)}>
                    <Tooltip text="등장 애니메이션 설정" position="bottom">
                      <button
                        onPointerDown={(e) => { e.stopPropagation(); setIsAnimDropdownOpen(!isAnimDropdownOpen); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                      >
                        <Sparkles size={14} className="text-blue-500" />
                        <span>{getAnimLabel(animType)}</span>
                      </button>
                    </Tooltip>

                    {isAnimDropdownOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
                        <div className="w-44 bg-white/95 backdrop-blur-xl border border-neutral-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-200">
                          {[
                            { value: 'fade-up', label: '🚀 위로 등장' },
                            { value: 'fade-in', label: '💨 제자리 등장' },
                            { value: 'zoom-in', label: '🔍 팝업 확대' },
                            { value: 'slide-right', label: '➡️ 왼쪽에서 밀기' },
                            { value: 'slide-left', label: '⬅️ 오른쪽에서 밀기' },
                            { value: 'slide-up', label: '⬆️ 아래에서 밀기' }
                          ].map((option) => (
                            <button
                              key={option.value}
                              onPointerDown={async (e) => {
                                e.stopPropagation()
                                handleAnimationChange(option.value)
                                setIsAnimDropdownOpen(false)
                              }}
                              className={`px-3 py-2 text-xs font-medium text-left rounded-lg transition-all flex items-center justify-between ${animType === option.value ? 'bg-blue-50 text-blue-600 font-bold' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
                            >
                              {option.label}
                              {animType === option.value && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-px h-4 bg-neutral-200 mx-1" />

                  <Tooltip text="이름 변경" position="bottom">
                    <button
                      onPointerDown={(e) => { e.stopPropagation(); onRename(); }}
                      className="p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 rounded-full transition-all"
                    >
                      <Type size={16} />
                    </button>
                  </Tooltip>

                  <Tooltip text="섹션 삭제" position="bottom">
                    <button
                      onPointerDown={(e) => { e.stopPropagation(); onDelete(); }}
                      className="p-2 text-neutral-500 hover:bg-red-50 hover:text-red-500 rounded-full transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          <div ref={setDroppableRef}>
            {/* Render Text Section (FAQ 아코디언 파서 전격 탑재) */}
            {sectionType === 'text' && (
              <div className="relative group/textsection w-full px-4 lg:px-8">
                <div className="w-full py-8 lg:py-12 prose prose-lg md:prose-xl prose-neutral prose-img:rounded-none prose-img:shadow-sm prose-a:text-blue-600 prose-a:font-bold hover:prose-a:text-blue-800 max-w-7xl mx-auto text-neutral-800 break-words [word-break:break-word] [&_p]:break-words">
                  <ParsedTextContent content={section.content || '<p>내용이 없습니다.</p>'} />
                </div>
                {isOwner && onEditText && (
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); onEditText(); }}
                    className="absolute top-4 right-4 lg:right-12 bg-white border border-neutral-200 text-neutral-600 px-4 py-2 text-sm font-bold rounded-md shadow-sm opacity-0 group-hover/textsection:opacity-100 transition-opacity hover:bg-neutral-50 z-10"
                  >
                    본문 수정
                  </button>
                )}
              </div>
            )}

            {/* Render Video Slider (Carousel) */}
            {sectionType === 'video_slider' && (
              <div className="w-full relative group/slider">
                <div
                  ref={sliderRef}
                  className="flex overflow-x-auto gap-6 pb-6 snap-x snap-mandatory scrollbar-none relative w-full"
                  style={{
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    paddingLeft: 'max(2rem, calc(50% - 600px))',
                    paddingRight: 'max(2rem, calc(50% - 600px))'
                  }}
                >
                  <SortableContext items={projectIds} strategy={rectSortingStrategy}>
                    {projects.map((project) => (
                      <div key={project.id} className="snap-center shrink-0 w-[85vw] md:w-[75vw] xl:w-[65vw] max-w-[1200px]">
                        <ProjectCard project={project} creatorName={creatorName} isOwner={isOwner} onOpenProject={onOpenProject} globalIsDragging={globalIsDragging} />
                      </div>
                    ))}
                  </SortableContext>

                  {/* Add Video Button Card */}
                  {isOwner && (
                    <div className="snap-center shrink-0 w-[85vw] md:w-[75vw] xl:w-[65vw] max-w-[1200px]">
                      <button
                        onPointerDown={(e) => { e.stopPropagation(); if (onAddVideoProject) onAddVideoProject(section.id); }}
                        className="block group w-full h-full min-h-[300px] border-2 border-dashed border-neutral-300 rounded-sm flex flex-col items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer text-center p-6"
                      >
                        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        </div>
                        <h3 className="text-neutral-800 font-bold text-lg mb-1">비디오 링크 업로드</h3>
                        <p className="text-neutral-400 text-xs font-medium">유튜브 영상을 슬라이더에 추가하세요</p>
                      </button>
                    </div>
                  )}
                </div>

                {/* Slider Navigation Buttons */}
                <button
                  onClick={scrollLeft}
                  className="absolute left-4 sm:left-12 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-black p-3 rounded-full shadow-lg opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button
                  onClick={scrollRight}
                  className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-black p-3 rounded-full shadow-lg opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            )}

            {/* Render Default Image Grid (16:9 aspect-video 정비율 카드 가변화) */}
            {sectionType === 'image_grid' && (
              <div id={`grid-wrapper-${section.id}`} className="w-full" style={{ containerType: 'inline-size' }}>
                {/* 뷰포트 오차와 100% 높이 붕괴를 완전 소멸시키는 기적의 CSS Container Queries 기반 16:9 픽셀 수식 */}
                <style>{`
                  #grid-${section.id} {
                    --col-width: 100cqw;
                    grid-auto-rows: calc(var(--col-width) * 9 / 16);
                  }
                  @media (min-width: 640px) {
                    #grid-${section.id} {
                      --col-width: calc((100cqw - var(--grid-gap, 24px)) / 2);
                      grid-auto-rows: calc(var(--col-width) * 9 / 16);
                    }
                  }
                  @media (min-width: 1024px) {
                    #grid-${section.id} {
                      --col-width: calc((100cqw - 2 * var(--grid-gap, 24px)) / 3);
                      grid-auto-rows: calc(var(--col-width) * 9 / 16);
                    }
                  }
                `}</style>

                <div id={`grid-${section.id}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gridAutoFlow: 'dense', gap: 'var(--grid-gap, 24px)' }}>
                  <SortableContext items={projectIds} strategy={rectSortingStrategy}>
                    {projects.map((project) => {
                      const { colSpanClass, rowSpanClass } = parseProjectTitleAndSize(project.title)
                      return (
                        <div 
                          key={project.id} 
                          className={`${colSpanClass} ${rowSpanClass} w-full h-full transition-all duration-500`}
                          style={{ borderRadius: 'var(--card-corner-radius, 0px)' }}
                        >
                          <ProjectCard project={project} creatorName={creatorName} isOwner={isOwner} onOpenProject={onOpenProject} globalIsDragging={globalIsDragging} isGridItem={true} />
                        </div>
                      )
                    })}
                  </SortableContext>

                  {/* Create Project Button Card for Image Grid (100% 16:9 높이 보장) */}
                  {isOwner && (
                    <Link 
                      href={`/creator/${creatorName}/editor?section_id=${section.id}`} 
                      className="block group break-inside-avoid w-full"
                      style={{ height: 'calc(var(--col-width, 100cqw) * 9 / 16)' }}
                    >
                      <div 
                        className="w-full h-full border border-dashed border-neutral-300 dark:border-neutral-800 flex flex-col items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer text-center p-6"
                        style={{ borderRadius: 'var(--card-corner-radius, 0px)' }}
                      >
                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </div>
                        <h3 className="text-neutral-800 font-bold text-lg mb-1">새 프로젝트 생성</h3>
                        <p className="text-neutral-400 text-xs font-medium">새로운 캔버스를 열고 작품을 업로드하세요</p>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Render WIP Timeline Section */}
            {sectionType === 'wip_timeline' && (
              <div className="w-full">
                <WipTimelineSection
                  section={section}
                  wipLogs={wipLogs}
                  projects={allProjects}
                  isOwner={isOwner}
                  creatorName={creatorName}
                  onOpenProject={onOpenProject}
                />
              </div>
            )}

            {/* Drop Zone overlay logic for Image Grid / Video Slider is handled by container automatically if they are valid drop targets */}
            {isOver && sectionType !== 'text' && (
              <div className="absolute inset-0 z-0 bg-blue-50/50 rounded-2xl border-2 border-dashed border-blue-400 pointer-events-none transition-all" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(SectionContainer)

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Edit2, Calendar, Link2, X, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import { createWipLogAction, deleteWipLogAction, updateWipLogAction } from '@/app/actions/wip'
import { updateSectionContentAction } from '@/app/actions/section'
import Tooltip from '@/components/ui/Tooltip'

interface WipTimelineSectionProps {
  section: any
  wipLogs: any[]
  projects: any[]
  isOwner?: boolean
  creatorName: string
  onOpenProject?: (projectId: string) => void
}

// [SIZE:WxH] 또는 [SIZE:W] 제거용 클렌저 (Connected Project 옵션용)
const cleanProjectTitle = (title: string) => {
  if (!title) return ''
  return title.replace(/\[SIZE:[1-3](?:x[1-3])?\]/, '').trim()
}

// 섹션 content 복합 설정 파서 (accordion 과 layout 복합 보관)
const parseSectionConfig = (content: string) => {
  let accordion = false
  let layout: 'horizontal' | 'vertical' = 'horizontal'

  if (content) {
    const parts = content.split('|')
    parts.forEach(part => {
      if (part.startsWith('accordion:')) {
        accordion = part.replace('accordion:', '') === 'true'
      }
      if (part.startsWith('layout:')) {
        const val = part.replace('layout:', '')
        if (val === 'horizontal' || val === 'vertical') {
          layout = val
        }
      }
    })
  }

  return { accordion, layout }
}

const serializeSectionConfig = (accordion: boolean, layout: 'horizontal' | 'vertical') => {
  return `accordion:${accordion}|layout:${layout}`
}

export default function WipTimelineSection({
  section,
  wipLogs = [],
  projects = [],
  isOwner = false,
  creatorName,
  onOpenProject
}: WipTimelineSectionProps) {
  const [logs, setLogs] = useState<any[]>(wipLogs)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)

  // 레이아웃 모드 상태 ('horizontal' = 가로형 슬라이더, 'vertical' = 세로형 미니멀 리스트)
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal')

  // 아코디언 접기/열기 모드 및 개별 노드 확장 상태
  const [isAccordionMode, setIsAccordionMode] = useState<boolean>(false)
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({})

  const toggleExpandLog = (logId: string) => {
    if (!isAccordionMode) return
    setExpandedLogIds(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  // 물리 슬라이더 터치/드래그 인터랙션 제어 Refs
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDown = useRef(false)
  const startX = useRef(0)
  const scrollLeftState = useRef(0)
  const velocity = useRef(0)
  const rafId = useRef<number | null>(null)
  const lastTime = useRef(0)
  const lastX = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return
    isDown.current = true
    startX.current = e.pageX - (sliderRef.current?.offsetLeft || 0)
    scrollLeftState.current = sliderRef.current?.scrollLeft || 0
    lastX.current = e.pageX
    lastTime.current = Date.now()
    velocity.current = 0
    if (rafId.current) cancelAnimationFrame(rafId.current)
  }

  const handleMouseLeave = () => {
    isDown.current = false
    if (velocity.current !== 0) applyInertia()
  }

  const handleMouseUp = () => {
    isDown.current = false
    if (velocity.current !== 0) applyInertia()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !sliderRef.current) return
    e.preventDefault()
    const x = e.pageX - sliderRef.current.offsetLeft
    const walk = (x - startX.current) * 1.5
    sliderRef.current.scrollLeft = scrollLeftState.current - walk

    const now = Date.now()
    const dt = now - lastTime.current
    const dx = e.pageX - lastX.current
    if (dt > 0) {
      velocity.current = -dx / dt
    }
    lastX.current = e.pageX
    lastTime.current = now
  }

  const applyInertia = () => {
    if (!sliderRef.current) return
    sliderRef.current.scrollLeft += velocity.current * 16
    velocity.current *= 0.92
    if (Math.abs(velocity.current) > 0.05) {
      rafId.current = requestAnimationFrame(applyInertia)
    }
  }

  const handleArrowClick = (direction: 'prev' | 'next') => {
    if (!sliderRef.current) return
    if (rafId.current) cancelAnimationFrame(rafId.current)
    const cardWidth = 340
    const scrollAmount = direction === 'prev' ? -cardWidth : cardWidth
    sliderRef.current.scrollTo({
      left: sliderRef.current.scrollLeft + scrollAmount,
      behavior: 'smooth'
    })
  }

  useEffect(() => {
    setMounted(true)
    
    // DB에 고정 저장되어 넘어온 아코디언 및 레이아웃 설정값 파싱 후 동기화
    const config = parseSectionConfig(section.content)
    setIsAccordionMode(config.accordion)
    setLayoutMode(config.layout)
    
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [section.id, section.content])

  const handleLayoutModeChange = async (mode: 'horizontal' | 'vertical') => {
    setLayoutMode(mode)
    if (isOwner) {
      try {
        const serialized = serializeSectionConfig(isAccordionMode, mode)
        await updateSectionContentAction(section.id, serialized, creatorName)
      } catch (e) {
        console.error('Failed to persist layout mode:', e)
      }
    }
  }

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [customDate, setCustomDate] = useState(() => {
    if (typeof window !== 'undefined') {
      return new Date().toISOString().split('T')[0]
    }
    return ''
  })
  const [endDate, setEndDate] = useState('') // 종료 날짜 추가
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif' | 'mono'>('sans')

  // 설명 및 기간 메타 데이터 파서 [RANGE:YYYY-MM-DD][FONT:sans]본문내용...
  const parseDescriptionAndMeta = (desc: string | null) => {
    const result = { text: '', fontClass: 'font-sans', style: undefined as any, endDate: '' }
    if (!desc) return result

    let currentStr = desc
    
    // 1. [RANGE:YYYY-MM-DD] 디코딩
    if (currentStr.startsWith('[RANGE:')) {
      const closingBracketIndex = currentStr.indexOf(']')
      if (closingBracketIndex !== -1) {
        result.endDate = currentStr.substring(7, closingBracketIndex)
        currentStr = currentStr.substring(closingBracketIndex + 1)
      }
    }

    // 2. [FONT:fontType] 디코딩
    if (currentStr.startsWith('[FONT:')) {
      const closingBracketIndex = currentStr.indexOf(']')
      if (closingBracketIndex !== -1) {
        const fontType = currentStr.substring(6, closingBracketIndex)
        const text = currentStr.substring(closingBracketIndex + 1)
        result.text = text

        if (fontType === 'serif') {
          result.fontClass = 'font-serif'
          result.style = { fontFamily: "'Nanum Myeongjo', serif" }
        } else if (fontType === 'mono') {
          result.fontClass = 'font-mono text-[12px] tracking-wide font-medium'
        } else {
          result.fontClass = 'font-sans font-medium'
        }
        return result
      }
    }

    result.text = currentStr
    return result
  }

  const handleEditClick = (log: any) => {
    setEditingLogId(log.id)
    setTitle(log.title)
    const metaConfig = parseDescriptionAndMeta(log.description)
    setDescription(metaConfig.text)
    setEndDate(metaConfig.endDate || '')
    
    if (log.description && log.description.includes('[FONT:')) {
      const match = log.description.match(/\[FONT:(sans|serif|mono)\]/)
      if (match) {
        setFontStyle(match[1] as any)
      } else {
        setFontStyle('sans')
      }
    } else {
      setFontStyle('sans')
    }
    setMediaUrl(log.media_url || '')
    setSelectedProjectId(log.project_id || '')
    if (log.created_at) {
      const d = new Date(log.created_at)
      setCustomDate(d.toISOString().split('T')[0])
    } else {
      setCustomDate(new Date().toISOString().split('T')[0])
    }
    setIsModalOpen(true)
  }

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    
    // RANGE 정보와 FONT 정보를 규격 프리픽스로 병합 인코딩
    const rangePrefix = endDate ? `[RANGE:${endDate}]` : ''
    const encodedDescription = `${rangePrefix}[FONT:${fontStyle}]${description.trim()}`
    
    const targetDate = customDate ? new Date(customDate) : new Date()

    if (editingLogId) {
      const linkedProject = projects.find(p => p.id === selectedProjectId)
      const previousLogs = [...logs]
      setLogs(prev => prev.map(log => log.id === editingLogId ? {
        ...log,
        title: title.trim(),
        description: encodedDescription,
        media_url: mediaUrl.trim() || null,
        project_id: selectedProjectId || null,
        project: linkedProject || null,
        created_at: targetDate
      } : log))
      setIsModalOpen(false)

      try {
        const updated = await updateWipLogAction(
          creatorName,
          editingLogId,
          title.trim(),
          encodedDescription,
          mediaUrl.trim() || undefined,
          selectedProjectId || undefined,
          customDate || undefined
        )
        setLogs(prev => prev.map(log => log.id === editingLogId ? updated : log))
      } catch (error) {
        console.error('Failed to update WIP log:', error)
        alert('로그 수정 중 오류가 발생했습니다.')
        setLogs(previousLogs)
      } finally {
        setIsSubmitting(false)
        setEditingLogId(null)
      }
    } else {
      const tempId = 'temp-' + Date.now()
      const linkedProject = projects.find(p => p.id === selectedProjectId)
      const optimisticLog = {
        id: tempId,
        title: title.trim(),
        description: encodedDescription,
        media_url: mediaUrl.trim() || null,
        project_id: selectedProjectId || null,
        project: linkedProject || null,
        created_at: targetDate
      }
      setLogs(prev => [optimisticLog, ...prev])
      setIsModalOpen(false)

      try {
        const realLog = await createWipLogAction(
          creatorName,
          optimisticLog.title,
          optimisticLog.description,
          optimisticLog.media_url || undefined,
          optimisticLog.project_id || undefined,
          customDate || undefined
        )
        setLogs(prev => prev.map(log => log.id === tempId ? realLog : log))
      } catch (error) {
        console.error('Failed to create WIP log:', error)
        alert('로그 저장 중 오류가 발생했습니다.')
        setLogs(prev => prev.filter(log => log.id !== tempId))
      } finally {
        setIsSubmitting(false)
      }
    }

    setTitle('')
    setDescription('')
    setMediaUrl('')
    setSelectedProjectId('')
    setCustomDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setFontStyle('sans')
    setEditingLogId(null)
  }

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 작업 로그를 삭제하시겠습니까?')) return
    const previousLogs = [...logs]
    setLogs(prev => prev.filter(log => log.id !== logId))
    try {
      await deleteWipLogAction(creatorName, logId)
    } catch (error) {
      console.error('Failed to delete WIP log:', error)
      alert('로그 삭제 중 오류가 발생했습니다.')
      setLogs(previousLogs)
    }
  }

  // 날짜 포맷터 (단일 날짜 혹은 기간 지원)
  const formatPeriod = (startDateInput: any, endDateStr?: string) => {
    const formatSingle = (dateInput: any) => {
      const d = new Date(dateInput)
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }
    
    const startFormatted = formatSingle(startDateInput)
    if (endDateStr) {
      const endD = new Date(endDateStr)
      const endFormatted = `${endD.getFullYear()}.${String(endD.getMonth() + 1).padStart(2, '0')}.${String(endD.getDate()).padStart(2, '0')}`
      return `${startFormatted} ~ ${endFormatted}`
    }
    return startFormatted
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-20 relative bg-transparent">
      {/* 절제된 미니멀리즘 헤더 */}
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 pb-6 border-b-2 border-neutral-350 dark:border-neutral-700 z-10">
        <div>
          <span className="text-[10px] font-mono tracking-[0.25em] text-neutral-500 dark:text-neutral-400 uppercase font-black">
            PROCESS & REASONING ARCHIVE
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-5 mt-2 font-sans">
            {section.name || 'Wip Timeline'}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {/* 극도로 슬림하고 눈에 잘 띄는 스위처 */}
          <div className="flex bg-neutral-200 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => handleLayoutModeChange('horizontal')}
              className={`p-1.5 rounded-md transition-all flex items-center justify-center cursor-pointer border-0 ${
                layoutMode === 'horizontal'
                  ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 shadow-md scale-102 font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 bg-transparent'
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleLayoutModeChange('vertical')}
              className={`p-1.5 rounded-md transition-all flex items-center justify-center cursor-pointer border-0 ${
                layoutMode === 'vertical'
                  ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 shadow-md scale-102 font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 bg-transparent'
              }`}
            >
              <List size={14} />
            </button>
          </div>

          {/* 세그먼티드 고대비 아코디언 스위처 (피그마 럭셔리 슬레이트 스타일) */}
          <div className="flex items-center bg-neutral-100 dark:bg-[#151515] p-0.5 rounded-lg border border-neutral-250 dark:border-neutral-800 shrink-0 h-[34px]">
            <span className="hidden sm:inline text-[9.5px] font-black tracking-wider font-mono text-neutral-500 dark:text-neutral-400 uppercase pl-2 pr-1.5 select-none">
              ACCORDION
            </span>
            <div className="flex bg-neutral-200/80 dark:bg-neutral-850 p-0.5 rounded-md border border-neutral-300 dark:border-neutral-750">
              <button
                type="button"
                onClick={async () => {
                  if (isAccordionMode) return
                  setIsAccordionMode(true)
                  setExpandedLogIds({})
                  if (isOwner) {
                    try {
                      const serialized = serializeSectionConfig(true, layoutMode)
                      await updateSectionContentAction(section.id, serialized, creatorName)
                    } catch (e) {
                      console.error('Failed to update accordion mode to true:', e)
                    }
                  }
                }}
                className={`px-3.5 py-1 text-[9.5px] font-mono tracking-wider uppercase rounded-sm transition-all cursor-pointer border-0 font-black flex items-center justify-center ${
                  isAccordionMode
                    ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 shadow-md scale-102 font-black'
                    : 'text-neutral-450 hover:text-neutral-800 dark:text-neutral-500 hover:dark:text-white bg-transparent'
                }`}
              >
                ON
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!isAccordionMode) return
                  setIsAccordionMode(false)
                  if (isOwner) {
                    try {
                      const serialized = serializeSectionConfig(false, layoutMode)
                      await updateSectionContentAction(section.id, serialized, creatorName)
                    } catch (e) {
                      console.error('Failed to update accordion mode to false:', e)
                    }
                  }
                }}
                className={`px-3.5 py-1 text-[9.5px] font-mono tracking-wider uppercase rounded-sm transition-all cursor-pointer border-0 font-black flex items-center justify-center ${
                  !isAccordionMode
                    ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 shadow-md scale-102 font-black'
                    : 'text-neutral-450 hover:text-neutral-800 dark:text-neutral-500 hover:dark:text-white bg-transparent'
                }`}
              >
                OFF
              </button>
            </div>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-7 py-3 text-[11px] font-mono font-black tracking-[0.15em] uppercase border-2 border-neutral-950 dark:border-neutral-100 bg-neutral-950 dark:bg-neutral-100 hover:bg-neutral-850 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.15)] active:scale-95"
            >
              <Plus size={13} strokeWidth={3.5} />
              Add Log
            </button>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-neutral-300 dark:border-neutral-850 rounded-xl bg-white dark:bg-neutral-900/10 z-10 shadow-sm">
          <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-extrabold">No logs recorded</p>
        </div>
      ) : (
        <div className="w-full relative z-10">
          {layoutMode === 'horizontal' ? (
            <>
              <div 
                ref={sliderRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="flex items-start gap-8 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing pb-6 pt-1 px-1"
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  scrollBehavior: 'smooth'
                }}
              >
                {logs.map((log, index) => {
                  const metaConfig = parseDescriptionAndMeta(log.description)
                  const stepNumber = String(logs.length - index).padStart(2, '0')
                  const isExpanded = !isAccordionMode || expandedLogIds[log.id]
                  return (
                    <div 
                      key={log.id} 
                      onClick={() => {
                        if (isAccordionMode) {
                          toggleExpandLog(log.id)
                        }
                      }}
                      className={`w-[290px] md:w-[340px] shrink-0 relative flex flex-col bg-white dark:bg-[#0e0e0e] border-2 border-neutral-350 dark:border-neutral-800 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-2xl p-6 transition-all duration-300 hover:border-neutral-950 dark:hover:border-neutral-100 group/card ${
                        isExpanded ? 'justify-between' : 'justify-start'
                      } ${
                        isAccordionMode ? 'cursor-pointer select-none hover:bg-neutral-50/30 dark:hover:bg-neutral-900/10' : ''
                      }`}
                    >
                      {/* 선명하게 눈에 띄는 탑 바 */}
                      <div className="flex items-center justify-between mb-4 border-b border-neutral-100 dark:border-neutral-900 pb-2 shrink-0">
                        <span className="text-[12.5px] font-mono tracking-wider text-neutral-600 dark:text-neutral-350 font-extrabold">
                          {formatPeriod(log.created_at, metaConfig.endDate)}
                        </span>
                        <span className="text-[12.5px] font-mono text-neutral-850 dark:text-neutral-250 font-black">
                          NO. {stepNumber}
                        </span>
                      </div>

                      <div className="relative shrink-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[17px] sm:text-[18px] font-black text-neutral-950 dark:text-white leading-snug tracking-tight">
                            {log.title}
                          </h3>
                          {isAccordionMode && (
                            <ChevronDown 
                              size={16} 
                              className={`text-neutral-400 dark:text-neutral-500 shrink-0 transition-transform duration-300 ${
                                isExpanded ? 'rotate-180 text-neutral-900 dark:text-neutral-200' : ''
                              }`}
                            />
                          )}
                        </div>
                      </div>

                      {/* 아코디언 확장 영역 (Transition 효과 적용) */}
                      <div className={`overflow-hidden transition-all duration-300 ${
                        isExpanded 
                          ? 'max-h-[1000px] opacity-100 mt-3.5' 
                          : 'max-h-0 opacity-0 pointer-events-none mt-0'
                      }`}>
                        {metaConfig.text && (
                          <p
                            className={`text-[13.5px] md:text-[15px] text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap ${metaConfig.fontClass}`}
                            style={metaConfig.style}
                          >
                            {metaConfig.text}
                          </p>
                        )}

                        {log.media_url && (
                          <div 
                            className="mt-4 overflow-hidden border border-neutral-200 dark:border-neutral-800 max-h-[140px] w-full bg-neutral-100 dark:bg-neutral-900/80 rounded-xl"
                          >
                            <img
                              src={log.media_url}
                              alt="WIP Attachment"
                              className="w-full h-full object-cover max-h-[140px] transition-transform duration-500 group-hover/card:scale-[1.02]"
                              draggable={false}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        {/* 미니멀 카드 풋터 */}
                        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                          {log.project ? (
                            <button
                              type="button"
                              onClick={() => onOpenProject && onOpenProject(log.project_id)}
                              className="inline-flex items-center gap-1 text-[11.5px] font-mono tracking-wider text-neutral-950 hover:text-blue-600 dark:text-neutral-50 dark:hover:text-blue-400 transition-colors cursor-pointer uppercase font-black bg-transparent border-0 underline decoration-2"
                            >
                              View Work
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono tracking-widest text-neutral-450 dark:text-neutral-550 uppercase font-black">
                              Archived
                            </span>
                          )}

                          {isOwner && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                              <button
                                type="button"
                                onClick={() => handleEditClick(log)}
                                className="text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors p-1 cursor-pointer bg-neutral-100 dark:bg-neutral-900 rounded"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-neutral-500 hover:text-red-650 transition-colors p-1 cursor-pointer bg-neutral-100 dark:bg-neutral-900 rounded"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 미니멀 제어 단추 */}
              <div className="flex justify-center gap-2.5 mt-6">
                <button 
                  type="button" 
                  onClick={() => handleArrowClick('prev')}
                  className="p-2.5 border-2 border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-all rounded-lg cursor-pointer flex items-center justify-center active:scale-95 shadow-sm"
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                </button>
                <button 
                  type="button" 
                  onClick={() => handleArrowClick('next')}
                  className="p-2.5 border-2 border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-all rounded-lg cursor-pointer flex items-center justify-center active:scale-95 shadow-sm"
                >
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </>
          ) : (
            
            /* 세로형 리스트 모드 - 칼처럼 뚜렷하고 선명한 타임라인 */
            <div className="relative border-l-2 border-neutral-400 dark:border-neutral-700 ml-4 md:ml-6 space-y-10 py-2">
              {logs.map((log, index) => {
                const metaConfig = parseDescriptionAndMeta(log.description)
                const stepNumber = String(logs.length - index).padStart(2, '0')
                const isExpanded = !isAccordionMode || expandedLogIds[log.id]
                return (
                  <div key={log.id} className="relative pl-6 md:pl-10 group/item">
                    {/* 단정하고 얇으며 고대비인 노드 포인트 */}
                    <div 
                      className="absolute -left-[7px] top-4.5 w-3 h-3 rounded-full bg-neutral-950 dark:bg-neutral-100 border-2 border-white dark:border-[#0a0a0a] transition-all duration-300 group-hover/item:scale-110 shadow-sm"
                    />

                    {/* 세로형 미니멀리스트 갤러리 카드 */}
                    <div 
                      onClick={() => {
                        if (isAccordionMode) {
                          toggleExpandLog(log.id)
                        }
                      }}
                      className={`relative bg-white dark:bg-[#0e0e0e] border-2 border-neutral-350 dark:border-neutral-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl p-6 transition-all duration-300 hover:border-neutral-950 dark:hover:border-neutral-100 ${
                        isAccordionMode ? 'cursor-pointer select-none hover:bg-neutral-50/30 dark:hover:bg-neutral-900/10' : ''
                      }`}
                    >
                      
                      <div className="flex items-center justify-between mb-4 border-b border-neutral-100 dark:border-neutral-900 pb-2 shrink-0">
                        <div className="flex items-center gap-3">
                          <span className="text-[12.5px] font-mono tracking-wider text-neutral-600 dark:text-neutral-350 font-extrabold">
                            {formatPeriod(log.created_at, metaConfig.endDate)}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-300 dark:text-neutral-700">|</span>
                          <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 uppercase font-black tracking-wider">
                            Process log
                          </span>
                        </div>
                        <span className="text-[12.5px] font-mono text-neutral-850 dark:text-neutral-250 font-black">
                          NO. {stepNumber}
                        </span>
                      </div>

                      <div className="relative shrink-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[16px] md:text-[18px] font-black text-neutral-950 dark:text-white leading-snug tracking-tight">
                            {log.title}
                          </h3>
                          {isAccordionMode && (
                            <ChevronDown 
                              size={16} 
                              className={`text-neutral-400 dark:text-neutral-500 shrink-0 transition-transform duration-300 ${
                                isExpanded ? 'rotate-180 text-neutral-900 dark:text-neutral-200' : ''
                              }`}
                            />
                          )}
                        </div>
                      </div>

                      {/* 아코디언 확장 영역 (Transition 효과 적용) */}
                      <div className={`overflow-hidden transition-all duration-300 ${
                        isExpanded 
                          ? 'max-h-[1000px] opacity-100 mt-3.5' 
                          : 'max-h-0 opacity-0 pointer-events-none mt-0'
                      }`}>
                        {metaConfig.text && (
                          <p
                            className={`text-[13.5px] md:text-[15px] text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap ${metaConfig.fontClass}`}
                            style={metaConfig.style}
                          >
                            {metaConfig.text}
                          </p>
                        )}

                        {log.media_url && (
                          <div 
                            className="mt-4 overflow-hidden border border-neutral-200 dark:border-neutral-855 max-h-[300px] max-w-[480px] bg-neutral-50 dark:bg-neutral-900/40 rounded-xl"
                          >
                            <img
                              src={log.media_url}
                              alt="WIP Attachment"
                              className="w-full h-full object-cover max-h-[300px] transition-transform duration-500 hover:scale-[1.01]"
                              draggable={false}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                          {log.project ? (
                            <button
                              type="button"
                              onClick={() => onOpenProject && onOpenProject(log.project_id)}
                              className="inline-flex items-center gap-1.5 text-[11.5px] font-mono tracking-wider text-neutral-950 hover:text-blue-600 dark:text-neutral-50 dark:hover:text-blue-400 transition-colors cursor-pointer uppercase font-black bg-transparent border-0 underline decoration-2"
                            >
                              View Work
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono tracking-widest text-neutral-450 dark:text-neutral-550 uppercase font-black">
                              Archived
                            </span>
                          )}

                          {isOwner && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200">
                              <button
                                type="button"
                                onClick={() => handleEditClick(log)}
                                className="text-neutral-550 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors p-1 cursor-pointer bg-neutral-100 dark:bg-neutral-900 rounded"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-neutral-550 hover:text-red-655 transition-colors p-1 cursor-pointer bg-neutral-100 dark:bg-neutral-900 rounded"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 작성/수정 팝업 모달 (Figma 슬레이트 다크 미니멀리스트 디자인) */}
      {isModalOpen && mounted && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-auto" data-lenis-prevent="true">
          <div className="bg-[#181818] border border-neutral-800 rounded-xl max-w-md w-full mx-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 font-sans text-left">
            <div className="flex items-center justify-between border-b border-neutral-850 px-5 py-3.5 shrink-0 bg-[#181818]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                <h3 className="text-xs font-black text-neutral-200 uppercase tracking-widest font-mono">
                  {editingLogId ? 'Edit Process Log' : 'New Process Log'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingLogId(null)
                }}
                className="text-neutral-500 hover:text-neutral-350 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#181818] no-scrollbar">
              <div>
                <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                  Title (Max 50 characters)
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Optimized rendering process to 60fps"
                  className="w-full px-3 py-2.5 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 transition-colors text-neutral-200 placeholder-neutral-600 font-sans font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                  Detailed Log (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Record sketches, struggles, or breakthroughs..."
                  className="w-full px-3 py-2.5 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 transition-colors text-neutral-200 h-24 resize-none placeholder-neutral-600 font-sans leading-relaxed font-medium"
                />
              </div>

              {/* 시작 날짜 & 종료 날짜 기간 설정 그리드 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 text-neutral-200 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 text-neutral-200 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                    Font Style
                  </label>
                  <select
                    value={fontStyle}
                    onChange={(e) => setFontStyle(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 text-neutral-200 font-mono cursor-pointer font-bold"
                  >
                    <option value="sans">Modern Sans</option>
                    <option value="serif">Classic Serif</option>
                    <option value="mono">Technical Mono</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                  Media Attachment Link (Optional)
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/sketch.png"
                  className="w-full px-3 py-2.5 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 transition-colors text-neutral-200 placeholder-neutral-600 font-sans font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-black text-neutral-200 uppercase tracking-widest mb-2">
                  Connected Project (Optional)
                </label>
                <div className="relative w-full">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-[#222] border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-neutral-600 text-neutral-200 cursor-pointer font-sans appearance-none font-medium"
                  >
                    <option value="" className="bg-[#181818] text-neutral-400">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#181818] text-neutral-200">
                        {cleanProjectTitle(p.title)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-855 bg-[#181818]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingLogId(null)
                  }}
                  className="px-4 py-2 text-[10px] font-mono font-bold text-neutral-400 hover:text-neutral-250 transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-[10px] font-mono font-bold bg-neutral-200 hover:bg-white text-neutral-900 rounded-lg transition-colors disabled:opacity-50 uppercase tracking-widest"
                >
                  {isSubmitting ? 'Saving...' : 'Save Log'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

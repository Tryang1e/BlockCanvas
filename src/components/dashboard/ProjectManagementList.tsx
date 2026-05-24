'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, Trash2, GripVertical, CheckSquare, Square, Settings2 } from 'lucide-react'
import { updateProjectOrderAction } from '@/app/actions/projects'
import { updateSectionOrderAction } from '@/app/actions/section'
import SectionReorderModal from '@/components/creator/SectionReorderModal'

interface ProjectManagementListProps {
  initialProjects: any[]
  sections: any[]
  creatorName: string
}

function SortableProjectRow({ 
  project, 
  creatorName, 
  isSelected,
  onToggleSelect,
  isOverlay = false,
}: { 
  project: any, 
  creatorName: string, 
  isSelected: boolean,
  onToggleSelect?: (id: string) => void,
  isOverlay?: boolean,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    data: {
      type: 'Project',
      project,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isOverlay ? 999 : isDragging ? 0 : 1,
    opacity: isDragging && !isOverlay ? 0 : 1,
  }

  let parsedContent: any = {}
  try {
    parsedContent = project.content ? JSON.parse(project.content) : {}
  } catch (e) {}
  
  const isSimpleVideo = parsedContent.url && !parsedContent.html
  const typeLabel = isSimpleVideo ? '비디오' : '커스텀 캔버스'

  return (
    <div 
      ref={isOverlay ? undefined : setNodeRef} 
      style={style} 
      className={`flex items-center justify-between p-4 bg-white border-b border-neutral-100 transition-colors ${isOverlay ? 'shadow-2xl rounded-lg border-2 border-blue-500 bg-blue-50/50 scale-105' : 'hover:bg-neutral-50/80'} ${isSelected && !isOverlay ? 'bg-blue-50/30' : ''}`}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Checkbox */}
        {!isOverlay && (
          <button 
            onClick={() => onToggleSelect?.(project.id)}
            className="p-1 text-neutral-400 hover:text-blue-500 transition-colors"
          >
            {isSelected ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
          </button>
        )}

        {/* Drag Handle */}
        <div 
          {...(!isOverlay ? attributes : {})} 
          {...(!isOverlay ? listeners : {})}
          className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-600 p-2 -ml-2 rounded touch-none select-none relative"
        >
          <GripVertical size={18} />
        </div>

        {/* Thumbnail & Title */}
        <div className="flex items-center gap-3 w-1/3 min-w-[200px]">
          {project.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={project.thumbnail_url} 
              alt={project.title} 
              className="w-12 h-8 rounded object-cover shadow-sm border border-neutral-200 shrink-0 pointer-events-none" 
              draggable={false}
            />
          ) : (
            <div className="w-12 h-8 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 pointer-events-none">
              <span className="text-[8px] text-neutral-400 font-bold uppercase">No Img</span>
            </div>
          )}
          <div className="font-bold text-neutral-900 truncate pr-4">{project.title}</div>
        </div>

        {/* Type */}
        <div className="w-1/6 hidden sm:block">
          <span className={`text-xs font-bold ${isSimpleVideo ? 'text-red-500' : 'text-blue-500'}`}>
            {typeLabel}
          </span>
        </div>

        {/* Date */}
        <div className="w-1/6 hidden md:block tabular-nums text-xs text-neutral-500 font-medium">
          {new Date(project.created_at).toLocaleDateString('ko-KR')}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        <a 
          href={`/creator/${creatorName}/project/${project.id}`}
          className="p-2 text-neutral-400 hover:text-blue-600 transition-colors bg-white hover:bg-blue-50 rounded-md shadow-sm border border-neutral-100"
          title="게시글 사이트 보러 가기"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  )
}

export default function ProjectManagementList({ initialProjects, sections: initialSections, creatorName }: ProjectManagementListProps) {
  const [projects, setProjects] = useState<any[]>(initialProjects)
  const [sections, setSections] = useState<any[]>(initialSections)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Section Reorder Modal State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  
  // Bulk Move Dropdown State
  const [targetSectionId, setTargetSectionId] = useState<string>('')

  // To prevent Next.js hydration mismatch if dnd-kit renders early
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Globally disable text selection while dragging
  useEffect(() => {
    if (activeId) {
      document.body.style.userSelect = 'none'
      document.body.style.webkitUserSelect = 'none'
      document.body.classList.add('select-none')
    } else {
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
      document.body.classList.remove('select-none')
    }
    return () => {
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
      document.body.classList.remove('select-none')
    }
  }, [activeId])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const moveItemAcrossSections = (items: any[], activeId: string, overId: string | null, targetSectionId: string) => {
    const activeItem = items.find(p => p.id === activeId)
    if (!activeItem) return items
    
    const updatedActive = { ...activeItem, section_id: targetSectionId }
    const filteredItems = items.filter(p => p.id !== activeId)
    
    const allSectionIds = Array.from(new Set(items.map(p => p.section_id || 'unassigned')))
    if (!allSectionIds.includes(targetSectionId)) allSectionIds.push(targetSectionId)

    let newProjects: any[] = []
    
    for (const sId of allSectionIds) {
      let sectionProjects = filteredItems.filter(p => (p.section_id || 'unassigned') === sId)
      
      if (sId === targetSectionId) {
        if (overId) {
          const overLocalIndex = sectionProjects.findIndex(p => p.id === overId)
          if (overLocalIndex !== -1) {
            sectionProjects.splice(overLocalIndex, 0, updatedActive)
          } else {
            sectionProjects.push(updatedActive)
          }
        } else {
          sectionProjects.push(updatedActive)
        }
      }
      newProjects.push(...sectionProjects)
    }
    return newProjects
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    setProjects((items) => {
      const activeItem = items.find((t) => t.id === activeId)
      // Since sections are no longer sortable items, overItem is always a project
      const overItem = items.find((t) => t.id === overId)
      
      if (activeItem && overItem && (activeItem.section_id || 'unassigned') !== (overItem.section_id || 'unassigned')) {
        return moveItemAcrossSections(items, activeId, overId, overItem.section_id || 'unassigned')
      }
      return items
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    let newProjects = [...projects]
    const activeItem = projects.find(p => p.id === activeId)
    if (!activeItem) return

    const targetSectionId = projects.find(p => p.id === overId)?.section_id || 'unassigned'

    // Standard Single Drag Logic
    const sectionProjects = newProjects.filter(p => (p.section_id || 'unassigned') === targetSectionId)
    const activeSectionIndex = sectionProjects.findIndex(p => p.id === activeId)
    const overSectionIndex = sectionProjects.findIndex(p => p.id === overId)

    if (activeSectionIndex !== -1 && overSectionIndex !== -1 && activeSectionIndex !== overSectionIndex) {
      const reorderedSectionProjects = arrayMove(sectionProjects, activeSectionIndex, overSectionIndex)
      
      let replaceIdx = 0
      newProjects = newProjects.map(p => {
        if ((p.section_id || 'unassigned') === targetSectionId) {
          return reorderedSectionProjects[replaceIdx++]
        }
        return p
      })
      setProjects(newProjects)
    } else {
      setProjects(newProjects)
    }

    // Update backend
    const finalSectionProjects = newProjects.filter(p => (p.section_id || 'unassigned') === targetSectionId)
    const updates = finalSectionProjects.map((p, index) => ({
      id: p.id,
      sort_order: index,
      section_id: p.section_id
    }))
    updateProjectOrderAction(updates, creatorName).catch(console.error)
  }

  // --- Bulk Move Logic ---
  const handleBulkMove = async () => {
    if (!targetSectionId || selectedIds.length === 0) return
    
    // Update local state
    let newProjects = [...projects]
    
    // Find moving items and update their section_id
    const movingItems = newProjects.filter(p => selectedIds.includes(p.id))
      .map(p => ({ ...p, section_id: targetSectionId }))
      
    // Remove them from old locations
    newProjects = newProjects.filter(p => !selectedIds.includes(p.id))
    
    // Append them to the target section
    const targetSectionItems = newProjects.filter(p => (p.section_id || 'unassigned') === targetSectionId)
    targetSectionItems.push(...movingItems)
    
    // Rebuild full array
    const allSectionIds = Array.from(new Set([...sections.map(s => s.id), 'unassigned']))
    let finalProjects: any[] = []
    for (const sId of allSectionIds) {
      if (sId === targetSectionId) {
        finalProjects.push(...targetSectionItems)
      } else {
        finalProjects.push(...newProjects.filter(p => (p.section_id || 'unassigned') === sId))
      }
    }
    
    setProjects(finalProjects)
    setSelectedIds([])
    setTargetSectionId('')
    
    // Update backend for target section (they are appended at the end)
    const updates = targetSectionItems.map((p, index) => ({
      id: p.id,
      sort_order: index,
      section_id: targetSectionId === 'unassigned' ? null : targetSectionId
    }))
    
    try {
      await updateProjectOrderAction(updates, creatorName)
    } catch (e) {
      console.error(e)
      alert('게시물 이동에 실패했습니다.')
    }
  }

  // --- Section Reorder Logic ---
  const handleSectionReorderSave = async (newSections: any[]) => {
    setSections(newSections)
    setIsSectionModalOpen(false)
    try {
      await updateSectionOrderAction(newSections.map(s => s.id), creatorName)
    } catch (error) {
      console.error(error)
      alert('섹션 순서 저장에 실패했습니다.')
    }
  }

  const projectsBySection = useMemo(() => {
    const grouped = sections.map(section => ({
      section,
      projects: projects.filter(p => p.section_id === section.id)
    }))

    const unassignedProjects = projects.filter(p => !p.section_id || !sections.find(s => s.id === p.section_id))
    if (unassignedProjects.length > 0) {
      grouped.push({
        section: { id: 'unassigned', name: '미배정 (Unassigned)' } as any,
        projects: unassignedProjects
      })
    }
    return grouped
  }, [sections, projects])

  if (!isMounted) return null

  return (
    <div className="space-y-6">
      
      {/* Header Area */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsSectionModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-bold shadow hover:bg-neutral-800 transition-colors"
        >
          <Settings2 size={16} />
          섹션 순서 관리
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between sticky top-4 z-50 shadow-lg">
          <div className="flex items-center gap-3 mb-2 sm:mb-0">
            <CheckSquare size={20} className="text-blue-500" />
            <span className="font-bold text-blue-800">{selectedIds.length}개의 게시물이 선택되었습니다.</span>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-medium text-neutral-700 outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px] flex-1 sm:flex-none"
            >
              <option value="" disabled>이동할 섹션 선택...</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="unassigned">미배정 (Unassigned)</option>
            </select>
            
            <button 
              onClick={handleBulkMove}
              disabled={!targetSectionId}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              여기로 이동
            </button>
            
            <button 
              onClick={() => {
                setSelectedIds([])
                setTargetSectionId('')
              }}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 shrink-0 ml-2"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Main List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-8">
          {projectsBySection.map(({ section, projects: sectionProjects }) => (
            <div key={section.id} className="bg-white rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="p-5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                <div className="flex items-center gap-3 flex-1">
                  <h3 className="font-bold text-neutral-800 text-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {section.name} 
                    {section.id !== 'unassigned' && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        section.section_type === 'image_grid' ? 'bg-blue-100 text-blue-700' :
                        section.section_type === 'video_slider' ? 'bg-red-100 text-red-700' :
                        section.section_type === 'text' ? 'bg-purple-100 text-purple-700' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {section.section_type === 'image_grid' ? '🖼️ 이미지 그리드' :
                         section.section_type === 'video_slider' ? '▶️ 영상 슬라이더' :
                         section.section_type === 'text' ? '📝 텍스트 단락' : '미분류'}
                      </span>
                    )}
                    <span className="text-neutral-400 font-normal text-sm ml-2">({sectionProjects.length}개)</span>
                  </h3>
                </div>
              </div>
              
              <div className="flex flex-col w-full">
                {/* Header Row */}
                <div className="flex items-center px-4 py-3 bg-neutral-50/80 text-neutral-500 border-b border-neutral-200 text-xs tracking-wider uppercase font-bold">
                  <div className="w-[30px] ml-[10px]"></div> {/* Checkbox placeholder */}
                  <div className="flex-1 ml-[40px]">작품 제목</div>
                  <div className="w-1/6 hidden sm:block">유형</div>
                  <div className="w-1/6 hidden md:block">생성일</div>
                  <div className="w-12 text-right">관리</div>
                </div>

                {/* Items */}
                <div className="flex flex-col min-h-[50px]">
                  {sectionProjects.length === 0 ? (
                    <div className="p-8 text-center text-neutral-400 font-medium bg-white">
                      이 섹션에는 등록된 게시물이 없습니다.
                    </div>
                  ) : (
                    <SortableContext items={sectionProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      {sectionProjects.map((project) => (
                        <SortableProjectRow 
                          key={project.id} 
                          project={project} 
                          creatorName={creatorName} 
                          isSelected={selectedIds.includes(project.id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))}
                    </SortableContext>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeId && (
            <SortableProjectRow 
              project={projects.find(p => p.id === activeId)!} 
              creatorName={creatorName} 
              isSelected={selectedIds.includes(activeId)}
              isOverlay 
            />
          )}
        </DragOverlay>
      </DndContext>

      {projectsBySection.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <p className="text-neutral-500 font-medium mb-4">아직 생성된 섹션이나 게시물이 없습니다.</p>
          <a 
            href={`/creator/${creatorName}`}
            className="inline-block bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow hover:bg-neutral-800 transition-colors"
          >
            포트폴리오 화면으로 이동
          </a>
        </div>
      )}

      {/* Section Reorder Modal */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <SectionReorderModal
            sections={sections}
            onClose={() => setIsSectionModalOpen(false)}
            onSave={handleSectionReorderSave}
          />
        </div>
      )}
    </div>
  )
}

'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { createSectionAction, updateSectionOrderAction, updateSectionNameAction, deleteSectionAction, updateSectionContentAction } from '@/app/actions/section'
import { updateProjectOrderAction, createSimpleVideoProjectAction } from '@/app/actions/projects'
import SectionContainer from './SectionContainer'
import ProjectCard from './ProjectCard'
import RichTextEditor from '@/components/editor/RichTextEditor'
import ScrollSpyNav from './ScrollSpyNav'
import ProjectModal from './ProjectModal'
import ProjectDetailsViewer from './ProjectDetailsViewer'
import { fetchProjectDetails } from '@/app/actions/projectClientActions'
import SectionReorderModal from './SectionReorderModal'
import { useState, useEffect, useMemo, useRef } from 'react'

interface Section {
  id: string
  name: string
  section_type?: string
  content?: string | null
  sort_order: number
  is_visible?: boolean
  show_title?: boolean
}

interface Project {
  id: string
  title: string
  thumbnail_url: string | null
  category?: { name: string }
  likes_count?: number
  section_id: string | null
  sort_order: number
}

interface DraggablePortfolioProps {
  creatorId: string
  creatorName: string
  initialSections: Section[]
  initialProjects: Project[]
  initialWipLogs?: any[]
  isOwner?: boolean
}

export default function DraggablePortfolio({
  creatorId,
  creatorName,
  initialSections,
  initialProjects,
  initialWipLogs = [],
  isOwner = false,
}: DraggablePortfolioProps) {
  // Normalize projects (assign null section_id to the first section if any exists, else 'default')
  const defaultSectionId = initialSections[0]?.id || 'default'

  const [sections, setSections] = useState<Section[]>(initialSections)
  const [projects, setProjects] = useState<Project[]>(
    initialProjects.map(p => ({
      ...p,
      section_id: p.section_id || defaultSectionId
    })).sort((a, b) => a.sort_order - b.sort_order)
  )

  useEffect(() => {
    setSections(initialSections)
  }, [initialSections])

  useEffect(() => {
    setProjects(
      initialProjects.map(p => ({
        ...p,
        section_id: p.section_id || defaultSectionId
      })).sort((a, b) => a.sort_order - b.sort_order)
    )
  }, [initialProjects, defaultSectionId])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'Section' | 'Project' | null>(null)

  // Client Modal State
  const parentScrollYRef = useRef<number>(0)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectData, setSelectedProjectData] = useState<any>(null)
  const [selectedProjectWidgets, setSelectedProjectWidgets] = useState<any[]>([])
  const [selectedProjectOtherProjects, setSelectedProjectOtherProjects] = useState<any[]>([])
  const [selectedProjectRelatedType, setSelectedProjectRelatedType] = useState<string>('creator')
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Section Creation Modal State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionType, setNewSectionType] = useState('image_grid')
  const [newSectionContent, setNewSectionContent] = useState('')
  const [isCreatingSection, setIsCreatingSection] = useState(false)

  // Section Reorder Modal State
  const [isSectionReorderModalOpen, setIsSectionReorderModalOpen] = useState(false)

  // Video Project Creation Modal State
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [videoTargetSectionId, setVideoTargetSectionId] = useState('')
  const [newVideoTitle, setNewVideoTitle] = useState('')
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [isCreatingVideo, setIsCreatingVideo] = useState(false)

  // Edit Text Section Modal State
  const [isEditTextModalOpen, setIsEditTextModalOpen] = useState(false)
  const [editTextTargetSectionId, setEditTextTargetSectionId] = useState('')
  const [editTextTitle, setEditTextTitle] = useState('')
  const [editTextContent, setEditTextContent] = useState('')
  const [isEditingText, setIsEditingText] = useState(false)

  // Rename Section Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [sectionToRename, setSectionToRename] = useState<{ id: string, name: string } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  // Delete Section Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevents accidental drag when clicking
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleAddSection = async () => {
    if (!newSectionName.trim()) {
      alert('섹션 이름을 입력해주세요.')
      return
    }

    setIsCreatingSection(true)
    try {
      const res = await createSectionAction(creatorId, newSectionName, newSectionType, newSectionContent, creatorName)
      if (res.success && res.section) {
        setSections([...sections, res.section])
        setIsSectionModalOpen(false)
        setNewSectionName('')
        setNewSectionType('image_grid')
        setNewSectionContent('')
      }
    } catch (err) {
      alert('섹션 추가에 실패했습니다.')
    } finally {
      setIsCreatingSection(false)
    }
  }

  const handleAddVideoProject = async () => {
    if (!newVideoUrl.trim() || !newVideoTitle.trim()) {
      alert('제목과 유튜브 링크를 모두 입력해주세요.')
      return
    }

    setIsCreatingVideo(true)
    try {
      const res = await createSimpleVideoProjectAction(creatorId, newVideoTitle, newVideoUrl, videoTargetSectionId, creatorName)
      if (res.success && res.project) {
        setProjects([...projects, res.project])
        setIsVideoModalOpen(false)
        setNewVideoTitle('')
        setNewVideoUrl('')
        setVideoTargetSectionId('')
      }
    } catch (err) {
      alert('비디오 프로젝트 추가에 실패했습니다.')
    } finally {
      setIsCreatingVideo(false)
    }
  }

  const handleRenameSubmit = async () => {
    if (!sectionToRename || !sectionToRename.name.trim()) return

    setIsRenaming(true)
    try {
      const res = await updateSectionNameAction(sectionToRename.id, sectionToRename.name, creatorName)
      if (res.success) {
        setSections(sections.map(s => s.id === sectionToRename.id ? { ...s, name: sectionToRename.name } : s))
        setRenameModalOpen(false)
        setSectionToRename(null)
      }
    } catch (err) {
      alert('이름 변경에 실패했습니다.')
    } finally {
      setIsRenaming(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!sectionToDelete) return

    setIsDeleting(true)
    try {
      const res = await deleteSectionAction(sectionToDelete, creatorName)
      if (res.success) {
        const targetSection = sections.find(s => s.id !== sectionToDelete)?.id || 'default'
        setProjects(projects.map(p => p.section_id === sectionToDelete ? { ...p, section_id: targetSection } : p))
        setSections(sections.filter(s => s.id !== sectionToDelete))
        setDeleteModalOpen(false)
        setSectionToDelete(null)
      }
    } catch (err) {
      alert('섹션 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditTextSection = async () => {
    if (!editTextContent.trim()) {
      alert('본문 내용을 입력해주세요.')
      return
    }

    setIsEditingText(true)
    try {
      const resContent = await updateSectionContentAction(editTextTargetSectionId, editTextContent, creatorName)
      const resName = await updateSectionNameAction(editTextTargetSectionId, editTextTitle, creatorName)
      
      if (resContent.success && resName.success) {
        setSections(sections.map(s => s.id === editTextTargetSectionId ? { ...s, content: editTextContent, name: editTextTitle } : s))
        setIsEditTextModalOpen(false)
        setEditTextContent('')
        setEditTextTitle('')
        setEditTextTargetSectionId('')
      }
    } catch (err) {
      alert('본문 수정에 실패했습니다.')
    } finally {
      setIsEditingText(false)
    }
  }

  const handleOpenProject = async (projectId: string) => {
    // 1. 모달이 열리기 직전의 진짜 부모 스크롤 높이를 정밀 백업!
    parentScrollYRef.current = window.scrollY
    setSelectedProjectId(projectId)
    setIsLoadingProject(true)
    window.history.pushState(null, '', `/creator/${creatorName}/project/${projectId}`)
    
    const res = await fetchProjectDetails(projectId)
    if (res.success) {
      setSelectedProjectData(res.project)
      setSelectedProjectWidgets(res.widgets || [])
      setSelectedProjectOtherProjects(res.otherProjects || [])
      setSelectedProjectRelatedType(res.relatedType || 'creator')
    }
    setIsLoadingProject(false)
  }

  const handleCloseProject = () => {
    setSelectedProjectId(null)
    setSelectedProjectData(null)
    setSelectedProjectWidgets([])
    setSelectedProjectOtherProjects([])
    setSelectedProjectRelatedType('creator')
    window.history.pushState(null, '', `/creator/${creatorName}`)

    // 2. 모달이 닫히는 즉시 백업해 두었던 스크롤 좌표로 기적의 수동 복원!
    const targetScroll = parentScrollYRef.current
    setTimeout(() => {
      window.scrollTo(0, targetScroll)
      if ((window as any).lenis) {
        (window as any).lenis.scrollTo(targetScroll, { immediate: true })
      }
    }, 20)
  }

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (selectedProjectId) {
        setSelectedProjectId(null)
        // 뒤로가기로 모달이 닫힐 때도 백업해 두었던 스크롤 좌표로 즉시 수동 복원!
        const targetScroll = parentScrollYRef.current
        setTimeout(() => {
          window.scrollTo(0, targetScroll)
          if ((window as any).lenis) {
            (window as any).lenis.scrollTo(targetScroll, { immediate: true })
          }
        }, 20)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedProjectId])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    setActiveType(active.data.current?.type as 'Section' | 'Project')
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const isActiveProject = active.data.current?.type === 'Project'
    const isOverProject = over.data.current?.type === 'Project'
    const isOverSection = over.data.current?.type === 'Section'

    if (!isActiveProject) return // We only care about Project moving between sections

    // Helper to safely group and re-insert items to prevent global array interleaving
    const moveItemAcrossSections = (items: any[], activeId: string, overId: string | null, targetSectionId: string) => {
      const activeItem = items.find(p => p.id === activeId)
      if (!activeItem) return items
      
      const updatedActive = { ...activeItem, section_id: targetSectionId }
      const filteredItems = items.filter(p => p.id !== activeId)
      
      const allSectionIds = Array.from(new Set(items.map(p => p.section_id)))
      if (!allSectionIds.includes(targetSectionId)) allSectionIds.push(targetSectionId)

      let newProjects: any[] = []
      
      for (const sId of allSectionIds) {
        let sectionProjects = filteredItems.filter(p => p.section_id === sId)
        
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

    // Dropping a Project over another Project
    if (isActiveProject && isOverProject) {
      setProjects((items) => {
        const activeItem = items.find((t) => t.id === activeId)
        const overItem = items.find((t) => t.id === overId)

        if (activeItem && overItem && activeItem.section_id !== overItem.section_id) {
          return moveItemAcrossSections(items, activeId as string, overId as string, overItem.section_id as string)
        }
        return items
      })
    }

    // Dropping a Project into an empty Section
    if (isActiveProject && isOverSection) {
      const targetSectionData = sections.find(s => s.id === overId)
      if (targetSectionData?.section_type === 'text') return

      setProjects((items) => {
        const activeItem = items.find((t) => t.id === activeId)
        if (activeItem && activeItem.section_id !== overId) {
          return moveItemAcrossSections(items, activeId as string, null, overId as string)
        }
        return items
      })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    setActiveType(null)

    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    const isActiveSection = active.data.current?.type === 'Section'
    if (isActiveSection) {
      if (activeId === overId) return
      
      const activeIndex = sections.findIndex((s) => s.id === activeId)
      const overIndex = sections.findIndex((s) => s.id === overId)
      const newSections = arrayMove(sections, activeIndex, overIndex)
      
      setSections(newSections)
      // Save to DB outside of the state updater
      updateSectionOrderAction(newSections.map(s => s.id), creatorName).catch(console.error)
      return
    }

    const isActiveProject = active.data.current?.type === 'Project'
    if (isActiveProject) {
      let newProjects = [...projects]
      const activeProject = newProjects.find(p => p.id === activeId)
      const overProject = newProjects.find(p => p.id === overId)

      if (activeProject && overProject) {
        const sectionId = overProject.section_id

        // Ensure activeProject's section_id is updated if it moved across sections
        if (activeProject.section_id !== sectionId) {
          activeProject.section_id = sectionId
        }

        // Extract projects only for this target section
        const sectionProjects = newProjects.filter(p => p.section_id === sectionId)
        
        const activeSectionIndex = sectionProjects.findIndex(p => p.id === activeId)
        const overSectionIndex = sectionProjects.findIndex(p => p.id === overId)

        if (activeSectionIndex !== -1 && overSectionIndex !== -1 && activeSectionIndex !== overSectionIndex) {
          const reorderedSectionProjects = arrayMove(sectionProjects, activeSectionIndex, overSectionIndex)
          
          // Re-insert into the global newProjects array at the same indices they were found
          let replaceIdx = 0
          newProjects = newProjects.map(p => {
            if (p.section_id === sectionId) {
              return reorderedSectionProjects[replaceIdx++]
            }
            return p
          })
          
          setProjects(newProjects)
        } else if (activeId !== overId) {
          // Fallback if something weird happened
          setProjects(newProjects)
        }
      }

      // Group by section and update sort_order properly
      const updates = newProjects.map((p) => {
        const sectionProjects = newProjects.filter(sp => sp.section_id === p.section_id)
        const localIndex = sectionProjects.findIndex(sp => sp.id === p.id)
        return {
          id: p.id,
          section_id: p.section_id,
          sort_order: localIndex
        }
      })

      updateProjectOrderAction(updates, creatorName).catch(console.error)
    }
  }

  // Globally disable text selection while dragging to prevent native auto-scroll conflicts
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

  const visibleSections = sections.filter(s => isOwner || s.is_visible !== false)
  const visibleSectionIds = useMemo(() => visibleSections.map(s => s.id), [visibleSections])

  return (
    <div className="w-full relative">
      <ScrollSpyNav sections={visibleSections} />
      
      {isOwner && (
        <div className="flex justify-end mb-6 gap-3 relative z-[100]">
          <div className="relative">
            <button
              onClick={() => setIsSectionReorderModalOpen(!isSectionReorderModalOpen)}
              className="bg-white text-neutral-800 border border-neutral-300 px-5 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-white transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              섹션 순서 관리            </button>
            {isSectionReorderModalOpen && (
              <div className="absolute top-full right-0 mt-3 z-[100]">
                <SectionReorderModal
                  sections={sections}
                  onClose={() => setIsSectionReorderModalOpen(false)}
                  onSave={async (newSections) => {
                    setSections(newSections)
                    await updateSectionOrderAction(newSections.map(s => s.id), creatorName)
                  }}
                />
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSectionModalOpen(true)}
            className="bg-black text-white px-6 py-2 rounded-full text-sm font-bold shadow hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            섹션 추가
          </button>
        </div>
      )}

      <DndContext
        id="portfolio-dnd-context"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        autoScroll={{
          threshold: { x: 0, y: 100 }, // 화면 상하단 y축 100px 범위에서 자동 스크롤 구동
          acceleration: 2.0,           // 스크롤 가속 최적화
        }}
      >
        <div className="space-y-16">
          <SortableContext items={visibleSectionIds} strategy={verticalListSortingStrategy}>
            {visibleSections.map((section) => (
              <SectionContainer
                key={section.id}
                section={section}
                projects={projects.filter(p => p.section_id === section.id)}
                allProjects={projects}
                wipLogs={initialWipLogs}
                onOpenProject={handleOpenProject}
                creatorName={creatorName}
                isOwner={isOwner}
                globalIsDragging={!!activeId}
                onRename={() => {
                  setSectionToRename({ id: section.id, name: section.name })
                  setRenameModalOpen(true)
                }}
                onDelete={() => {
                  if (sections.length <= 1) {
                    alert('마지막 남은 섹션은 삭제할 수 없습니다.')
                    return
                  }
                  setSectionToDelete(section.id)
                  setDeleteModalOpen(true)
                }}
                onAddVideoProject={(sectionId) => {
                  setVideoTargetSectionId(sectionId)
                  setIsVideoModalOpen(true)
                }}
                onEditText={() => {
                  setEditTextTargetSectionId(section.id)
                  setEditTextTitle(section.name)
                  setEditTextContent(section.content || '')
                  setIsEditTextModalOpen(true)
                }}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeId && activeType === 'Section' ? (
            <div className="bg-neutral-100 p-4 rounded-lg border border-neutral-300 opacity-80 h-32 flex items-center justify-center font-bold">
              {sections.find(s => s.id === activeId)?.name}
            </div>
          ) : null}
          {activeId && activeType === 'Project' ? (
            <div className="opacity-80 scale-105 transition-transform origin-center">
              <ProjectCard project={projects.find(p => p.id === activeId)!} creatorName={creatorName} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Section Creation Modal */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
              <h2 className="text-xl font-bold text-neutral-800">새로운 섹션 추가</h2>
              <p className="text-sm text-neutral-500 mt-1">섹션의 종류와 이름을 설정하세요.</p>
            </div>

            <div className="p-6 overflow-y-auto grow flex flex-col gap-5" data-lenis-prevent="true">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-2">섹션 종류</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSectionType('image_grid')}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-lg border-2 transition-colors ${newSectionType === 'image_grid' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-neutral-200 hover:border-neutral-300 text-neutral-500'}`}
                  >
                    <span className="text-2xl mb-2">🖼️</span>
                    <span className="text-[10px] md:text-xs font-bold">이미지 그리드</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSectionType('video_slider')}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-lg border-2 transition-colors ${newSectionType === 'video_slider' ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 hover:border-neutral-300 text-neutral-500'}`}
                  >
                    <span className="text-2xl mb-2">▶️</span>
                    <span className="text-[10px] md:text-xs font-bold">영상 슬라이더</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSectionType('text')}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-lg border-2 transition-colors ${newSectionType === 'text' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-neutral-200 hover:border-neutral-300 text-neutral-500'}`}
                  >
                    <span className="text-2xl mb-2">📝</span>
                    <span className="text-[10px] md:text-xs font-bold">텍스트 단락</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSectionType('wip_timeline')}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-lg border-2 transition-colors ${newSectionType === 'wip_timeline' ? 'border-neutral-900 bg-neutral-50 text-neutral-900' : 'border-neutral-200 hover:border-neutral-300 text-neutral-500'}`}
                  >
                    <span className="text-2xl mb-2">⏱️</span>
                    <span className="text-[10px] md:text-xs font-bold">WIP 타임라인</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-2">섹션 이름</label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="예: 3D 모델링 작업물"
                  className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {newSectionType === 'text' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-600 uppercase mb-2">본문 내용</label>
                  <RichTextEditor
                    content={newSectionContent}
                    onChange={setNewSectionContent}
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsSectionModalOpen(false)}
                className="px-5 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddSection}
                disabled={isCreatingSection || !newSectionName.trim()}
                className="px-6 py-2 bg-black text-white text-sm font-bold rounded-full shadow hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {isCreatingSection ? '추가 중...' : '섹션 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Project Creation Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-neutral-800">새 비디오 추가</h2>
              <p className="text-sm text-neutral-500 mt-1">유튜브 링크를 입력하여 슬라이더에 추가하세요.</p>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-2">작품 제목</label>
                <input
                  type="text"
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="예: 3D 모델링 작업물"
                  className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-2">유튜브 URL</label>
                <input
                  type="text"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                />
                <p className="text-xs text-neutral-400 mt-2">입력된 유튜브 영상은 자동으로 임베드되어 재생됩니다.</p>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="px-5 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddVideoProject}
                disabled={isCreatingVideo || !newVideoTitle.trim() || !newVideoUrl.trim()}
                className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-full shadow hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isCreatingVideo ? '추가 중...' : '비디오 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Text Section Modal */}
      {isEditTextModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center sm:p-6 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white sm:rounded-2xl shadow-2xl w-full max-w-7xl h-full sm:h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top Action Bar */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditTextModalOpen(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-800 transition-colors rounded-full hover:bg-neutral-100"
                  title="닫기"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
                <span className="text-sm font-semibold text-neutral-500">본문 편집</span>
              </div>
              <button
                onClick={handleEditTextSection}
                disabled={isEditingText || !editTextContent.trim()}
                className="px-6 py-2 bg-black text-white text-sm font-bold rounded-full shadow-md hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {isEditingText ? '저장 중...' : '완료'}
              </button>
            </div>

            {/* Seamless Editor Area */}
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white" data-lenis-prevent="true">
              <div className="max-w-7xl mx-auto w-full px-6 py-10 sm:px-12 sm:py-16 flex flex-col min-h-full">
                
                {/* Title Input */}
                <input
                  type="text"
                  value={editTextTitle}
                  onChange={(e) => setEditTextTitle(e.target.value)}
                  placeholder="섹션 제목을 입력하세요"
                  className="w-full text-4xl sm:text-5xl font-extrabold text-neutral-900 placeholder:text-neutral-200 border-none outline-none bg-transparent mb-8 tracking-tight"
                />
                
                {/* Rich Text Editor */}
                <div className="flex-1">
                  <RichTextEditor
                    content={editTextContent}
                    onChange={setEditTextContent}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Section Modal */}
      {renameModalOpen && sectionToRename && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-neutral-800">섹션 이름 변경</h2>
            </div>

            <div className="p-6">
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-2">새로운 이름</label>
              <input
                type="text"
                value={sectionToRename.name}
                onChange={(e) => setSectionToRename({ ...sectionToRename, name: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                autoFocus
              />
            </div>

            <div className="p-4 bg-white border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setRenameModalOpen(false)}
                className="px-5 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={isRenaming || !sectionToRename.name.trim()}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-full shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isRenaming ? '저장 중...' : '변경 내용 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Section Modal */}
      {deleteModalOpen && sectionToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-red-600">섹션 삭제 확인</h2>
            </div>

            <div className="p-6">
              <p className="text-neutral-700 font-medium">정말로 이 섹션을 삭제하시겠습니까?</p>
              <p className="text-sm text-neutral-500 mt-2">이 섹션에 포함된 프로젝트들은 삭제되지 않고 <strong>기본 섹션</strong>으로 이동됩니다.</p>
            </div>

            <div className="p-4 bg-white border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-5 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-full shadow hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '네, 삭제합니다'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client-Side Project Modal */}
      {selectedProjectId && (
        <ProjectModal 
          onClose={handleCloseProject}
          title={selectedProjectData?.title}
          description={selectedProjectData?.description}
          createdAt={selectedProjectData?.created_at}
        >
          {isLoadingProject ? (
            <div className="w-full min-h-[50vh] flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
            </div>
          ) : selectedProjectData ? (
            <ProjectDetailsViewer 
              project={selectedProjectData} 
              widgets={selectedProjectWidgets} 
              creatorName={creatorName} 
              isModal={true} 
              otherProjects={selectedProjectOtherProjects}
              relatedType={selectedProjectRelatedType}
            />
          ) : (
            <div className="w-full min-h-[50vh] flex items-center justify-center">
              <p className="text-neutral-500">Failed to load project details.</p>
            </div>
          )}
        </ProjectModal>
      )}

    </div>
  )
}


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
import SectionReorderModal from './SectionReorderModal'
import { useRouter } from 'next/navigation'
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

  const router = useRouter()
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

  const handleOpenProject = (projectId: string) => {
    // 1. 모달이 열리기 직전의 진짜 부모 스크롤 높이를 정밀 백업!
    parentScrollYRef.current = window.scrollY
    
    // 2. Next.js의 Parallel/Intercepting Routes 기능을 100% 활용하도록 네이티브 라우팅 수행!
    // 이는 @modal/(.)project/[project_id] 경로를 트리거하며, 중복 렌더링 방지 및 URL 동기화를 완벽히 해결합니다.
    router.push(`/project/${projectId}`, { scroll: false })
  }

  const handleCloseProject = () => {
    setSelectedProjectId(null)
    setSelectedProjectData(null)
    setSelectedProjectWidgets([])
    setSelectedProjectOtherProjects([])
    setSelectedProjectRelatedType('creator')
    window.history.pushState(null, '', `/`)

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

  // Escape key to close section modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSectionModalOpen) {
        setIsSectionModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSectionModalOpen])


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
        {/* 💡 섹션 위치 및 순서 변경 관리 가이드라인 */}
        {isOwner && (
          <div className="mb-8 bg-blue-50/45 dark:bg-blue-950/15 border border-blue-200/50 dark:border-blue-800/40 rounded-xl p-4 flex gap-3.5 text-left items-start animate-in fade-in duration-300">
            <span className="text-xl shrink-0 mt-0.5">💡</span>
            <div>
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
                섹션 드래그앤드롭 순서 재조정 및 가이드라인
              </h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed font-medium">
                각 섹션 헤더 좌측에 있는 **⠿ 손잡이 핸들**에 마우스 커서를 대고 원하는 위치로 위아래로 드래그하면, 메인 홈페이지에 노출되는 작품 목록의 순서가 실시간으로 재정렬되어 저장됩니다.
                보다 편리하고 빠르게 일괄적으로 변경하려면 우측 상단의 **&quot;섹션 순서 관리&quot;** 버튼을 눌러 계층 리스트 모드로 조절할 수도 있습니다.
              </p>
            </div>
          </div>
        )}

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
        <div onClick={(e) => { if (e.target === e.currentTarget) setIsSectionModalOpen(false) }} className="fixed inset-0 bg-neutral-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300 section-modal-scope">
          {/* Scoped CSS Keyframe Animations for Section Previews */}
          <style>{`
            .section-modal-scope .grid-card-1-anim {
              animation: grid-card-pop 4s infinite ease-in-out;
            }
            .section-modal-scope .grid-card-2-anim {
              animation: grid-card-pop 4s infinite ease-in-out 0.4s;
            }
            .section-modal-scope .grid-card-3-anim {
              animation: grid-card-pop 4s infinite ease-in-out 0.8s;
            }
            .section-modal-scope .slider-track-anim {
              animation: slider-track-roll 10s infinite linear;
            }
            .section-modal-scope .text-line-1-anim {
              animation: line-grow-kf 4s infinite ease-in-out;
            }
            .section-modal-scope .text-line-2-anim {
              animation: line-grow-kf 4s infinite ease-in-out 0.5s;
            }
            .section-modal-scope .text-line-3-anim {
              animation: line-grow-kf 4s infinite ease-in-out 1s;
            }
            .section-modal-scope .timeline-track-grow {
              animation: timeline-path-grow 4s infinite ease-in-out;
            }
            .section-modal-scope .timeline-node-anim {
              animation: timeline-node-pulse 2s infinite ease-in-out;
            }
            .section-modal-scope .timeline-card-1-anim {
              animation: timeline-card-pop 4s infinite ease-in-out 0.3s;
            }
            .section-modal-scope .timeline-card-2-anim {
              animation: timeline-card-pop 4s infinite ease-in-out 1s;
            }

            @keyframes grid-card-pop {
              0%, 100% { opacity: 0.4; transform: scale(0.95); border-color: #e5e5e5; }
              50% { opacity: 1; transform: scale(1); border-color: #3b82f6; box-shadow: 0 0 10px rgba(59,130,246,0.15); }
            }
            @keyframes slider-track-roll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-33.33%); }
            }
            @keyframes line-grow-kf {
              0%, 100% { width: 0%; opacity: 0.3; }
              50% { width: 100%; opacity: 1; }
            }
            @keyframes timeline-path-grow {
              0%, 10% { height: 0%; }
              90%, 100% { height: 100%; }
            }
            @keyframes timeline-node-pulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.3); }
              50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
            }
            @keyframes timeline-card-pop {
              0%, 10% { opacity: 0; transform: translateX(8px); }
              35%, 85% { opacity: 1; transform: translateX(0); }
              95%, 100% { opacity: 0; }
            }
          `}</style>

          <div className="bg-white/95 border border-neutral-200 text-neutral-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] w-full max-w-[850px] md:h-[580px] flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-300 backdrop-blur-xl">
            
            {/* Left Column: Form & Configuration */}
            <div data-lenis-prevent="true" className="w-full md:w-[380px] border-b md:border-b-0 md:border-r border-neutral-200/80 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar bg-neutral-50/40 shrink-0">
              <div className="space-y-6">
                {/* Header */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <h3 className="font-extrabold text-xs text-neutral-800 tracking-wider uppercase">
                      BLOCKCANVAS CREATOR SECTION
                    </h3>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mt-1">
                    새로운 포트폴리오 섹션 레이아웃 추가
                  </p>
                </div>

                {/* Section Type Choices */}
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2.5">섹션 레이아웃 선택</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Image Grid */}
                    <button
                       type="button"
                       onClick={() => setNewSectionType('image_grid')}
                       className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                         newSectionType === 'image_grid'
                           ? 'border-blue-500 bg-blue-50/70 text-blue-700 shadow-[0_4px_14px_rgba(59,130,246,0.08)] font-bold'
                           : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 shadow-sm'
                       }`}
                    >
                      <span className="text-xl shrink-0">🖼️</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">이미지 그리드</div>
                        <p className={`text-[9px] font-semibold mt-0.5 truncate ${newSectionType === 'image_grid' ? 'text-blue-500/80' : 'text-neutral-400'}`}>갤러리 격자</p>
                      </div>
                    </button>

                    {/* Video Slider */}
                    <button
                       type="button"
                       onClick={() => setNewSectionType('video_slider')}
                       className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                         newSectionType === 'video_slider'
                           ? 'border-red-500 bg-red-50/70 text-red-700 shadow-[0_4px_14px_rgba(244,63,94,0.08)] font-bold'
                           : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 shadow-sm'
                       }`}
                    >
                      <span className="text-xl shrink-0">▶️</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">영상 슬라이더</div>
                        <p className={`text-[9px] font-semibold mt-0.5 truncate ${newSectionType === 'video_slider' ? 'text-red-500/80' : 'text-neutral-400'}`}>가로 롤링</p>
                      </div>
                    </button>

                    {/* Text block */}
                    <button
                       type="button"
                       onClick={() => setNewSectionType('text')}
                       className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                         newSectionType === 'text'
                           ? 'border-purple-500 bg-purple-50/70 text-purple-700 shadow-[0_4px_14px_rgba(139,92,246,0.08)] font-bold'
                           : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 shadow-sm'
                       }`}
                    >
                      <span className="text-xl shrink-0">📝</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">텍스트 단락</div>
                        <p className={`text-[9px] font-semibold mt-0.5 truncate ${newSectionType === 'text' ? 'text-purple-500/80' : 'text-neutral-400'}`}>자유 캔버스</p>
                      </div>
                    </button>

                    {/* WIP Timeline */}
                    <button
                       type="button"
                       onClick={() => setNewSectionType('wip_timeline')}
                       className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                         newSectionType === 'wip_timeline'
                           ? 'border-amber-500 bg-amber-50/70 text-amber-700 shadow-[0_4px_14px_rgba(245,158,11,0.08)] font-bold'
                           : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 shadow-sm'
                       }`}
                    >
                      <span className="text-xl shrink-0">⏱️</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">WIP 타임라인</div>
                        <p className={`text-[9px] font-semibold mt-0.5 truncate ${newSectionType === 'wip_timeline' ? 'text-amber-600/85' : 'text-neutral-400'}`}>히스토리 피드</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Section Name Input */}
                <div className="text-left">
                  <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2.5">섹션 이름</label>
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="예: 3D 모델링 작업물"
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/20 transition-all font-medium py-3 px-4 shadow-sm text-xs outline-none font-semibold"
                    autoFocus
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-5 border-t border-neutral-200/60 mt-8 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddSection}
                  disabled={isCreatingSection || !newSectionName.trim()}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isCreatingSection ? '추가 중...' : '섹션 추가'}
                </button>
              </div>
            </div>

            {/* Right Column: Visual Simulation & Onboarding Description */}
            <div data-lenis-prevent="true" className="flex-1 bg-neutral-50/20 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {/* Title */}
                <div className="text-left">
                  <h4 className="text-xs font-extrabold text-neutral-800 tracking-wide">포트폴리오 비주얼 시뮬레이션</h4>
                  <p className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider mt-0.5">선택한 섹션의 실제 동작 모션 미리보기</p>
                </div>

                {/* Animation Simulation Frame */}
                <div className="h-[250px] bg-neutral-50 border border-neutral-200/80 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner">
                  {/* Image Grid Simulation */}
                  {newSectionType === 'image_grid' && (
                    <div className="w-full h-full flex flex-col justify-center items-center p-4 gap-3 animate-in fade-in duration-300">
                      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                        <div className="h-16 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-xl shadow-sm grid-card-1-anim">🖼️</div>
                        <div className="h-16 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-xl shadow-sm grid-card-2-anim">🖼️</div>
                        <div className="h-16 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-xl shadow-sm grid-card-3-anim">🖼️</div>
                      </div>
                      <div className="text-[9px] text-blue-500/80 font-bold uppercase tracking-widest animate-pulse mt-2.5">
                        Responsive Grid System Active
                      </div>
                    </div>
                  )}

                  {/* Video Slider Simulation */}
                  {newSectionType === 'video_slider' && (
                    <div className="w-full h-full flex flex-col justify-center items-center p-4 overflow-hidden relative animate-in fade-in duration-300">
                      <div className="flex gap-3.5 w-[650px] slider-track-anim">
                        <div className="w-24 h-16 bg-white border border-neutral-200 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 shadow-sm">
                          <span className="text-red-500 font-bold text-base">▶</span>
                          <span className="text-[8px] text-neutral-400 font-bold mt-1">Video 01</span>
                        </div>
                        <div className="w-24 h-16 bg-white border border-neutral-200 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 shadow-sm">
                          <span className="text-red-500 font-bold text-base">▶</span>
                          <span className="text-[8px] text-neutral-400 font-bold mt-1">Video 02</span>
                        </div>
                        <div className="w-24 h-16 bg-white border border-neutral-200 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 shadow-sm">
                          <span className="text-red-500 font-bold text-base">▶</span>
                          <span className="text-[8px] text-neutral-400 font-bold mt-1">Video 03</span>
                        </div>
                        <div className="w-24 h-16 bg-white border border-neutral-200 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 shadow-sm">
                          <span className="text-red-500 font-bold text-base">▶</span>
                          <span className="text-[8px] text-neutral-400 font-bold mt-1">Video 01</span>
                        </div>
                        <div className="w-24 h-16 bg-white border border-neutral-200 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 shadow-sm">
                          <span className="text-red-500 font-bold text-base">▶</span>
                          <span className="text-[8px] text-neutral-400 font-bold mt-1">Video 02</span>
                        </div>
                        <div className="w-24 h-16 bg-white border border-neutral-200 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 shadow-sm">
                          <span className="text-red-500 font-bold text-base">▶</span>
                          <span className="text-[8px] text-neutral-400 font-bold mt-1">Video 03</span>
                        </div>
                      </div>
                      <div className="text-[9px] text-red-500/80 font-bold uppercase tracking-widest animate-pulse mt-4">
                        Horizontal Scroll Carousel
                      </div>
                    </div>
                  )}

                  {/* Text block Simulation */}
                  {newSectionType === 'text' && (
                    <div className="w-full h-full flex flex-col justify-center items-center p-4 gap-3 animate-in fade-in duration-300">
                      <div className="w-full max-w-[280px] bg-white border border-neutral-200 rounded-xl p-4 text-left shadow-sm">
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                        </div>
                        <div className="h-2 bg-neutral-200 rounded-full w-full mb-2 text-line-1-anim" />
                        <div className="h-2 bg-neutral-200 rounded-full w-[90%] mb-2 text-line-2-anim" />
                        <div className="h-2 bg-neutral-200 rounded-full w-[65%] text-line-3-anim" />
                      </div>
                      <div className="text-[9px] text-purple-500/80 font-bold uppercase tracking-widest animate-pulse mt-2.5">
                        Rich Paragraph Document
                      </div>
                    </div>
                  )}

                  {/* WIP Timeline Simulation */}
                  {newSectionType === 'wip_timeline' && (
                    <div className="w-full h-full flex items-center justify-center p-4 relative animate-in fade-in duration-300">
                      <div className="w-full max-w-[280px] flex items-stretch gap-4 relative">
                        {/* Left dotted line */}
                        <div className="w-[1.5px] bg-neutral-200 relative shrink-0">
                          <div className="absolute top-0 bottom-0 left-0 right-0 border-l border-dashed border-neutral-300" />
                          <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-b from-amber-400/80 to-transparent timeline-track-grow" />
                          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 timeline-node-anim" />
                          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 timeline-node-anim" />
                        </div>
                        
                        {/* Right timeline cards */}
                        <div className="flex-1 flex flex-col gap-3.5 py-1.5 text-left">
                          <div className="bg-white border border-neutral-200 rounded-lg p-2 shadow-sm timeline-card-1-anim">
                            <span className="text-[6px] text-neutral-400 block font-mono font-bold">2026-05-28</span>
                            <span className="text-[8px] text-neutral-700 font-extrabold leading-none block mt-0.5">3D 렌더링 착수</span>
                          </div>
                          <div className="bg-white border border-neutral-200 rounded-lg p-2 shadow-sm timeline-card-2-anim">
                            <span className="text-[6px] text-neutral-400 block font-mono font-bold">2026-05-29</span>
                            <span className="text-[8px] text-neutral-700 font-extrabold leading-none block mt-0.5">디테일 맵핑 작업 완료</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Guidelines Description Card */}
              <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-xl flex items-start gap-3 text-left">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div className="animate-in fade-in duration-200">
                  {newSectionType === 'image_grid' && (
                    <>
                      <h5 className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">이미지 그리드 (Image Grid)</h5>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed font-semibold">
                        여러 이미지 파일을 한 번에 선택·업로드하여 그리드 격자 형태로 정렬 배치하는 작품 갤러리입니다. 대표작 사진, 3D 모델링 스크린샷, 그래픽 디자인 포트폴리오를 보여주기에 가장 완벽한 기본 레이아웃입니다.
                      </p>
                    </>
                  )}
                  {newSectionType === 'video_slider' && (
                    <>
                      <h5 className="text-[11px] font-extrabold text-red-600 uppercase tracking-wider">영상 슬라이더 (Video Slider)</h5>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed font-semibold">
                        유튜브 비디오 링크 주소를 연동하여 옆으로 부드럽게 넘겨볼 수 있는 가로 카드 슬라이더 형태로 노출합니다. 모션 그래픽 릴, 영상 편집 포트폴리오, 3D 카메라 워킹 작업 쇼케이스 등에 탁월한 선택입니다.
                      </p>
                    </>
                  )}
                  {newSectionType === 'text' && (
                    <>
                      <h5 className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider">텍스트 단락 (Text Block Canvas)</h5>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed font-semibold">
                        고급 리치 텍스트 에디터를 사용하여 자유롭게 서식 있는 설명글을 작성할 수 있습니다. 텍스트 효과, 다단 분할 레이아웃, 아코디언 FAQ 위젯 등을 삽입하여 작품 설명이나 자기소개 페이지를 입체적으로 구성할 수 있습니다.
                      </p>
                    </>
                  )}
                  {newSectionType === 'wip_timeline' && (
                    <>
                      <h5 className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider">WIP 타임라인 (Work In Progress)</h5>
                      <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed font-semibold">
                        현재 활발히 진행 중인 제작 단계와 진척 과정을 시간 순으로 기록하는 피드 섹션입니다. 작업 과정을 투명하게 기록하여 내 팬들과 구매 고객들에게 높은 신뢰와 생생한 비하인드 스토리를 전달해 보세요.
                      </p>
                    </>
                  )}
                </div>
              </div>
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

      {/* Client-Side Project Modal is now handled by Next.js Parallel Routes (@modal) */}

    </div>
  )
}


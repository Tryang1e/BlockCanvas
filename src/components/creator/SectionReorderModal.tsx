'use client'

import React, { useState } from 'react'
import Tooltip from '@/components/ui/Tooltip'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Section {
  id: string
  name: string
  sort_order: number
  section_type?: string
}

function getSectionTypeBadge(type?: string) {
  if (!type || type === 'unassigned') return null
  const colors = 
    type === 'image_grid' ? 'bg-blue-100 text-blue-700' :
    type === 'video_slider' ? 'bg-red-100 text-red-700' :
    type === 'text' ? 'bg-purple-100 text-purple-700' :
    'bg-neutral-100 text-neutral-700'
  const label =
    type === 'image_grid' ? '🖼️ 이미지 그리드' :
    type === 'video_slider' ? '▶️ 영상 슬라이더' :
    type === 'text' ? '📝 텍스트 단락' : '미분류'
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${colors}`}>
      {label}
    </span>
  )
}

interface SectionReorderModalProps {
  sections: Section[]
  onClose: () => void
  onSave: (newSections: Section[]) => Promise<void>
}

// ---------------------------------------------------------------------------
// Sortable Item Component
// ---------------------------------------------------------------------------
function SortableSectionItem({ section }: { section: Section }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 p-3.5 bg-neutral-100 border-2 border-dashed border-neutral-300 rounded-xl mb-2 opacity-50 h-[52px]"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3.5 bg-white border rounded-xl mb-2 transition-all border-neutral-200 hover:border-neutral-300 hover:shadow-md shadow-sm`}
    >
      <Tooltip text="드래그하여 순서 변경" position="left">
        <div
          {...attributes}
          {...listeners}
          className="text-neutral-400 hover:text-neutral-900 cursor-grab active:cursor-grabbing px-1 py-2 transition-colors flex items-center justify-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
          </svg>
        </div>
      </Tooltip>
      <span className="font-bold text-neutral-800 text-base flex-1 truncate tracking-tight">{section.name}</span>
      {getSectionTypeBadge(section.section_type)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Modal Component
// ---------------------------------------------------------------------------
export default function SectionReorderModal({ sections, onClose, onSave }: SectionReorderModalProps) {
  const [localSections, setLocalSections] = useState<Section[]>(sections)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(localSections)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] w-[360px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 shrink-0 flex justify-between items-center bg-neutral-50/50">
        <div>
          <h2 className="text-base font-black text-neutral-900 tracking-tight">섹션 순서 관리</h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">항목을 위아래로 드래그하여 순서를 맞추세요.</p>
        </div>
        <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 rounded-full transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="p-4 overflow-y-auto max-h-[360px] custom-scrollbar bg-neutral-50/30">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={localSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {localSections.map((section) => (
              <SortableSectionItem key={section.id} section={section} />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeId ? (
              <div className="flex items-center gap-3 p-3.5 bg-white border border-neutral-900 rounded-xl shadow-2xl scale-105 z-50 ring-1 ring-neutral-900 cursor-grabbing">
                <div className="text-neutral-900 px-1 py-2 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
                    <circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                  </svg>
                </div>
                <span className="font-bold text-neutral-800 text-base flex-1 truncate tracking-tight">
                  {localSections.find(s => s.id === activeId)?.name}
                </span>
                {getSectionTypeBadge(localSections.find(s => s.id === activeId)?.section_type)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="p-4 bg-white border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2.5 shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 rounded-lg transition-all"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-neutral-900 text-white text-sm font-bold rounded-lg shadow-md hover:bg-black transition-all disabled:opacity-50"
        >
          {isSaving ? '저장 중...' : '순서 저장하기'}
        </button>
      </div>
    </div>
  )
}

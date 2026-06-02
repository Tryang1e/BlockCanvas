import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { getCaretCoordinates, CaretCoordinates } from "../../lib/caret-position"
import { Editor } from "@tiptap/react"

export interface CommandItem {
  id: string
  label: string
  description: string
  icon: string
  shortcut?: string
  action: () => void
}

interface SlashCommandMenuProps {
  editorActive: boolean
  onSelect: (type: 'text' | 'image_grid' | 'video' | 'embed') => void
  onClose: () => void
  editor?: Editor
}

export default function SlashCommandMenu({ editorActive, onSelect, onClose, editor }: SlashCommandMenuProps) {
  const [coords, setCoords] = useState<CaretCoordinates | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Define the available command blocks
  const items: CommandItem[] = [
    {
      id: "text",
      label: "텍스트 서식 (Text)",
      description: "일반 문단이나 스타일 텍스트를 시작합니다.",
      icon: "📝",
      shortcut: "/text",
      action: () => onSelect("text"),
    },
    {
      id: "image_grid",
      label: "포토 그리드 (Image Grid)",
      description: "로컬 이미지를 업로드하여 그리드 레이아웃을 생성합니다.",
      icon: "🖼️",
      shortcut: "/image",
      action: () => onSelect("image_grid"),
    },
    {
      id: "video",
      label: "비디오/오디오 (Media)",
      description: "동영상(최대 1GB) 또는 음악 파일을 업로드합니다.",
      icon: "▶",
      shortcut: "/video",
      action: () => onSelect("video"),
    },
    {
      id: "embed",
      label: "임베드 (iFrame Embed)",
      description: "유튜브, X(트위터) 링크 혹은 아이프레임 코드를 임베드합니다.",
      icon: "🔗",
      shortcut: "/embed",
      action: () => onSelect("embed"),
    },
  ]

  // Dynamically position the menu at the caret on mounting
  useEffect(() => {
    const updatePosition = () => {
      if (editor && !editor.isDestroyed) {
        try {
          const { view, state } = editor
          const { from } = state.selection
          const rect = view.coordsAtPos(from)
          if (rect) {
            setCoords({
              top: rect.top + window.scrollY,
              left: rect.left + window.scrollX,
              height: rect.bottom - rect.top,
            })
            return
          }
        } catch (err) {
          console.warn("Failed to get caret coordinates from editor view:", err)
        }
      }

      // Fallback to fragile DOM caret measurement
      const position = getCaretCoordinates()
      if (position) {
        setCoords(position)
      } else {
        onClose()
      }
    }

    // Delay slightly to ensure DOM has updated with the trigger key
    const timer = setTimeout(updatePosition, 20)
    return () => clearTimeout(timer)
  }, [onClose, editor])

  // Handle keyboard interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!coords) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % items.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case "Enter":
          e.preventDefault()
          items[selectedIndex].action()
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [coords, selectedIndex, items])

  // Close menu if user clicks outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  if (!coords) return null

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[99999] w-72 bg-neutral-900/95 border border-neutral-850 rounded-xl shadow-2xl p-1.5 flex flex-col font-sans select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ease-out"
      style={{
        top: `${coords.top + coords.height + 6}px`,
        left: `${coords.left}px`,
      }}
    >
      <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800/50 mb-1">
        블록 타입 선택
      </div>

      <div className="flex flex-col max-h-64 overflow-y-auto pr-1">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "text-neutral-300 hover:bg-neutral-850 hover:text-white"
              }`}
            >
              <span className="text-base bg-neutral-800/40 p-1 px-2 rounded-md shrink-0">
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-bold truncate">{item.label}</span>
                  {item.shortcut && (
                    <span
                      className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded ${
                        isSelected
                          ? "bg-blue-700 text-blue-200"
                          : "bg-neutral-850 text-neutral-500"
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </div>
                <p
                  className={`text-[10px] mt-0.5 leading-relaxed line-clamp-1 ${
                    isSelected ? "text-blue-100" : "text-neutral-400"
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-1 border-t border-neutral-800/50 pt-1.5 px-2 text-[9px] text-neutral-500 font-medium flex items-center justify-between">
        <span>↑↓ 이동 • Enter 선택</span>
        <span>Esc 닫기</span>
      </div>
    </div>,
    document.body
  )
}

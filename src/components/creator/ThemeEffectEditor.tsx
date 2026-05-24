'use client'

import { useState, useRef, useEffect } from 'react'
import { updateThemeBgEffectAction } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'
import { Sparkles, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Tooltip from '@/components/ui/Tooltip'

const EFFECTS = [
  { group: '기본 (Default)', items: [
    { value: 'none', label: '사용 안 함 (Effect Off)' },
  ]},
  { group: '최적화 버전 (가벼움)', items: [
    { value: 'floating_blocks', label: '반투명 블록 (Floating Blocks)' },
    { value: 'retro_grid', label: '레트로 모눈종이 (Retro Grid)' },
    { value: 'moving_grid', label: '은은한 모눈종이 (Moving Grid)' },
    { value: 'css_stars', label: '반짝이는 별빛 (Twinkling Stars)' },
    { value: 'aurora', label: '오로라 그라데이션 (Aurora Glow)' },
  ]},
  { group: '고사양 버전 (화려함)', items: [
    { value: 'flickering_grid', label: '깜빡이는 그리드 (Flickering Grid)' },
    { value: 'shooting_stars', label: '떨어지는 별똥별 (Shooting Stars)' },
    { value: 'wavy_waves', label: '일렁이는 3D 파동 (Wavy Waves)' },
    { value: 'particle_network', label: '파티클 넷 (Particle Network)' },
    { value: 'gravity_stars', label: '인터랙티브 별빛 (Gravity Stars)' },
    { value: 'fireworks', label: '불꽃놀이 (Fireworks)' },
  ]},
  { group: 'Animate UI (고급형)', items: [
    { value: 'animate_bubble', label: '다이나믹 버블 (Bubbles)' },
    { value: 'animate_fireworks', label: '인터랙티브 폭죽 (3D Fireworks)' },
    { value: 'animate_gradient', label: '그라데이션 (Gradient)' },
    { value: 'animate_gravity_stars', label: '중력 별빛 (Gravity Stars)' },
    { value: 'animate_hexagon', label: '헥사곤 그리드 (Hexagon)' },
    { value: 'animate_stars', label: '3D 우주 별빛 (3D Stars)' },
  ]}
]

export default function ThemeEffectEditor({ 
  creatorName, 
  currentEffect 
}: { 
  creatorName: string
  currentEffect: string | null 
}) {
  const [effect, setEffect] = useState(currentEffect || 'none')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleEffectChange = async (newEffect: string) => {
    // 0ms 즉각적인 낙관적 테마 변경 이벤트 발송
    window.dispatchEvent(new CustomEvent('theme-effect-change', { detail: newEffect }))

    setEffect(newEffect)
    setIsOpen(false)
    setIsUpdating(true)
    
    try {
      await updateThemeBgEffectAction(creatorName, newEffect)
      router.refresh()
    } catch (error) {
      console.error('Failed to update theme effect:', error)
      alert('배경 애니메이션 변경 중 오류가 발생했습니다.')
      
      // 오류 발생 시 이전 테마로 안전하게 롤백
      const rollbackEffect = currentEffect || 'none'
      setEffect(rollbackEffect)
      window.dispatchEvent(new CustomEvent('theme-effect-change', { detail: rollbackEffect }))
    } finally {
      setIsUpdating(false)
    }
  }

  // Find current label to display in the button
  const currentLabel = EFFECTS.flatMap(g => g.items).find(i => i.value === effect)?.label || 'EFFECT OFF'
  const shortLabel = currentLabel.includes('(') ? currentLabel.split('(')[1].replace(')','') : currentLabel

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      <Tooltip text="배경 애니메이션 효과 설정" position="top">
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isUpdating}
          className="flex items-center gap-2 bg-black/85 backdrop-blur-2xl px-4 py-2.5 rounded-full border-2 border-white/20 transition-all shadow-[0_12px_45px_rgba(0,0,0,0.6)] hover:border-white/30 group disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95 duration-200"
        >
          <Sparkles size={13} className={cn("text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]", isUpdating && "animate-pulse")} />
          <span className="text-[10px] md:text-[11px] font-mono font-black text-white tracking-widest uppercase">
            {shortLabel}
          </span>
          {isUpdating ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin ml-1"></span>
          ) : (
            <ChevronDown size={13} className={cn("text-white/80 transition-transform", isOpen && "rotate-180")} />
          )}
        </button>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            data-lenis-prevent="true"
            className="absolute top-full mt-2 right-0 w-[280px] max-h-[300px] overflow-y-auto overscroll-contain bg-neutral-900/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl p-2 z-[9999] scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
          >
            {EFFECTS.map((group, idx) => (
              <div key={group.group} className={cn("mb-2", idx === EFFECTS.length - 1 && "mb-0")}>
                <div className="px-3 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest select-none">
                  {group.group}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => handleEffectChange(item.value)}
                      className={cn(
                        "flex items-center justify-between w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors",
                        effect === item.value 
                          ? "bg-white/15 text-white" 
                          : "text-neutral-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {item.label}
                      {effect === item.value && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

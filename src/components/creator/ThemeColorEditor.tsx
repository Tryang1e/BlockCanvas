'use client'

import { useState, useEffect } from 'react'
import { updateThemeBgColorAction, updatePortfolioDesignAction } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'
import { Minimize2, Maximize2, Grid, Layers, Image as ImageIcon } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'

// 테마 종합 디자인 설정 파서 (효과, 카드 모서리, 섹션 모서리, 이미지 모서리, 그리드 갭)
const parseThemeDesignConfig = (themeBgEffect: string | null | undefined) => {
  let effect = 'none'
  let cardRound = false
  let sectionRound = false
  let imageRound = false
  let gridGap = 24

  if (themeBgEffect) {
    const parts = themeBgEffect.split('|')
    effect = parts[0] || 'none'
    parts.forEach(part => {
      if (part.startsWith('card:')) {
        cardRound = part.replace('card:', '') === 'round'
      }
      if (part.startsWith('section:')) {
        sectionRound = part.replace('section:', '') === 'round'
      }
      if (part.startsWith('image:')) {
        imageRound = part.replace('image:', '') === 'round'
      }
      if (part.startsWith('gap:')) {
        const val = parseInt(part.replace('gap:', ''), 10)
        if (!isNaN(val)) gridGap = val
      }
    })
  }

  return { effect, cardRound, sectionRound, imageRound, gridGap }
}

const serializeThemeDesignConfig = (
  effect: string,
  cardRound: boolean,
  sectionRound: boolean,
  imageRound: boolean,
  gridGap: number
) => {
  return `${effect}|card:${cardRound ? 'round' : 'sharp'}|section:${sectionRound ? 'round' : 'sharp'}|image:${imageRound ? 'round' : 'sharp'}|gap:${gridGap}`
}

export default function ThemeColorEditor({ 
  creatorName, 
  currentThemeColor,
  currentThemeEffect
}: { 
  creatorName: string
  currentThemeColor: string 
  currentThemeEffect: string | null
}) {
  const [color, setColor] = useState(currentThemeColor)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  // 1. 복합 디자인 설정 로드 및 동기화
  const initialConfig = parseThemeDesignConfig(currentThemeEffect)
  const [cardRound, setCardRound] = useState(initialConfig.cardRound)
  const [sectionRound, setSectionRound] = useState(initialConfig.sectionRound)
  const [imageRound, setImageRound] = useState(initialConfig.imageRound)
  const [gridGap, setGridGap] = useState(initialConfig.gridGap)
  
  const currentEffectName = initialConfig.effect

  useEffect(() => {
    document.documentElement.style.setProperty('--card-corner-radius', cardRound ? '16px' : '0px')
    document.documentElement.style.setProperty('--section-corner-radius', sectionRound ? '16px' : '0px')
    document.documentElement.style.setProperty('--editor-image-corner-radius', imageRound ? '16px' : '0px')
    document.documentElement.style.setProperty('--grid-gap', `${gridGap}px`)
  }, [cardRound, sectionRound, imageRound, gridGap])

  const handleColorChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value
    setColor(newColor)
    
    const headerElement = document.querySelector('.hero-container') as HTMLElement
    if (headerElement) {
      headerElement.style.backgroundColor = newColor
    }
    const gradientElement = document.querySelector('.absolute.inset-0.z-10.pointer-events-none') as HTMLElement
    if (gradientElement) {
      gradientElement.style.background = `linear-gradient(to top, ${newColor}, transparent)`
    }

    setIsUpdating(true)
    try {
      await updateThemeBgColorAction(creatorName, newColor)
      router.refresh()
    } catch (error) {
      console.error('Failed to update theme color:', error)
      alert('테마 색상 변경 중 오류가 발생했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReset = async () => {
    if (color === '#222222') return
    const newColor = '#222222'
    setColor(newColor)
    
    const headerElement = document.querySelector('.hero-container') as HTMLElement
    if (headerElement) {
      headerElement.style.backgroundColor = newColor
    }
    const gradientElement = document.querySelector('.absolute.inset-0.z-10.pointer-events-none') as HTMLElement
    if (gradientElement) {
      gradientElement.style.background = `linear-gradient(to top, ${newColor}, transparent)`
    }

    setIsUpdating(true)
    try {
      await updateThemeBgColorAction(creatorName, newColor)
      router.refresh()
    } catch (error) {
      console.error('Failed to reset theme color:', error)
      alert('테마 색상 초기화 중 오류가 발생했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }

  // 부분별 토글 변경 핸들러
  const toggleCardCorner = async () => {
    const nextVal = !cardRound
    setCardRound(nextVal)
    if (typeof window !== 'undefined') {
      localStorage.setItem('corner-card', nextVal ? 'round' : 'sharp')
      window.dispatchEvent(new CustomEvent('corner-style-change'))
    }
    try {
      const combined = serializeThemeDesignConfig(currentEffectName, nextVal, sectionRound, imageRound, gridGap)
      await updatePortfolioDesignAction(creatorName, combined)
    } catch (e) {
      console.error('Failed to save card corner:', e)
    }
  }

  const toggleSectionCorner = async () => {
    const nextVal = !sectionRound
    setSectionRound(nextVal)
    if (typeof window !== 'undefined') {
      localStorage.setItem('corner-section', nextVal ? 'round' : 'sharp')
      window.dispatchEvent(new CustomEvent('corner-style-change'))
    }
    try {
      const combined = serializeThemeDesignConfig(currentEffectName, cardRound, nextVal, imageRound, gridGap)
      await updatePortfolioDesignAction(creatorName, combined)
    } catch (e) {
      console.error('Failed to save section corner:', e)
    }
  }

  const toggleImageCorner = async () => {
    const nextVal = !imageRound
    setImageRound(nextVal)
    if (typeof window !== 'undefined') {
      localStorage.setItem('corner-image', nextVal ? 'round' : 'sharp')
      window.dispatchEvent(new CustomEvent('corner-style-change'))
    }
    try {
      const combined = serializeThemeDesignConfig(currentEffectName, cardRound, sectionRound, nextVal, gridGap)
      await updatePortfolioDesignAction(creatorName, combined)
    } catch (e) {
      console.error('Failed to save image corner:', e)
    }
  }

  const handleGapChange = async (newGap: number) => {
    setGridGap(newGap)
    if (typeof window !== 'undefined') {
      localStorage.setItem('grid-gap-value', String(newGap))
    }
    try {
      const combined = serializeThemeDesignConfig(currentEffectName, cardRound, sectionRound, imageRound, newGap)
      await updatePortfolioDesignAction(creatorName, combined)
    } catch (e) {
      console.error('Failed to save grid gap:', e)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 bg-black/85 backdrop-blur-2xl px-6 py-2.5 rounded-full border-2 border-white/20 shadow-[0_12px_45px_rgba(0,0,0,0.6)] hover:border-white/30 transition-all duration-300 pointer-events-auto">
      {/* 테마 컬러 컨트롤 세트 */}
      <Tooltip text="메인 테마 색상 변경" position="top">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full shadow-inner overflow-hidden relative cursor-pointer ring-2 ring-white/60 hover:scale-105 active:scale-95 transition-transform">
            <input 
              type="color" 
              value={color} 
              onChange={handleColorChange}
              disabled={isUpdating}
              className="absolute -inset-2 w-10 h-10 opacity-0 cursor-pointer"
            />
            <div className="w-full h-full" style={{ backgroundColor: color }} />
          </div>
          <span className="text-[10px] md:text-[11px] font-mono tracking-widest text-white select-none cursor-pointer relative uppercase font-black hover:text-blue-400 transition-colors">
            THEME
            <input 
              type="color" 
              value={color} 
              onChange={handleColorChange}
              disabled={isUpdating}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </span>
          {isUpdating && (
            <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
          )}
          <button 
            type="button"
            onClick={handleReset}
            disabled={isUpdating}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-[10px] transition-all border-0 cursor-pointer hover:rotate-45 active:scale-90"
            title="초기화 (#222222)"
          >
            ↺
          </button>
        </div>
      </Tooltip>

      <div className="w-0.5 h-4 bg-white/20" />

      {/* 카드 모퉁이 토글 (Sharp / Round) */}
      <Tooltip text={cardRound ? "카드 모서리: 날카롭게 (Sharp)" : "카드 모서리: 둥글게 (Round)"} position="top">
        <button 
          type="button"
          onClick={toggleCardCorner}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-white/10 text-neutral-200 hover:text-white transition-all border-0 bg-transparent cursor-pointer hover:scale-[1.03] active:scale-95"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <Grid size={13} className={cardRound ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "text-neutral-400"} />
          </span>
          <span className={`text-[10px] md:text-[11px] font-mono tracking-widest uppercase font-black transition-colors ${cardRound ? 'text-blue-400 font-extrabold' : 'text-neutral-200'}`}>
            CARD: {cardRound ? 'ROUND' : 'SHARP'}
          </span>
        </button>
      </Tooltip>

      <div className="w-0.5 h-4 bg-white/15" />

      {/* 섹션 모퉁이 토글 (Sharp / Round) */}
      <Tooltip text={sectionRound ? "섹션 모서리: 날카롭게 (Sharp)" : "섹션 모서리: 둥글게 (Round)"} position="top">
        <button 
          type="button"
          onClick={toggleSectionCorner}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-white/10 text-neutral-200 hover:text-white transition-all border-0 bg-transparent cursor-pointer hover:scale-[1.03] active:scale-95"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <Layers size={13} className={sectionRound ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "text-neutral-400"} />
          </span>
          <span className={`text-[10px] md:text-[11px] font-mono tracking-widest uppercase font-black transition-colors ${sectionRound ? 'text-emerald-400 font-extrabold' : 'text-neutral-200'}`}>
            SEC: {sectionRound ? 'ROUND' : 'SHARP'}
          </span>
        </button>
      </Tooltip>

      <div className="w-0.5 h-4 bg-white/15" />

      {/* 에디터 이미지 모퉁이 토글 (Sharp / Round) */}
      <Tooltip text={imageRound ? "이미지 모서리: 날카롭게 (Sharp)" : "이미지 모서리: 둥글게 (Round)"} position="top">
        <button 
          type="button"
          onClick={toggleImageCorner}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-white/10 text-neutral-200 hover:text-white transition-all border-0 bg-transparent cursor-pointer hover:scale-[1.03] active:scale-95"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <ImageIcon size={13} className={imageRound ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-neutral-400"} />
          </span>
          <span className={`text-[10px] md:text-[11px] font-mono tracking-widest uppercase font-black transition-colors ${imageRound ? 'text-amber-400 font-extrabold' : 'text-neutral-200'}`}>
            IMG: {imageRound ? 'ROUND' : 'SHARP'}
          </span>
        </button>
      </Tooltip>

      <div className="w-0.5 h-4 bg-white/20" />

      {/* 프로젝트 카드 간격 조절 스킨 (0px ~ 48px) */}
      <Tooltip text="카드 사이 여백 조절" position="top">
        <div className="flex items-center gap-2">
          <span className="text-[10px] md:text-[11px] font-mono tracking-widest text-neutral-350 font-black uppercase select-none">GAP</span>
          <div className="flex gap-1 bg-neutral-900/90 p-1 rounded-full border border-white/10">
            {[0, 12, 24, 36, 48].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleGapChange(g)}
                className={`w-6 h-5 flex items-center justify-center text-[10px] font-mono font-black rounded-full transition-all border-0 cursor-pointer hover:scale-105 ${
                  gridGap === g
                    ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.7)] font-extrabold'
                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </Tooltip>
    </div>
  )
}

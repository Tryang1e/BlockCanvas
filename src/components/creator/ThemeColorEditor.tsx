'use client'

import { useState, useEffect, useRef } from 'react'
import { updateThemeBgColorAction, updatePortfolioDesignAction } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'
import { Minimize2, Maximize2, Grid, Layers, Image as ImageIcon } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import { safeStorage } from '@/lib/storage'

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

function hexToHsl(hex: string): string {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function hexToHslValues(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const colorVal = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * colorVal).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsb(hex: string): { h: number; s: number; b: number } {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const v = max

  const d = max - min
  s = max === 0 ? 0 : d / max

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    b: Math.round(v * 100)
  }
}

function hsbToHex(h: number, s: number, b: number): string {
  s /= 100
  b /= 100
  const c = b * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = b - c
  let r = 0, g = 0, bl = 0

  if (h >= 0 && h < 60) {
    r = c; g = x; bl = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; bl = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; bl = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; bl = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; bl = c
  } else if (h >= 300 && h <= 360) {
    r = c; g = 0; bl = x
  }

  const red = Math.round((r + m) * 255)
  const green = Math.round((g + m) * 255)
  const blue = Math.round((bl + m) * 255)

  const f = (val: number) => Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0')
  return `#${f(red)}${f(green)}${f(blue)}`
}

function hexToCmyk(hex: string): { c: number; m: number; y: number; k: number } {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255

  const k = 1 - Math.max(r, g, b)
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 }
  }
  const cyan = Math.round((1 - r - k) / (1 - k) * 100)
  const magenta = Math.round((1 - g - k) / (1 - k) * 100)
  const yellow = Math.round((1 - b - k) / (1 - k) * 100)
  const black = Math.round(k * 100)

  return { c: cyan, m: magenta, y: yellow, k: black }
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
  c /= 100
  m /= 100
  y /= 100
  k /= 100
  
  const r = Math.round(255 * (1 - c) * (1 - k))
  const g = Math.round(255 * (1 - m) * (1 - k))
  const b = Math.round(255 * (1 - y) * (1 - k))
  
  const f = (val: number) => Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}

const HSB_SWATCHES = [
  { hex: '#00f5d4', label: 'Neon Cyan' },
  { hex: '#7b2cbf', label: 'Vivid Purple' },
  { hex: '#f72585', label: 'Sunset Amber' },
  { hex: '#06d6a0', label: 'Emerald Green' }
]

const CMYK_SWATCHES = [
  { hex: '#00ffff', label: 'Pure Cyan' },
  { hex: '#ff00ff', label: 'Pure Magenta' },
  { hex: '#ffff00', label: 'Pure Yellow' },
  { hex: '#111111', label: 'Key Black' }
]


const CardCornerGuide = () => (
  <div className="w-full flex flex-col gap-1 select-none pointer-events-none">
    <p className="text-[11.5px] text-neutral-300 font-medium leading-relaxed">
      홈페이지 내 모든 프로젝트 카드의 모서리 곡률을 조절합니다.
    </p>
    <div className="w-full h-14 flex items-center justify-center bg-neutral-900/60 border border-white/5 rounded-lg overflow-hidden relative p-2 mt-1">
      <div className="w-24 h-8 border border-neutral-700 bg-neutral-950 flex items-center justify-center relative overflow-hidden animate-[morphCard_2.5s_infinite_ease-in-out]">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500/80 absolute top-1 left-1" />
        <span className="text-[7px] font-mono text-neutral-400 font-bold uppercase tracking-widest">Card Layout</span>
      </div>
      <style>{`
        @keyframes morphCard {
          0%, 100% { border-radius: 0px; }
          50% { border-radius: 10px; }
        }
      `}</style>
    </div>
  </div>
)

const SectionCornerGuide = () => (
  <div className="w-full flex flex-col gap-1 select-none pointer-events-none">
    <p className="text-[11.5px] text-neutral-300 font-medium leading-relaxed">
      메인 갤러리 섹션 단락의 모서리 곡률을 조절합니다.
    </p>
    <div className="w-full h-14 flex items-center justify-center bg-neutral-900/60 border border-white/5 rounded-lg overflow-hidden relative p-2 mt-1">
      <div className="w-28 h-9 border border-neutral-700 bg-neutral-950/80 flex items-center justify-center relative overflow-hidden animate-[morphSection_2.5s_infinite_ease-in-out]">
        <span className="text-[7px] font-mono text-neutral-350 font-black uppercase tracking-wider">Section Block</span>
      </div>
      <style>{`
        @keyframes morphSection {
          0%, 100% { border-radius: 0px; }
          50% { border-radius: 12px; }
        }
      `}</style>
    </div>
  </div>
)

const ImageCornerGuide = () => (
  <div className="w-full flex flex-col gap-1 select-none pointer-events-none">
    <p className="text-[11.5px] text-neutral-300 font-medium leading-relaxed">
      에디터 내부 이미지 및 미디어 블록의 모서리 곡률을 조절합니다.
    </p>
    <div className="w-full h-14 flex items-center justify-center bg-neutral-900/60 border border-white/5 rounded-lg overflow-hidden relative p-2 mt-1">
      <div className="w-20 h-9 border border-neutral-700 bg-neutral-950 flex items-center justify-center relative overflow-hidden animate-[morphImage_2.5s_infinite_ease-in-out]">
        <ImageIcon size={10} className="text-neutral-500" />
      </div>
      <style>{`
        @keyframes morphImage {
          0%, 100% { border-radius: 0px; }
          50% { border-radius: 8px; }
        }
      `}</style>
    </div>
  </div>
)

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
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [colorMode, setColorMode] = useState<'hsb' | 'cmyk'>('hsb')
  const [hsbVals, setHsbVals] = useState(() => hexToHsb(currentThemeColor))
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    setHsbVals(hexToHsb(color))
  }, [color])

  useEffect(() => {
    if (!isPickerOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPickerOpen])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

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

  const saveColorToDb = async (newColor: string) => {
    setIsUpdating(true)
    try {
      await updateThemeBgColorAction(creatorName, newColor)
      router.refresh()
    } catch (error) {
      console.error('Failed to update theme color:', error)
    } finally {
      setIsUpdating(false)
    }
  }

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

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveColorToDb(newColor)
    }, 400)
  }

  const handleHsbChange = (h: number, s: number, b: number) => {
    const newHex = hsbToHex(h, s, b)
    setHsbVals({ h, s, b })
    setColor(newHex)
    
    const headerElement = document.querySelector('.hero-container') as HTMLElement
    if (headerElement) {
      headerElement.style.backgroundColor = newHex
    }
    const gradientElement = document.querySelector('.absolute.inset-0.z-10.pointer-events-none') as HTMLElement
    if (gradientElement) {
      gradientElement.style.background = `linear-gradient(to top, ${newHex}, transparent)`
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveColorToDb(newHex)
    }, 400)
  }

  const handleCmykChange = (c: number, m: number, y: number, k: number) => {
    const newHex = cmykToHex(c, m, y, k)
    setColor(newHex)
    
    const headerElement = document.querySelector('.hero-container') as HTMLElement
    if (headerElement) {
      headerElement.style.backgroundColor = newHex
    }
    const gradientElement = document.querySelector('.absolute.inset-0.z-10.pointer-events-none') as HTMLElement
    if (gradientElement) {
      gradientElement.style.background = `linear-gradient(to top, ${newHex}, transparent)`
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveColorToDb(newHex)
    }, 400)
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

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveColorToDb(newColor)
  }

  // 부분별 토글 변경 핸들러
  const toggleCardCorner = async () => {
    const nextVal = !cardRound
    setCardRound(nextVal)
    if (typeof window !== 'undefined') {
      safeStorage.setItem('corner-card', nextVal ? 'round' : 'sharp')
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
      safeStorage.setItem('corner-section', nextVal ? 'round' : 'sharp')
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
      safeStorage.setItem('corner-image', nextVal ? 'round' : 'sharp')
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
      safeStorage.setItem('grid-gap-value', String(newGap))
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
      <div className="relative flex items-center gap-2" ref={pickerRef}>
        <Tooltip text="메인 테마 색상 상세 조절" position="bottom">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="w-5 h-5 rounded-full shadow-inner overflow-hidden relative cursor-pointer ring-2 ring-white/60 hover:scale-105 active:scale-95 transition-transform border-0 bg-transparent"
            >
              <div className="w-full h-full" style={{ backgroundColor: color }} />
            </button>
            <button
              type="button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="text-[10px] md:text-[11px] font-mono tracking-widest text-white select-none cursor-pointer relative uppercase font-black hover:text-blue-400 transition-colors border-0 bg-transparent"
            >
              THEME
            </button>
            {isUpdating && (
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            )}
            <button 
              type="button"
              onClick={handleReset}
              disabled={isUpdating}
              className="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-[10px] transition-all border-0 cursor-pointer hover:rotate-45 active:scale-90 animate-spin-hover"
              title="초기화 (#222222)"
            >
              ↺
            </button>
          </div>
        </Tooltip>

        {/* HSL / CMYK Sliders Dropdown Picker Overlay */}
        {isPickerOpen && (
          <div 
            className="absolute top-full mt-3 left-0 bg-neutral-950/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-4 flex flex-col gap-4 w-[280px] z-50 text-left cursor-default select-none animate-in fade-in slide-in-from-top-2 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[11px] font-mono font-black text-neutral-350 tracking-wider uppercase">테마 색상 직접 상세 조절</span>
              <button 
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="text-[10px] text-neutral-400 hover:text-white bg-transparent border-0 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Circular Tabs for HSB & CMYK Selection */}
            <div className="flex justify-center gap-6 py-2 border-b border-white/5">
              <button
                type="button"
                onClick={() => setColorMode('hsb')}
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center text-[9px] font-black tracking-tighter uppercase transition-all duration-300 cursor-pointer border-2 relative overflow-hidden select-none ${
                  colorMode === 'hsb'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] scale-105'
                    : 'border-white/15 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:border-white/30 hover:scale-[1.02]'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 pointer-events-none" />
                <span className="text-xs mb-0.5">🌈</span>
                <span>HSB</span>
              </button>
              <button
                type="button"
                onClick={() => setColorMode('cmyk')}
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center text-[9px] font-black tracking-tighter uppercase transition-all duration-300 cursor-pointer border-2 relative overflow-hidden select-none ${
                  colorMode === 'cmyk'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105'
                    : 'border-white/15 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:border-white/30 hover:scale-[1.02]'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-pink-500/10 to-yellow-500/10 pointer-events-none" />
                <span className="text-xs mb-0.5">🖨️</span>
                <span>CMYK</span>
              </button>
            </div>

            {colorMode === 'hsb' ? (
              /* HSB Sliders */
              <div className="flex flex-col gap-3">
                {/* Hue Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span>색상 (Hue)</span>
                    <span className="text-white font-extrabold">{hsbVals.h}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hsbVals.h}
                    onChange={e => {
                      const h = parseInt(e.target.value, 10)
                      handleHsbChange(h, hsbVals.s, hsbVals.b)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                    }}
                  />
                </div>

                {/* Saturation Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span>채도 (Saturation)</span>
                    <span className="text-white font-extrabold">{hsbVals.s}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hsbVals.s}
                    onChange={e => {
                      const s = parseInt(e.target.value, 10)
                      handleHsbChange(hsbVals.h, s, hsbVals.b)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${hsbToHex(hsbVals.h, 0, hsbVals.b)}, ${hsbToHex(hsbVals.h, 100, hsbVals.b)})`
                    }}
                  />
                </div>

                {/* Brightness Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span>명도 (Brightness)</span>
                    <span className="text-white font-extrabold">{hsbVals.b}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hsbVals.b}
                    onChange={e => {
                      const b = parseInt(e.target.value, 10)
                      handleHsbChange(hsbVals.h, hsbVals.s, b)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #000000, ${hsbToHex(hsbVals.h, hsbVals.s, 100)})`
                    }}
                  />
                </div>
              </div>
            ) : (
              /* CMYK Sliders */
              <div className="flex flex-col gap-3">
                {/* Cyan Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span className="text-cyan-400 font-extrabold">Cyan (C)</span>
                    <span className="text-white font-extrabold">{hexToCmyk(color).c}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hexToCmyk(color).c}
                    onChange={e => {
                      const c = parseInt(e.target.value, 10)
                      const cmyk = hexToCmyk(color)
                      handleCmykChange(c, cmyk.m, cmyk.y, cmyk.k)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    style={{
                      background: `linear-gradient(to right, ${cmykToHex(0, hexToCmyk(color).m, hexToCmyk(color).y, hexToCmyk(color).k)}, ${cmykToHex(100, hexToCmyk(color).m, hexToCmyk(color).y, hexToCmyk(color).k)})`
                    }}
                  />
                </div>

                {/* Magenta Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span className="text-pink-400 font-extrabold">Magenta (M)</span>
                    <span className="text-white font-extrabold">{hexToCmyk(color).m}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hexToCmyk(color).m}
                    onChange={e => {
                      const m = parseInt(e.target.value, 10)
                      const cmyk = hexToCmyk(color)
                      handleCmykChange(cmyk.c, m, cmyk.y, cmyk.k)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    style={{
                      background: `linear-gradient(to right, ${cmykToHex(hexToCmyk(color).c, 0, hexToCmyk(color).y, hexToCmyk(color).k)}, ${cmykToHex(hexToCmyk(color).c, 100, hexToCmyk(color).y, hexToCmyk(color).k)})`
                    }}
                  />
                </div>

                {/* Yellow Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span className="text-yellow-400 font-extrabold">Yellow (Y)</span>
                    <span className="text-white font-extrabold">{hexToCmyk(color).y}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hexToCmyk(color).y}
                    onChange={e => {
                      const y = parseInt(e.target.value, 10)
                      const cmyk = hexToCmyk(color)
                      handleCmykChange(cmyk.c, cmyk.m, y, cmyk.k)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    style={{
                      background: `linear-gradient(to right, ${cmykToHex(hexToCmyk(color).c, hexToCmyk(color).m, 0, hexToCmyk(color).k)}, ${cmykToHex(hexToCmyk(color).c, hexToCmyk(color).m, 100, hexToCmyk(color).k)})`
                    }}
                  />
                </div>

                {/* Black Key Slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-neutral-450">
                    <span className="text-white/60 font-extrabold">Black (K)</span>
                    <span className="text-white font-extrabold">{hexToCmyk(color).k}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hexToCmyk(color).k}
                    onChange={e => {
                      const k = parseInt(e.target.value, 10)
                      const cmyk = hexToCmyk(color)
                      handleCmykChange(cmyk.c, cmyk.m, cmyk.y, k)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-neutral-600"
                    style={{
                      background: `linear-gradient(to right, ${cmykToHex(hexToCmyk(color).c, hexToCmyk(color).m, hexToCmyk(color).y, 0)}, ${cmykToHex(hexToCmyk(color).c, hexToCmyk(color).m, hexToCmyk(color).y, 100)})`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Concept Theme Swatches (동그란 탭 프리셋) */}
            <div className="border-t border-white/5 pt-3 flex flex-col gap-1.5">
              <span className="text-[9px] font-mono font-black text-neutral-450 uppercase tracking-widest">개념적 컬러 프리셋 (동그란 탭)</span>
              <div className="flex items-center gap-3">
                {(colorMode === 'hsb' ? HSB_SWATCHES : CMYK_SWATCHES).map(swatch => {
                  const isActive = color.toLowerCase() === swatch.hex.toLowerCase()
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => {
                        setColor(swatch.hex)
                        if (colorMode === 'hsb') {
                          setHsbVals(hexToHsb(swatch.hex))
                        }
                        const headerElement = document.querySelector('.hero-container') as HTMLElement
                        if (headerElement) headerElement.style.backgroundColor = swatch.hex
                        const gradientElement = document.querySelector('.absolute.inset-0.z-10.pointer-events-none') as HTMLElement
                        if (gradientElement) gradientElement.style.background = `linear-gradient(to top, ${swatch.hex}, transparent)`

                        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
                        saveTimeoutRef.current = setTimeout(() => {
                          saveColorToDb(swatch.hex)
                        }, 400)
                      }}
                      className={`w-6 h-6 rounded-full border transition-all cursor-pointer relative flex items-center justify-center ${
                        isActive 
                          ? 'border-white ring-2 ring-blue-500 scale-110 shadow-lg' 
                          : 'border-white/10 hover:border-white/40 hover:scale-105 active:scale-95'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                      title={`${swatch.label} (${swatch.hex})`}
                    >
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Readouts & Live Previews */}
            <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold text-neutral-400">
                <span>HEX 대표값</span>
                <span className="text-blue-400 uppercase font-black">{color}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono font-bold text-neutral-400">
                <span>HSB 포맷</span>
                <span className="text-emerald-400 font-black">
                  {(() => {
                    const hsb = hexToHsb(color);
                    return `hsb(${hsb.h}, ${hsb.s}%, ${hsb.b}%)`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono font-bold text-neutral-400">
                <span>CMYK 색 분할</span>
                <span className="text-amber-400 font-black">
                  C {hexToCmyk(color).c}% M {hexToCmyk(color).m}% Y {hexToCmyk(color).y}% K {hexToCmyk(color).k}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-0.5 h-4 bg-white/20" />

      <div className="bg-white/10 border border-white/15 px-2.5 py-0.5 rounded-md font-mono text-[9px] text-neutral-350 tracking-wider select-none shrink-0" title="현재 테마색 HSB 값">
        {(() => {
          const hsb = hexToHsb(color);
          return `hsb(${hsb.h}, ${hsb.s}%, ${hsb.b}%)`;
        })()}
      </div>

      <div className="w-0.5 h-4 bg-white/20" />

      {/* 카드 모퉁이 토글 (Sharp / Round) */}
      <Tooltip text={cardRound ? "카드 모서리: 날카롭게 (Sharp)" : "카드 모서리: 둥글게 (Round)"} visualContent={<CardCornerGuide />} position="bottom">
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
      <Tooltip text={sectionRound ? "섹션 모서리: 날카롭게 (Sharp)" : "섹션 모서리: 둥글게 (Round)"} visualContent={<SectionCornerGuide />} position="bottom">
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
      <Tooltip text={imageRound ? "이미지 모서리: 날카롭게 (Sharp)" : "이미지 모서리: 둥글게 (Round)"} visualContent={<ImageCornerGuide />} position="bottom">
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
      <Tooltip text="카드 사이 여백 조절" position="bottom">
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

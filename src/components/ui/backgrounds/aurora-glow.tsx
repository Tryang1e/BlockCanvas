'use client'

import React, { useState, useEffect, useRef } from 'react'

export default function AuroraGlow() {
  const [mouse, setMouse] = useState({ x: 50, y: 50 })
  const [smoothMouse, setSmoothMouse] = useState({ x: 50, y: 50 })
  const requestRef = useRef<number | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      setMouse({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [])

  // 쫀득한 관성(Lerp) 애니메이션 프레임 루프
  useEffect(() => {
    const updateSmoothPosition = () => {
      setSmoothMouse(prev => {
        const dx = mouse.x - prev.x
        const dy = mouse.y - prev.y
        return {
          x: prev.x + dx * 0.08,
          y: prev.y + dy * 0.08
        }
      })
      requestRef.current = requestAnimationFrame(updateSmoothPosition)
    }
    requestRef.current = requestAnimationFrame(updateSmoothPosition)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [mouse])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] bg-neutral-950">
      {/* 1. 네트워크가 필요 없는 100% 자체 드로잉 SVG 영화 필름 노이즈 그레인 */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.15 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      <style>{`
        @keyframes slow-pulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.35; }
          50% { transform: scale(1.15) translate(3vw, -2vh); opacity: 0.5; }
        }
        @keyframes slow-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* 2. 🌌 오로라 앰비언트 글로우 컨테이너 */}
      <div className="absolute inset-0 opacity-45 mix-blend-screen filter blur-[130px] transition-opacity duration-1000">
        
        {/* 오로라 1 - 네온 퍼플 (마우스 위치를 관성으로 쫓음) */}
        <div 
          className="absolute w-[50vw] h-[50vh] rounded-full transition-transform duration-300"
          style={{
            left: `${smoothMouse.x - 25}%`,
            top: `${smoothMouse.y - 25}%`,
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.85) 0%, rgba(147, 51, 234, 0) 70%)',
            transform: 'scale(1.2)',
          }}
        />

        {/* 오로라 2 - 사이버 블루 (마우스 대칭 반사 이동) */}
        <div 
          className="absolute w-[55vw] h-[55vh] rounded-full transition-transform duration-300"
          style={{
            right: `${smoothMouse.x - 27.5}%`,
            bottom: `${smoothMouse.y - 27.5}%`,
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.8) 0%, rgba(37, 99, 235, 0) 70%)',
            transform: 'scale(1.1)',
          }}
        />

        {/* 오로라 3 - 로즈 골드 (화면 내부 펄스 회전) */}
        <div 
          className="absolute top-[25%] left-[25%] w-[45vw] h-[45vh] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(244, 63, 94, 0.4) 0%, rgba(244, 63, 94, 0) 65%)',
            animation: 'slow-pulse 20s ease-in-out infinite, slow-rotate 40s linear infinite',
          }}
        />

        {/* 오로라 4 - 에메랄드 그린 (은은한 풍미감) */}
        <div 
          className="absolute bottom-[10%] left-[10%] w-[40vw] h-[40vh] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(20, 184, 166, 0.35) 0%, rgba(20, 184, 166, 0) 70%)',
            animation: 'slow-pulse 25s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* 3. 글래스모피즘 스포트라이트 대비 보강 레이어 */}
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/80 pointer-events-none" />
    </div>
  )
}

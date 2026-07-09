'use client'

import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface ScrollFillTextProps {
  keyword1?: string
  keyword2?: string
  keyword3?: string
}

export default function ScrollFillText({ 
  keyword1 = 'BLOCK CANVAS', 
  keyword2 = 'Sian17', 
  keyword3 = 'CREATOR' 
}: ScrollFillTextProps) {
  const container = useRef<HTMLDivElement>(null)
  const fg1 = useRef<HTMLSpanElement>(null)
  const fg2 = useRef<HTMLSpanElement>(null)
  const fg3 = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!container.current || !fg1.current || !fg2.current || !fg3.current) return

    // 모션 최소화 사용자: 핀/스크럽/블러 퇴장 없이 채워진 정지 상태만 보여준다
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fills = [fg1.current, fg2.current, fg3.current] // 언마운트 시점엔 ref가 null일 수 있어 미리 캡처
      gsap.set(fills, { clipPath: 'inset(0 0% 0 0)' })
      return () => { gsap.set(fills, { clearProps: 'clipPath' }) }
    }

    // gsap.context(scope) — '.scroll-fill-text-line' 셀렉터를 이 컴포넌트 루트로 한정.
    // 전역 querySelector였다면 한 페이지에 인스턴스 2개가 뜰 때 서로의 라인까지 트윈해 간섭한다.
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container.current,
          start: 'center center', // Pin when the text reaches the center of the screen
          end: '+=150%', // Keep it pinned for 1.5x the viewport height
          scrub: 1.5, // Smooth scrubbing
          pin: true, // Fix the position while the animation plays
          anticipatePin: 1
        }
      })

      // Staggered fill effect from left to right using clip-path
      tl.fromTo(fg1.current, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'none', duration: 1 })
        .fromTo(fg2.current, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'none', duration: 1 }, '-=0.5')
        .fromTo(fg3.current, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'none', duration: 1 }, '-=0.5')

      // Cinematic Exit: After filling, the entire text scales up and fades out, revealing the next section
      tl.to('.scroll-fill-text-line', {
        scale: 1.5,
        opacity: 0,
        filter: 'blur(10px)',
        duration: 1.5,
        ease: 'power2.in',
        stagger: 0.1
      }, '+=0.5')
    }, container)

    // revert = 컨텍스트 안에서 만든 ScrollTrigger(핀 스페이서 포함)·트윈·인라인 스타일 전부 회수
    return () => ctx.revert()
  }, [])

  return (
    <div ref={container} className="relative w-full h-screen bg-white flex flex-col justify-center items-center gap-1 select-none pointer-events-none px-4 overflow-hidden">
      <TextLine text={keyword1} fgRef={fg1} />
      <TextLine text={keyword2} fgRef={fg2} />
      <TextLine text={keyword3} fgRef={fg3} />
    </div>
  )
}

function TextLine({ text, fgRef }: { text: string, fgRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="scroll-fill-text-line relative text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[10rem] font-black tracking-tighter uppercase leading-[0.85] text-center w-full break-words">
      {/* Background Layer: Outline (Stroke) Only */}
      <span 
        className="text-transparent" 
        style={{ WebkitTextStroke: '2px #d4d4d8' }} // neutral-300
      >
        {text}
      </span>
      
      {/* Foreground Layer: Solid Fill with Mask */}
      <span 
        ref={fgRef}
        className="absolute top-0 left-0 w-full h-full text-neutral-900 pointer-events-none flex justify-center"
        style={{ clipPath: 'inset(0 100% 0 0)' }}
      >
        {text}
      </span>
    </div>
  )
}

'use client'

import React from 'react'
import Tooltip from '@/components/ui/Tooltip'

interface NextSectionButtonProps {
  isLast?: boolean
}

// Easing function for "bouncing ball" effect
function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75;
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375;
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
}

function scrollToTargetBounce(targetY: number, duration: number = 1200) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    
    // Apply bounce easing
    const easeProgress = easeOutBounce(progress);
    window.scrollTo(0, startY + distance * easeProgress);

    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  }
  requestAnimationFrame(animation);
}

export default function NextSectionButton({ isLast = false }: NextSectionButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()

    if (isLast) {
      scrollToTargetBounce(0, 1500)
      return
    }
    
    // Find all potential targets
    const selectors = '#portfolio-start, [id^="section-"], #contact'
    const targets = Array.from(document.querySelectorAll(selectors)) as HTMLElement[]
    
    // Find the first target whose top is significantly below the current scroll position
    const nextTarget = targets.find(el => {
      const rect = el.getBoundingClientRect()
      return rect.top > 100
    })

    if (nextTarget) {
      const absoluteTop = window.scrollY + nextTarget.getBoundingClientRect().top
      scrollToTargetBounce(absoluteTop - 50, 1200) // Scroll to element with 50px offset
    } else {
      // Fallback
      scrollToTargetBounce(window.scrollY + window.innerHeight * 0.8, 1200)
    }
  }

  return (
    <Tooltip text={isLast ? "처음으로 올라가기" : "다음 섹션으로 이동"} position="top">
      <button 
        onClick={handleClick}
        className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-neutral-400 hover:text-neutral-600 hover:shadow-xl transition-all animate-bounce cursor-pointer border border-neutral-100"
      >
        {isLast ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        )}
      </button>
    </Tooltip>
  )
}

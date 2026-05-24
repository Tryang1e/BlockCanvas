'use client'

import React, { useEffect, useState, useRef } from 'react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import Tooltip from '@/components/ui/Tooltip'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollToPlugin)
}

export default function JumpingScrollButton() {
  const [isAtBottom, setIsAtBottom] = useState(false)
  const isAnimating = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const idleTween = useRef<gsap.core.Tween | null>(null)

  const getBoundaries = () => {
    const parent = document.getElementById('content-wrapper')
    if (!parent) return []

    const parentRect = parent.getBoundingClientRect()
    const parentTop = parentRect.top + window.scrollY

    const boundaries = []

    // 1. Start boundary (Bottom of hero / top of content-wrapper)
    boundaries.push({
      id: 'start',
      buttonTop: -24, // Sits right on the line
      scrollY: 0,
      isLast: false
    })

    // 2. Portfolio sections
    const sections = Array.from(document.querySelectorAll('[id^="section-"]')) as HTMLElement[]
    sections.forEach(sec => {
      const secAbsoluteTop = sec.getBoundingClientRect().top + window.scrollY
      const secAbsoluteBottom = sec.getBoundingClientRect().bottom + window.scrollY
      
      boundaries.push({
        id: sec.id,
        buttonTop: secAbsoluteBottom - parentTop - 24,
        scrollY: Math.max(0, secAbsoluteTop - 100),
        isLast: false
      })
    })

    // 3. Contact section
    const contact = document.getElementById('contact')
    if (contact) {
      const contactAbsoluteTop = contact.getBoundingClientRect().top + window.scrollY
      const contactAbsoluteBottom = contact.getBoundingClientRect().bottom + window.scrollY
      
      boundaries.push({
        id: 'contact',
        buttonTop: contactAbsoluteBottom - parentTop - 80,
        scrollY: Math.max(0, contactAbsoluteTop - 100),
        isLast: true
      })
    }

    return boundaries.sort((a, b) => a.buttonTop - b.buttonTop)
  }

  const startIdleBounce = () => {
    if (!buttonRef.current || isAtBottom) return;
    idleTween.current?.kill()
    // Using y for idle bounce is hardware accelerated and smoother than animating top
    idleTween.current = gsap.to(buttonRef.current, {
      y: -15, 
      duration: 0.6,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    })
  }

  const stopIdleBounce = () => {
    idleTween.current?.kill()
    gsap.set(buttonRef.current, { y: 0 }) // Reset y transform
  }

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      if (isAnimating.current) return
      
      clearTimeout(scrollTimeout)
      
      // Wait for user to stop scrolling for 200ms before auto-dropping the button
      scrollTimeout = setTimeout(() => {
        if (!buttonRef.current || isAnimating.current) return

        const boundaries = getBoundaries()
        const currentScroll = window.scrollY
        
        // Find which section is currently active in the viewport
        // We use currentScroll + window.innerHeight/2 to find what's in the middle of the screen
        const activeBoundary = boundaries.slice().reverse().find(b => b.scrollY <= currentScroll + window.innerHeight / 3) || boundaries[0]
        
        // We just track if we are at the bottom or not
        const isCurrentlyAtBottom = activeBoundary.isLast
        setIsAtBottom(isCurrentlyAtBottom)
        
        if (!isCurrentlyAtBottom) {
          startIdleBounce()
        } else {
          stopIdleBounce()
        }
      }, 200)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    // Initial placement
    handleScroll()
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isAnimating.current || !buttonRef.current) return

    const boundaries = getBoundaries()
    if (boundaries.length === 0) return

    let targetBoundary;

    if (isAtBottom) {
      targetBoundary = boundaries[0]
    } else {
      // Find the next boundary that is below the current scroll
      targetBoundary = boundaries.find(b => b.scrollY > window.scrollY + 50)
      if (!targetBoundary) {
        targetBoundary = boundaries[boundaries.length - 1]
      }
    }

    isAnimating.current = true
    stopIdleBounce()

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating.current = false
        setIsAtBottom(targetBoundary.isLast)
        if (!targetBoundary.isLast) {
          startIdleBounce()
        }
      }
    })

    if (isAtBottom) {
      // Going UP to top
      tl.to(window, { 
        scrollTo: targetBoundary.scrollY, 
        duration: 1.2, 
        ease: "power3.inOut" 
      })
    } else {
      // Going DOWN
      tl.to(window, { 
        scrollTo: targetBoundary.scrollY, 
        duration: 0.8, 
        ease: "power3.inOut" 
      })
    }
  }

  return (
    <Tooltip text={isAtBottom ? "처음으로 올라가기" : "다음 섹션으로 이동"} position="top">
      <button 
        ref={buttonRef}
        onClick={handleClick}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-14 h-14 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.15)] border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 cursor-pointer transition-colors"
      >
        {isAtBottom ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        )}
      </button>
    </Tooltip>
  )
}

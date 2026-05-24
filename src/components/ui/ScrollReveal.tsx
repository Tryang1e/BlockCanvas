'use client'

import React, { useEffect, useRef, useState } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  animationClass?: string
  delay?: number
  disableAnimation?: boolean
}

export default function ScrollReveal({ 
  children, 
  className = '', 
  animationClass = 'opacity-0 translate-y-12 scale-95', 
  delay = 0,
  disableAnimation = false
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setInView(true)
          }, delay)
          if (ref.current) {
            observer.unobserve(ref.current)
          }
        }
      },
      {
        root: null,
        rootMargin: '50px',
        threshold: 0.1,
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current)
    }
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-[1200ms] transform ${
        disableAnimation || inView ? 'opacity-100 translate-y-0 translate-x-0 scale-100' : animationClass
      } ${disableAnimation ? '!duration-0' : ''} ${className}`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' // Premium spring ease
      }}
    >
      {children}
    </div>
  )
}

'use client'

import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface MagneticEffectProps {
  children: React.ReactNode
  strength?: number
  className?: string
}

export default function MagneticEffect({ children, strength = 20, className = '' }: MagneticEffectProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Elastic ease provides that premium bouncy 'magnetic snap' feeling
    const xTo = gsap.quickTo(el, 'x', { duration: 1, ease: 'elastic.out(1, 0.3)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 1, ease: 'elastic.out(1, 0.3)' })

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      const { width, height, left, top } = el.getBoundingClientRect()
      
      const centerX = left + width / 2
      const centerY = top + height / 2

      // Calculate relative position (-1 to 1 based on boundaries)
      const moveX = ((clientX - centerX) / (width / 2)) * strength
      const moveY = ((clientY - centerY) / (height / 2)) * strength

      xTo(moveX)
      yTo(moveY)
    }

    const handleMouseLeave = () => {
      // Snap perfectly back to center
      xTo(0)
      yTo(0)
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [strength])

  return (
    <div ref={ref} className={`magnetic inline-block relative ${className}`}>
      {children}
    </div>
  )
}

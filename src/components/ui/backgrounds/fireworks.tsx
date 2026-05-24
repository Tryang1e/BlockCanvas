'use client'

import React, { useEffect, useRef } from 'react'

export default function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    canvas.width = width
    canvas.height = height

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      color: string
      alpha: number
      decay: number

      constructor(x: number, y: number, color: string) {
        this.x = x
        this.y = y
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 5 + 2
        this.vx = Math.cos(angle) * speed
        this.vy = Math.sin(angle) * speed
        this.radius = Math.random() * 2 + 1
        this.color = color
        this.alpha = 1
        this.decay = Math.random() * 0.015 + 0.015
      }

      update() {
        this.vy += 0.05 // Gravity
        this.vx *= 0.99 // Friction
        this.vy *= 0.99
        this.x += this.vx
        this.y += this.vy
        this.alpha -= this.decay
      }

      draw() {
        if (!ctx) return
        ctx.save()
        ctx.globalAlpha = this.alpha
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.fillStyle = this.color
        ctx.fill()
        ctx.restore()
      }
    }

    let particles: Particle[] = []
    const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffffff']

    const createFirework = (x: number, y: number) => {
      const color = colors[Math.floor(Math.random() * colors.length)]
      const particleCount = 60 + Math.random() * 40
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(x, y, color))
      }
    }

    let animationId: number
    let frame = 0

    const animate = () => {
      if (!ctx) return
      // Create trailing effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, width, height)

      // Randomly spawn fireworks
      if (frame % 60 === 0 && Math.random() < 0.5) {
        createFirework(
          Math.random() * width,
          Math.random() * height * 0.6 // Spawn mostly in the upper part
        )
      }
      
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update()
        particles[i].draw()
        if (particles[i].alpha <= 0) {
          particles.splice(i, 1)
        }
      }
      
      frame++
      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-[-1] w-full h-full mix-blend-screen"
    />
  )
}

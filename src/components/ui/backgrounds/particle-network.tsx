'use client'

import React, { useEffect, useRef } from 'react'

export default function ParticleNetwork() {
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

    let particles: Particle[] = []
    const particleCount = Math.min(100, Math.floor((width * height) / 10000))
    const mouse = { x: -1000, y: -1000 }

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number

      constructor() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 1.5
        this.vy = (Math.random() - 0.5) * 1.5
        this.radius = Math.random() * 2 + 1
      }

      update() {
        this.x += this.vx
        this.y += this.vy

        // Bounce off walls
        if (this.x < 0 || this.x > width) this.vx *= -1
        if (this.y < 0 || this.y > height) this.vy *= -1

        // Mouse repel interaction
        const dx = mouse.x - this.x
        const dy = mouse.y - this.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 100) {
          this.x -= dx * 0.05
          this.y -= dy * 0.05
        }
      }

      draw() {
        if (!ctx) return
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.fill()
      }
    }

    const init = () => {
      particles = []
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle())
      }
    }

    const animate = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      
      for (let i = 0; i < particles.length; i++) {
        particles[i].update()
        particles[i].draw()
        
        // Draw lines
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - distance / 120})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      animationId = requestAnimationFrame(animate)
    }

    let animationId: number
    init()
    animate()

    const handleResize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
      init()
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    const handleMouseLeave = () => {
      mouse.x = -1000
      mouse.y = -1000
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-[-1] w-full h-full"
    />
  )
}

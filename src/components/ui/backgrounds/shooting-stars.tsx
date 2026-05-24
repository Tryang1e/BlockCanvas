'use client'

import React, { useEffect, useRef } from 'react'

export default function ShootingStars() {
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

    // Static Stars
    const staticStars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random()
    }))

    class ShootingStar {
      x: number
      y: number
      length: number
      speed: number
      opacity: number
      angle: number
      dead: boolean

      constructor() {
        this.x = Math.random() * width
        this.y = 0
        this.length = Math.random() * 80 + 20
        this.speed = Math.random() * 15 + 10
        this.opacity = 1
        this.angle = Math.PI / 4 // 45 degrees
        this.dead = false
      }

      update() {
        this.x -= Math.cos(this.angle) * this.speed
        this.y += Math.sin(this.angle) * this.speed
        this.opacity -= 0.015

        if (this.opacity <= 0 || this.y > height || this.x < 0) {
          this.dead = true
        }
      }

      draw() {
        if (!ctx) return
        ctx.save()
        ctx.beginPath()
        
        const gradient = ctx.createLinearGradient(
          this.x, this.y, 
          this.x + Math.cos(this.angle) * this.length, 
          this.y - Math.sin(this.angle) * this.length
        )
        gradient.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(
          this.x + Math.cos(this.angle) * this.length,
          this.y - Math.sin(this.angle) * this.length
        )
        ctx.stroke()
        ctx.restore()
      }
    }

    let shootingStars: ShootingStar[] = []
    let animationId: number
    let frame = 0

    const animate = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      
      // Draw static stars
      staticStars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * (0.5 + Math.sin(frame * 0.05 + star.x) * 0.5)})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      })

      // Spawn shooting stars randomly
      if (Math.random() < 0.03) {
        shootingStars.push(new ShootingStar())
      }

      // Update & draw shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        shootingStars[i].update()
        shootingStars[i].draw()
        if (shootingStars[i].dead) {
          shootingStars.splice(i, 1)
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

'use client'

import React, { useEffect, useRef } from 'react'

export default function GravityStars() {
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

    let stars: Star[] = []
    const numStars = 400
    const mouse = { x: width / 2, y: height / 2 }
    const center = { x: width / 2, y: height / 2 }

    class Star {
      x: number
      y: number
      z: number
      pz: number

      constructor() {
        this.x = (Math.random() - 0.5) * width * 2
        this.y = (Math.random() - 0.5) * height * 2
        this.z = Math.random() * width
        this.pz = this.z
      }

      update(speed: number) {
        this.z -= speed
        if (this.z < 1) {
          this.z = width
          this.x = (Math.random() - 0.5) * width * 2
          this.y = (Math.random() - 0.5) * height * 2
          this.pz = this.z
        }
      }

      draw() {
        if (!ctx) return
        
        // Offset based on mouse distance from center to create parallax
        const dx = (mouse.x - center.x) * 0.05
        const dy = (mouse.y - center.y) * 0.05

        const sx = ((this.x - dx) / this.z) * width + center.x
        const sy = ((this.y - dy) / this.z) * height + center.y
        const r = Math.max(0.1, (1.5 - this.z / width) * 2)

        const px = ((this.x - dx) / this.pz) * width + center.x
        const py = ((this.y - dy) / this.pz) * height + center.y
        this.pz = this.z

        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(sx, sy)
        ctx.lineWidth = r
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - this.z / width})`
        ctx.stroke()
      }
    }

    const init = () => {
      stars = []
      for (let i = 0; i < numStars; i++) {
        stars.push(new Star())
      }
    }

    const animate = () => {
      if (!ctx) return
      // Create a trail effect by not fully clearing the canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.fillRect(0, 0, width, height)
      
      const distFromCenter = Math.sqrt(Math.pow(mouse.x - center.x, 2) + Math.pow(mouse.y - center.y, 2))
      const speed = 2 + (distFromCenter / width) * 15

      for (let i = 0; i < stars.length; i++) {
        stars[i].update(speed)
        stars[i].draw()
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
      center.x = width / 2
      center.y = height / 2
      init()
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-[-1] w-full h-full mix-blend-screen"
    />
  )
}

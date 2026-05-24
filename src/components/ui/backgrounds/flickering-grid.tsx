'use client'

import React, { useEffect, useRef } from 'react'

export default function FlickeringGrid() {
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

    const gridSize = 40
    let cols = Math.floor(width / gridSize) + 1
    let rows = Math.floor(height / gridSize) + 1

    class GridBlock {
      x: number
      y: number
      opacity: number
      targetOpacity: number
      changeRate: number

      constructor(x: number, y: number) {
        this.x = x
        this.y = y
        this.opacity = Math.random() * 0.15
        this.targetOpacity = Math.random() * 0.15
        this.changeRate = 0.001 + Math.random() * 0.005
      }

      update() {
        if (Math.abs(this.targetOpacity - this.opacity) < this.changeRate) {
          this.targetOpacity = Math.random() * 0.15
          this.changeRate = 0.001 + Math.random() * 0.005
        }
        
        if (this.opacity < this.targetOpacity) {
          this.opacity += this.changeRate
        } else {
          this.opacity -= this.changeRate
        }
      }

      draw() {
        if (!ctx) return
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`
        ctx.fillRect(this.x * gridSize, this.y * gridSize, gridSize - 1, gridSize - 1)
      }
    }

    let blocks: GridBlock[] = []

    const init = () => {
      blocks = []
      cols = Math.floor(width / gridSize) + 1
      rows = Math.floor(height / gridSize) + 1
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (Math.random() > 0.4) {
            blocks.push(new GridBlock(i, j))
          }
        }
      }
    }

    let animationId: number

    const animate = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      
      for (let i = 0; i < blocks.length; i++) {
        blocks[i].update()
        blocks[i].draw()
      }
      
      animationId = requestAnimationFrame(animate)
    }

    init()
    animate()

    const handleResize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
      init()
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
      className="fixed inset-0 pointer-events-none z-[-1] w-full h-full mix-blend-overlay"
    />
  )
}

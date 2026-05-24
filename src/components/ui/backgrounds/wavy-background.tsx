'use client'

import React, { useEffect, useRef } from 'react'

export default function WavyBackground() {
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

    let animationId: number
    let time = 0

    const drawWaves = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      
      const lines = 5
      const waveHeight = height * 0.15
      
      for (let i = 0; i < lines; i++) {
        ctx.beginPath()
        ctx.lineWidth = 2
        // Glowing stroke
        ctx.strokeStyle = `hsla(${210 + i * 15}, 80%, 60%, ${0.5 - i * 0.1})`
        
        for (let x = 0; x < width; x += 5) {
          const y = height / 2 
            + Math.sin(x * 0.005 + time + i) * waveHeight 
            + Math.sin(x * 0.002 - time * 0.5) * (waveHeight * 0.5)
            + i * 30 // offset each line vertically
          
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      }
      
      time += 0.01
      animationId = requestAnimationFrame(drawWaves)
    }

    drawWaves()

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
      className="fixed inset-0 pointer-events-none z-[-1] w-full h-full mix-blend-screen opacity-50"
    />
  )
}

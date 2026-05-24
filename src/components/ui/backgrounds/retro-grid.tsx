'use client'

import React from 'react'

export default function RetroGrid() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
      <style>{`
        .retro-grid-container {
          position: absolute;
          inset: 0;
          perspective: 1000px;
          overflow: hidden;
        }

        .retro-grid {
          position: absolute;
          width: 300%;
          height: 300%;
          left: -100%;
          top: -50%;
          background-image: 
            linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          transform: rotateX(60deg) translateY(-100px) translateZ(-200px);
          animation: retroScroll 12s linear infinite;
        }

        @keyframes retroScroll {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 0 60px;
          }
        }

        .retro-grid-fade {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, transparent 20%, #FAF9F5 90%);
        }
      `}</style>
      
      <div className="retro-grid-container">
        <div className="retro-grid" />
        <div className="retro-grid-fade" />
      </div>
    </div>
  )
}

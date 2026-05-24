import React from 'react'

export default function MovingGrid() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] ">
      <style>{`
        @keyframes scrollGrid {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-40px, -40px);
          }
        }
        .grid-bg {
          position: absolute;
          width: calc(100% + 80px);
          height: calc(100% + 80px);
          top: 0;
          left: 0;
          background-size: 40px 40px;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          animation: scrollGrid 3s linear infinite;
        }
      `}</style>
      
      <div className="grid-bg" />
      {/* Subtle radial gradient overlay to fade edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#111111_80%)]" />
    </div>
  )
}

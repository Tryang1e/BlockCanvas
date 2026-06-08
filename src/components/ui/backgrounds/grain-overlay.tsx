'use client'

import React from 'react'

// 필름 그레인(노이즈) 오버레이: SVG feTurbulence 텍스처를 미세하게 떨리게 해서
// 고급스러운 질감을 더한다. 순수 CSS/SVG, JS 없음 → 가볍고 예측 가능.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export default function GrainOverlay() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes bc-grain {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6%, -4%); }
          40% { transform: translate(4%, -7%); }
          60% { transform: translate(-5%, 5%); }
          80% { transform: translate(7%, 2%); }
        }
      `}</style>
      <div
        className="absolute"
        style={{
          inset: '-50%',
          width: '200%',
          height: '200%',
          backgroundImage: NOISE,
          opacity: 0.07,
          mixBlendMode: 'overlay',
          animation: 'bc-grain 0.7s steps(3) infinite',
        }}
      />
    </div>
  )
}

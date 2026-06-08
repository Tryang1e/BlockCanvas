'use client'

import React from 'react'

// 순수 CSS 메시 그라데이션: 크고 부드러운 색 blob들이 천천히 떠다닌다.
// 캔버스/requestAnimationFrame 없이 CSS 애니메이션만 사용 → 가볍고 예측 가능.
export default function MeshGradient() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes bc-mesh-1 {
          0%, 100% { transform: translate(-12%, -10%) scale(1); }
          33% { transform: translate(18%, 8%) scale(1.25); }
          66% { transform: translate(-6%, 16%) scale(0.9); }
        }
        @keyframes bc-mesh-2 {
          0%, 100% { transform: translate(10%, 18%) scale(1.1); }
          50% { transform: translate(-16%, -12%) scale(1.35); }
        }
        @keyframes bc-mesh-3 {
          0%, 100% { transform: translate(16%, -16%) scale(1); }
          50% { transform: translate(-10%, 20%) scale(1.2); }
        }
      `}</style>
      <div
        className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'bc-mesh-1 18s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-[10%] -right-[10%] w-[55vw] h-[55vw] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'bc-mesh-2 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-[50vw] h-[50vw] rounded-full opacity-35"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
          filter: 'blur(90px)',
          animation: 'bc-mesh-3 20s ease-in-out infinite',
        }}
      />
    </div>
  )
}

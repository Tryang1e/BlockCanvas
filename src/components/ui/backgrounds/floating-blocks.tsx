import React from 'react'

export default function FloatingBlocks() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] ">
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(120vh) rotate(0deg) scale(0.8);
            opacity: 0;
          }
          15% {
            opacity: 0.15;
          }
          75% {
            opacity: 0.15;
          }
          100% {
            transform: translateY(-30vh) rotate(360deg) scale(1.2);
            opacity: 0;
          }
        }
        .block-animate {
          animation: floatUp linear infinite;
        }
      `}</style>
      
      {/* Generate 15 blocks with deterministic pseudo-random properties to prevent hydration mismatch */}
      {[...Array(15)].map((_, i) => {
        // Deterministic pseudo-random number generator [0, 1) based on index
        const random = (seed: number) => {
          const x = Math.sin(seed * 99.99) * 10000;
          return x - Math.floor(x);
        };
        
        const size = 40 + random(i + 1) * 80;
        const left = random(i + 2) * 100;
        // Use a negative delay so the blocks are already spread out on the screen immediately upon load
        const delay = -(random(i + 3) * 50);
        const duration = 15 + random(i + 4) * 25;
        
        return (
          <div
            key={i}
            className="absolute bg-white rounded-2xl block-animate opacity-0"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              boxShadow: '0 8px 32px rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          />
        )
      })}
    </div>
  )
}

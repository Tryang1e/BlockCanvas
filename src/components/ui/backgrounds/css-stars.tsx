import React from 'react'

export default function CssStars() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] ">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 8px 2px rgba(255,255,255,0.4); }
        }
        .star-animate {
          animation: twinkle ease-in-out infinite;
        }
      `}</style>
      
      {/* Generate ~50 stars with deterministic pseudo-random properties */}
      {[...Array(50)].map((_, i) => {
        const random = (seed: number) => {
          const x = Math.sin(seed * 99.99) * 10000;
          return x - Math.floor(x);
        };

        const randSize = random(i + 1);
        const size = randSize < 0.1 ? 3 : randSize < 0.5 ? 2 : 1;
        const left = random(i + 2) * 100;
        const top = random(i + 3) * 100;
        const delay = random(i + 4) * 5;
        const duration = 2 + random(i + 5) * 4;
        
        return (
          <div
            key={i}
            className="absolute bg-white rounded-full star-animate"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        )
      })}
    </div>
  )
}

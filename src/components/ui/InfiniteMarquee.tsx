'use client'

import React from 'react'

interface InfiniteMarqueeProps {
  children: React.ReactNode;
  speed?: number; // duration in seconds
  reverse?: boolean;
}

export default function InfiniteMarquee({ children, speed = 25, reverse = false }: InfiniteMarqueeProps) {
  return (
    <div className="w-full overflow-hidden relative select-none py-4">
      {/* Gradients to fade out edges for premium look */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: ${reverse ? 'marquee-reverse' : 'marquee'} ${speed}s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="marquee-track gap-6">
        {/* Render children twice to ensure seamless infinite looping */}
        <div className="flex gap-6 flex-shrink-0">
          {children}
        </div>
        <div className="flex gap-6 flex-shrink-0" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}

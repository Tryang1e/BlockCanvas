'use client'

import React from 'react'

interface InfiniteMarqueeProps {
  children: React.ReactNode;
  speed?: number; // duration in seconds
  reverse?: boolean;
  fadeColor?: string; // Tailwind class e.g. "from-[#FAF9F5]"
  fadeVia?: string; // Tailwind class e.g. "via-[#FAF9F5]/80"
}

export default function InfiniteMarquee({
  children,
  speed = 25,
  reverse = false,
  fadeColor = 'from-[#FAF9F5]',
  fadeVia = 'via-[#FAF9F5]/70'
}: InfiniteMarqueeProps) {
  // If the number of items is small, repeat them to guarantee the marquee track width exceeds any screen size (minimum 8 items)
  const childrenArray = React.Children.toArray(children)
  const minItems = 8
  const repeatCount = Math.max(1, Math.ceil(minItems / childrenArray.length))
  const repeatedChildren = []
  
  for (let i = 0; i < repeatCount; i++) {
    repeatedChildren.push(...childrenArray)
  }

  return (
    <div className="w-full overflow-hidden relative select-none py-4">
      {/* Dynamic gradients to fade out edges seamlessly with the platform's background */}
      <div className={`absolute left-0 top-0 bottom-0 w-28 bg-gradient-to-r ${fadeColor} ${fadeVia} to-transparent z-10 pointer-events-none`} />
      <div className={`absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l ${fadeColor} ${fadeVia} to-transparent z-10 pointer-events-none`} />

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

      <div className="marquee-track">
        {/* Render repeated children twice to ensure seamless infinite looping */}
        <div className="flex gap-6 pr-6 flex-shrink-0">
          {repeatedChildren.map((child, idx) => (
            <React.Fragment key={idx}>{child}</React.Fragment>
          ))}
        </div>
        <div className="flex gap-6 pr-6 flex-shrink-0" aria-hidden="true">
          {repeatedChildren.map((child, idx) => (
            <React.Fragment key={`clone-${idx}`}>{child}</React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
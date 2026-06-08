'use client'

import React from 'react'

interface InfiniteMarqueeProps {
  children: React.ReactNode;
  speed?: number; // duration in seconds
  reverse?: boolean;
  fadeColor?: string; // Tailwind class e.g. "from-[#FAF9F5]"
  fadeVia?: string; // Tailwind class e.g. "via-[#FAF9F5]/80"
  maskFade?: boolean; // 배경색에 무관한 마스크 기반 가장자리 페이드 (켜면 fadeColor/fadeVia 무시)
}

export default function InfiniteMarquee({
  children,
  speed = 25,
  reverse = false,
  fadeColor = 'from-[#FAF9F5]',
  fadeVia = 'via-[#FAF9F5]/70',
  maskFade = false,
}: InfiniteMarqueeProps) {
  // 한 페이지에 여러 마퀴가 서로 다른 속도로 공존해도 충돌하지 않도록 인스턴스마다 고유 스코프를 부여한다.
  // (useId 결과의 콜론 등 CSS에서 무효한 문자는 제거)
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const animName = `bcMarquee${uid}`
  const trackClass = `marquee-track-${uid}`

  // If the number of items is small, repeat them to guarantee the marquee track width exceeds any screen size (minimum 8 items)
  const childrenArray = React.Children.toArray(children)
  const minItems = 8
  const repeatCount = Math.max(1, Math.ceil(minItems / Math.max(1, childrenArray.length)))
  const repeatedChildren: React.ReactNode[] = []

  for (let i = 0; i < repeatCount; i++) {
    repeatedChildren.push(...childrenArray)
  }

  const maskStyle: React.CSSProperties = maskFade
    ? {
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        maskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
      }
    : {}

  return (
    <div className="w-full overflow-hidden relative select-none py-4" style={maskStyle}>
      {/* Dynamic gradients to fade out edges seamlessly with the platform's background */}
      {!maskFade && (
        <>
          <div className={`absolute left-0 top-0 bottom-0 w-28 bg-gradient-to-r ${fadeColor} ${fadeVia} to-transparent z-10 pointer-events-none`} />
          <div className={`absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l ${fadeColor} ${fadeVia} to-transparent z-10 pointer-events-none`} />
        </>
      )}

      <style>{`
        @keyframes ${animName} {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ${animName}Reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .${trackClass} {
          display: flex;
          width: max-content;
          animation: ${reverse ? `${animName}Reverse` : animName} ${speed}s linear infinite;
        }
        .${trackClass}:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className={trackClass}>
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

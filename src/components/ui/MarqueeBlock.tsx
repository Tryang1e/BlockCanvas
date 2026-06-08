'use client'

import React from 'react'
import InfiniteMarquee from './InfiniteMarquee'

export interface MarqueeBlockProps {
  items: string[]
  speed?: number
  reverse?: boolean
  textSize?: string // e.g. '1.25rem'
  isBold?: boolean
  fontFamily?: string // 'inherit' 또는 CSS family 문자열
  textColor?: string // '' = 페이지 글자색 상속
  variant?: 'plain' | 'pill'
}

/**
 * 에디터 미리보기와 발행된 포트폴리오가 100% 동일하게 렌더되도록,
 * 마퀴(#6)의 실제 표시 로직을 한 곳에 모은 공용 컴포넌트.
 * 배경색에 의존하지 않도록 InfiniteMarquee의 maskFade(가장자리 마스크 페이드)를 사용한다.
 */
export default function MarqueeBlock({
  items,
  speed = 25,
  reverse = false,
  textSize = '1.25rem',
  isBold = true,
  fontFamily = 'inherit',
  textColor = '',
  variant = 'plain',
}: MarqueeBlockProps) {
  const safeItems = (Array.isArray(items) ? items : [])
    .map((s) => (s ?? '').toString())
    .filter((s) => s.trim().length > 0)

  if (safeItems.length === 0) return null

  const textStyle: React.CSSProperties = {
    fontSize: textSize,
    fontWeight: isBold ? 700 : 400,
    fontFamily: fontFamily && fontFamily !== 'inherit' ? fontFamily : undefined,
    color: textColor || undefined,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  }

  return (
    <InfiniteMarquee speed={speed} reverse={reverse} maskFade>
      {safeItems.map((item, i) =>
        variant === 'pill' ? (
          <span
            key={i}
            className="inline-flex items-center px-5 py-2 rounded-full border border-neutral-400/40"
            style={textStyle}
          >
            {item}
          </span>
        ) : (
          <span key={i} className="inline-flex items-center" style={textStyle}>
            <span aria-hidden className="opacity-30 mr-6 font-normal">•</span>
            {item}
          </span>
        )
      )}
    </InfiniteMarquee>
  )
}

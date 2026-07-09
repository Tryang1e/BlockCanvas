'use client'

// ── 픽셀 블러업 이미지 ──────────────────────────────────────────────────────
// 카드 썸네일용 드롭인 이미지: 서버가 동봉한 16px 플레이스홀더(blurDataURL)를
// imageRendering:'pixelated' 로 늘려 "청크 로딩" 모자이크를 먼저 깔고, 원본이
// 로드되면 ~220ms 페이드인. 플레이스홀더가 없으면 .bc-skeleton 블록셀 심머로 폴백.
//
//  • fill 레이아웃 전용(포지셔닝된 부모 안에서 absolute inset-0 레이어 구성).
//  • 페이드는 이미지가 아니라 래퍼 div 에 건다 — 콜사이트의 hover scale 등
//    transition-transform 클래스와 인라인 transition 이 충돌하지 않게 하기 위함.
//  • 모션 최소화: globals.css 의 prefers-reduced-motion 전역 규칙(!important)이
//    인라인 transition-duration 을 0.001ms 로 눌러 사실상 즉시 표시된다.

import React, { useCallback, useState } from 'react'
import Image from 'next/image'

interface BlockImageProps {
  src: string
  alt: string
  /** 서버(lib/blurPlaceholder)가 생성한 16px data URI. 없으면 스켈레톤 폴백. */
  blurDataURL?: string | null
  /** true 면 next/image(fill) 로 렌더 — 기존 next/image 콜사이트 유지용. 기본은 순수 <img>. */
  nextImage?: boolean
  /** 실제 이미지 엘리먼트에 그대로 전달되는 클래스(object-cover, hover scale 등). */
  className?: string
  sizes?: string
  draggable?: boolean
  loading?: 'lazy' | 'eager'
}

export default function BlockImage({
  src,
  alt,
  blurDataURL,
  nextImage = false,
  className = '',
  sizes,
  draggable,
  loading,
}: BlockImageProps) {
  const [loaded, setLoaded] = useState(false)
  // 로드 실패(404·파일 소실)도 loaded 처리 — 아니면 스켈레톤이 영원히 깜빡이며 '로딩 중'으로 위장된다.
  // 페이드인되며 브라우저 기본 깨진 이미지/alt 가 드러나는 쪽이 정직한 상태 표시.
  const handleLoad = useCallback(() => setLoaded(true), [])
  // 캐시된 이미지는 hydration 시점에 이미 complete 라 onLoad 가 안 올 수 있다 → ref 에서 즉시 판정.
  // (next/image 는 내부적으로 complete 를 검사해 onLoad 를 보장하므로 순수 <img> 경로에만 필요)
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    // complete 이면 성공(naturalWidth>0)이든 실패든 판정 끝 — 실패도 위와 같은 이유로 드러낸다
    if (el && el.complete) setLoaded(true)
  }, [])

  return (
    <>
      {/* 플레이스홀더 레이어 — 픽셀 모자이크 또는 블록셀 스켈레톤.
          모자이크는 로드 완료 시 크로스페이드로 걷어낸다: 투명 배경 커버(블루프린트 추출 썸네일 등)는
          원본이 위에 떠도 빈 영역으로 모자이크가 계속 비쳐 지저분해 보이기 때문 */}
      {blurDataURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ imageRendering: 'pixelated', opacity: loaded ? 0 : 1, transition: 'opacity 220ms ease-out' }}
        />
      ) : !loaded ? (
        <div aria-hidden="true" className="absolute inset-0 bc-skeleton" />
      ) : null}

      {/* 원본 레이어 — 로드 완료 시 페이드인(래퍼가 페이드를 전담) */}
      <div
        className="absolute inset-0"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 220ms ease-out' }}
      >
        {nextImage ? (
          <Image src={src} alt={alt} fill sizes={sizes} className={className} onLoad={handleLoad} onError={handleLoad} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={className}
            draggable={draggable}
            loading={loading}
            onLoad={handleLoad}
            onError={handleLoad}
          />
        )}
      </div>
    </>
  )
}

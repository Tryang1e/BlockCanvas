'use client'

import React from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Draggable, InertiaPlugin)
}

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
  const containerRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const firstHalfRef = React.useRef<HTMLDivElement>(null)
  // 위치 단일 소스(px, 좌측 이동 = 음수). 오토스크롤·드래그·스로우가 전부 이 값 하나만 움직인다.
  // ref 라서 speed/reverse 변경으로 이펙트가 재실행돼도 흐르던 위치가 유지된다.
  const posRef = React.useRef(0)
  // prefers-reduced-motion 이 라이브로 바뀌면 이펙트를 재구성 (기존 CSS 미디어쿼리 대응과 동일한 반응성)
  const [rmTick, setRmTick] = React.useState(0)

  // If the number of items is small, repeat them to guarantee the marquee track width exceeds any screen size (minimum 8 items)
  const childrenArray = React.Children.toArray(children)
  const minItems = 8
  const repeatCount = Math.max(1, Math.ceil(minItems / Math.max(1, childrenArray.length)))
  const repeatedChildren: React.ReactNode[] = []

  for (let i = 0; i < repeatCount; i++) {
    repeatedChildren.push(...childrenArray)
  }

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setRmTick((t) => t + 1)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  React.useEffect(() => {
    const container = containerRef.current
    const track = trackRef.current
    const firstHalf = firstHalfRef.current
    if (!container || !track || !firstHalf) return

    // globals.css 전역 규칙이 기존 CSS keyframe 마퀴를 정지시켰으므로,
    // reduced-motion 에서는 오토스크롤 없음 + 관성/스큐 없는 플레인 드래그만 제공해 동일한 체감을 유지한다.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 반 폭(첫 번째 절반의 border-box 폭) — 이 구간을 넘어가면 위치를 되감아 무한루프
    let half = 0
    let wrapX = gsap.utils.wrap(-1, 0)
    const measure = () => {
      const w = parseFloat(window.getComputedStyle(firstHalf).width) || firstHalf.offsetWidth
      if (w > 0) {
        half = w
        wrapX = gsap.utils.wrap(-half, 0)
        posRef.current = wrapX(posRef.current)
      }
    }
    measure()

    const setX = gsap.quickSetter(track, 'x', 'px')
    const render = () => setX(wrapX(posRef.current))
    render()

    const dir = reverse ? 1 : -1
    const clampSkew = gsap.utils.clamp(-6, 6)

    let grabbed = false // press~스로우 정착까지 true → 오토스크롤 정지
    let skewActive = false // 드래그/스로우 중에만 속도 비례 스큐 적용
    let hovered = false // 기존 hover-pause(track:hover 정지) 동작 유지
    let lastPos = posRef.current
    let resumeCall: gsap.core.Tween | null = null
    let skewQuick: gsap.QuickToFunc | null = null
    // 재개 램프(0→1) — 관성이 0으로 감쇠한 직후 이진 스위치로 풀속도 점프하는 속도 계단 방지
    const resumeFactor = { value: 1 }

    const killSkew = () => gsap.killTweensOf(track, 'skewX')

    // 스로우 정착(또는 관성 없는 릴리즈) → 스큐 탄성 복귀 + 잠시 후 오토스크롤 재개(방향/속도 동일)
    const settle = () => {
      posRef.current = wrapX(posRef.current)
      skewActive = false
      if (!reduced) {
        killSkew()
        gsap.to(track, { skewX: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' })
      }
      resumeCall?.kill()
      resumeCall = gsap.delayedCall(0.35, () => {
        grabbed = false
        gsap.fromTo(resumeFactor, { value: 0 }, { value: 1, duration: 0.7, ease: 'power2.inOut', overwrite: 'auto' })
      })
    }

    // 표준 horizontalLoop 방식: 분리된 프록시에 Draggable을 걸고 그 x를 위치 소스로 매핑해
    // Draggable의 transform 쓰기와 wrap 렌더가 서로 싸우지 않게 한다.
    const proxy = document.createElement('div')
    const draggable = Draggable.create(proxy, {
      type: 'x',
      trigger: container,
      inertia: !reduced, // 던지면 자연 감쇠로 미끄러짐 (reduced-motion: 플레인 드래그)
      allowNativeTouchScrolling: true, // 터치 세로 스와이프는 페이지 스크롤로 통과
      dragClickables: true,
      minimumMovement: 4, // 카드 위 순수 클릭은 내비게이션 유지, 실제로 끌 때만 그랩
      cursor: 'grab',
      activeCursor: 'grabbing',
      onPressInit(this: Draggable) {
        grabbed = true
        skewActive = true
        resumeCall?.kill()
        gsap.killTweensOf(resumeFactor) // 램프 중 재그랩 시 잔여 트윈 정리
        if (!reduced) {
          // 이전 탄성 복귀 트윈과 충돌하지 않도록 정리 후 quickTo 재생성
          killSkew()
          skewQuick = gsap.quickTo(track, 'skewX', { duration: 0.35, ease: 'power3.out' })
        }
        // onPressInit은 시작 좌표 기록 전에 호출된다 — 프록시를 현재 트랙 위치에 동기화
        gsap.set(proxy, { x: posRef.current })
      },
      onDrag(this: Draggable) {
        posRef.current = this.x
        render()
      },
      onThrowUpdate(this: Draggable) {
        posRef.current = this.x
        render()
      },
      onRelease(this: Draggable) {
        // 실제 스로우가 시작됐으면 onThrowComplete에서 정착 처리
        if (!this.isThrowing) settle()
      },
      onThrowComplete: settle,
    })[0]

    // 오토스크롤 + 속도 비례 skewX 틱 — 위치 소스는 하나뿐이므로 CSS 애니메이션과 경쟁하지 않는다
    const tick = (_time: number, deltaMs: number) => {
      const dt = deltaMs / 1000
      if (!grabbed && !hovered && half > 0) {
        // 기존 CSS와 동일한 속도 의미: 반 폭(50%)을 speed초에 주파 (재개 직후엔 램프로 부드럽게 가속)
        posRef.current = wrapX(posRef.current + dir * (half / Math.max(1, speed)) * dt * resumeFactor.value)
      }
      if (skewActive && skewQuick && dt > 0) {
        const vel = (posRef.current - lastPos) / dt // px/s
        skewQuick(clampSkew(vel / -250))
      }
      lastPos = posRef.current
      render()
    }
    if (!reduced) gsap.ticker.add(tick)

    // 기존 hover-pause 유지 (마우스 포인터만 — 터치 탭이 마퀴를 영구 정지시키지 않도록)
    const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') hovered = true }
    const onLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse') hovered = false }
    if (!reduced) {
      container.addEventListener('pointerenter', onEnter)
      container.addEventListener('pointerleave', onLeave)
    }

    // 반응형 카드 폭/폰트 로딩으로 트랙 폭이 변하면 재측정 후 되감기 범위 갱신
    const ro = new ResizeObserver(() => {
      measure()
      render()
    })
    ro.observe(firstHalf)

    return () => {
      gsap.ticker.remove(tick)
      draggable.kill()
      ro.disconnect()
      resumeCall?.kill()
      gsap.killTweensOf(resumeFactor)
      container.removeEventListener('pointerenter', onEnter)
      container.removeEventListener('pointerleave', onLeave)
      gsap.killTweensOf(track)
      // 인라인 transform 잔류 청소 — 재실행 시 render()가 posRef로 즉시 복원한다
      gsap.set(track, { clearProps: 'transform' })
    }
  }, [speed, reverse, rmTick])

  const maskStyle: React.CSSProperties = maskFade
    ? {
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        maskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
      }
    : {}

  return (
    <div ref={containerRef} className="w-full overflow-hidden relative select-none py-4" style={maskStyle}>
      {/* Dynamic gradients to fade out edges seamlessly with the platform's background */}
      {!maskFade && (
        <>
          <div className={`absolute left-0 top-0 bottom-0 w-28 bg-gradient-to-r ${fadeColor} ${fadeVia} to-transparent z-10 pointer-events-none`} />
          <div className={`absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l ${fadeColor} ${fadeVia} to-transparent z-10 pointer-events-none`} />
        </>
      )}

      <div ref={trackRef} className="flex w-max will-change-transform">
        {/* Render repeated children twice to ensure seamless infinite looping */}
        <div ref={firstHalfRef} className="flex gap-6 pr-6 flex-shrink-0">
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

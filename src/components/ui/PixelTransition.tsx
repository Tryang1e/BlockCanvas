'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import gsap from 'gsap'

/**
 * BlockCanvas 블록 와이프 페이지 전환 (PixelDissolve의 풀스크린 내비게이션 판).
 *
 * - <PixelTransitionProvider>: 루트에 1회 마운트. fixed inset-0 블록 그리드 오버레이를 들고 있다가
 *   TransitionLink 클릭 시 커버(아랫줄부터 착착 점등, ~380ms) → router.push() → pathname 변경 감지 시
 *   리빌(윗줄부터 걷힘 = 커버의 역재생 방향)을 수행한다.
 * - <TransitionLink>: next/link 드롭인 대체. onNavigate(같은 오리진 SPA 내비게이션에서만 발화 —
 *   수정키 클릭/외부 URL/download는 Next가 알아서 제외)를 가로채 커버 후 push 한다.
 * - prefers-reduced-motion: 오버레이 없이 순정 Link 동작으로 강등.
 * - 안전장치: 내비게이션이 지연/실패해도 ~1.2s 후 강제 리빌, popstate(뒤로가기) 시 즉시 걷힘.
 */

const ROWS = 8
const COLS = 12
const CELL_COUNT = ROWS * COLS

// 커버/리빌 각각의 총 소요: duration + stagger amount ≈ 0.38s
const CELL_DURATION = 0.08
const STAGGER_AMOUNT = 0.3
// 커버 시작 후 이 시간 안에 pathname이 안 바뀌면 강제 리빌 (내비게이션 지연/실패 대비).
// /explore는 force-dynamic(DB 조회)이라 콜드 내비게이션이 커버(0.38s) 후 1초 안쪽을 넘기기 쉬움 → 여유 있게.
const SAFETY_TIMEOUT_MS = 2200

const INK = '#1E2022'
const ACCENT = '#FF424D'

// 결정적 악센트 셀 선정 (SSR/CSR 동일 결과 — Math.random 금지: hydration mismatch 방지)
function isAccentCell(i: number) {
  return (i * 31 + 7) % 23 === 0
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

type Phase = 'idle' | 'covering' | 'covered' | 'revealing'

type PixelTransitionContextValue = {
  /** 커버 애니메이션 후 router.push(href). 이미 전환 중이면 무시. */
  navigate: (href: string) => void
}

const PixelTransitionContext = createContext<PixelTransitionContextValue | null>(null)

export function PixelTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const overlayRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cells = useMemo(() => Array.from({ length: CELL_COUNT }), [])

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
  }, [])

  const setIdle = useCallback(() => {
    phaseRef.current = 'idle'
    if (overlayRef.current) overlayRef.current.style.pointerEvents = 'none'
  }, [])

  /** 즉시 걷어냄 (popstate / 안전 타임아웃): 트윈 킬 + 셀 소등 */
  const forceReveal = useCallback(() => {
    clearSafetyTimer()
    const overlay = overlayRef.current
    if (overlay) {
      const targets = overlay.children
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 0 })
    }
    setIdle()
  }, [clearSafetyTimer, setIdle])

  /** 정상 리빌: 윗줄부터 걷힘 (커버의 역방향) */
  const reveal = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) {
      setIdle()
      return
    }
    phaseRef.current = 'revealing'
    const targets = overlay.children
    gsap.killTweensOf(targets)
    gsap.to(targets, {
      opacity: 0,
      duration: CELL_DURATION,
      ease: 'steps(1)', // 블록은 서서히 사라지지 않는다 — 셀 단위 즉시 소등
      overwrite: 'auto',
      stagger: { amount: STAGGER_AMOUNT, grid: [ROWS, COLS], axis: 'y', from: 'start' },
      onComplete: setIdle,
    })
  }, [setIdle])

  const navigate = useCallback(
    (href: string) => {
      if (phaseRef.current !== 'idle') return

      // 같은 pathname으로의 이동(쿼리/해시만 다름)은 리빌 트리거(usePathname 변경)가 없다 → 커버 생략
      const targetPath = href.split(/[?#]/)[0] || '/'
      if (prefersReducedMotion() || targetPath === pathname || !overlayRef.current) {
        router.push(href)
        return
      }

      const overlay = overlayRef.current
      phaseRef.current = 'covering'
      overlay.style.pointerEvents = 'auto' // 커버 중 입력 차단

      // 안전장치: 내비게이션이 멈춰도 화면이 영영 덮여있지 않게.
      // 즉시 소등(forceReveal)이 아니라 동일한 블록 문법의 스태거 리빌로 걷는다 — 통짜 플래시 방지.
      clearSafetyTimer()
      safetyTimerRef.current = setTimeout(() => {
        if (phaseRef.current !== 'idle') {
          clearSafetyTimer()
          reveal()
        }
      }, SAFETY_TIMEOUT_MS)

      const targets = overlay.children
      gsap.killTweensOf(targets)
      gsap.to(targets, {
        opacity: 1,
        duration: CELL_DURATION,
        ease: 'steps(1)',
        overwrite: 'auto',
        // grid + axis:'y' + from:'end' = 맨 아랫줄부터 위로 착착 채움
        stagger: { amount: STAGGER_AMOUNT, grid: [ROWS, COLS], axis: 'y', from: 'end' },
        onComplete: () => {
          if (phaseRef.current !== 'covering') return // popstate 등으로 이미 해제됨
          phaseRef.current = 'covered'
          router.push(href)
        },
      })
    },
    [pathname, router, clearSafetyTimer, reveal]
  )

  // 도착 감지: pathname이 바뀌면 리빌
  useEffect(() => {
    if (phaseRef.current === 'covering' || phaseRef.current === 'covered') {
      clearSafetyTimer()
      reveal()
    }
    // pathname 변경 시에만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // 뒤로가기/앞으로가기: 커버 없이 즉시 걷음 (전환 중이었다면 강제 해제)
  useEffect(() => {
    const onPopState = () => {
      if (phaseRef.current !== 'idle') forceReveal()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      clearSafetyTimer()
      if (overlayRef.current) gsap.killTweensOf(overlayRef.current.children)
    }
  }, [forceReveal, clearSafetyTimer])

  const ctxValue = useMemo<PixelTransitionContextValue>(() => ({ navigate }), [navigate])

  return (
    <PixelTransitionContext.Provider value={ctxValue}>
      {children}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="fixed inset-0 z-[9998] pointer-events-none grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {cells.map((_, i) => (
          <div
            key={i}
            style={{ backgroundColor: isAccentCell(i) ? ACCENT : INK, opacity: 0 }}
          />
        ))}
      </div>
    </PixelTransitionContext.Provider>
  )
}

/**
 * next/link 드롭인 대체. 같은 오리진 SPA 좌클릭 내비게이션만 가로채 블록 와이프 후 이동한다.
 * - onNavigate는 Next가 수정키 클릭·외부 URL·download를 이미 걸러준 뒤에만 발화 (link.md 참조)
 * - 문자열이 아닌 href(UrlObject)나 reduced-motion, Provider 부재 시엔 순정 Link로 동작
 */
export function TransitionLink({
  href,
  onNavigate,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  const ctx = useContext(PixelTransitionContext)

  return (
    <Link
      {...props}
      href={href}
      onNavigate={(e) => {
        // Next 16 onNavigate 이벤트는 { preventDefault } 만 노출 → 래핑해서 호출부 취소 여부 추적
        if (onNavigate) {
          let prevented = false
          onNavigate({
            preventDefault: () => {
              prevented = true
              e.preventDefault()
            },
          })
          if (prevented) return // 호출부가 이미 내비게이션을 막았다면 존중
        }
        if (!ctx || typeof href !== 'string' || prefersReducedMotion()) return
        e.preventDefault()
        ctx.navigate(href)
      }}
    >
      {children}
    </Link>
  )
}

'use client'

import gsap from 'gsap'

/**
 * 마그네틱 끌림 공용 유틸 — MagneticEffect.tsx의 정석 quickTo 패턴을 셀렉터 기반
 * 사용처(랜딩·탐색의 .magnetic-target)에서도 쓸 수 있게 명령형으로 추출한 것.
 *
 * 기존 문제(D-3): 두 파일이 mousemove마다 gsap.to를 새로 생성(overwrite 미설정)해
 * 트윈 중첩·GC churn·미세 끊김을 만들고, 랜딩은 핸들러 배열 push 누락으로 리스너가
 * 정리되지 않는 누수까지 있었다. 이 유틸은 요소당 quickTo 2개를 캐시하고
 * cleanup에서 리스너·트윈·인라인 transform을 전부 회수한다.
 *
 * 사용:
 *   useEffect(() => attachMagnetic(root.querySelectorAll('.magnetic-target')), [deps])
 */
export function attachMagnetic(
  elements: Iterable<Element>,
  {
    strength = 0.35,
    moveDuration = 0.35,
    returnDuration = 0.5,
    ease = 'power3.out',
  }: {
    strength?: number
    moveDuration?: number
    returnDuration?: number
    ease?: string
  } = {}
): () => void {
  const cleanups: (() => void)[] = []

  // 모션 최소화 사용자는 끌림 자체를 걸지 않는다(전역 CSS 규칙은 GSAP 트윈을 못 막음)
  if (
    typeof window === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return () => {}
  }

  for (const el of elements) {
    const xTo = gsap.quickTo(el, 'x', { duration: moveDuration, ease })
    const yTo = gsap.quickTo(el, 'y', { duration: moveDuration, ease })

    const onMove = (e: Event) => {
      const { clientX, clientY } = e as MouseEvent
      const rect = el.getBoundingClientRect()
      xTo((clientX - rect.left - rect.width / 2) * strength)
      yTo((clientY - rect.top - rect.height / 2) * strength)
    }
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: returnDuration, ease: 'power2.out', overwrite: 'auto' })
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)

    cleanups.push(() => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      gsap.killTweensOf(el, 'x,y')
      // 인라인 transform 잔류 방지 — hover:-translate-y 류 클래스가 죽지 않게 청소
      gsap.set(el, { clearProps: 'x,y' })
    })
  }

  return () => cleanups.forEach((fn) => fn())
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { CustomBounce } from 'gsap/CustomBounce'
import { CustomWiggle } from 'gsap/CustomWiggle'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'

gsap.registerPlugin(CustomEase, CustomBounce, CustomWiggle, Physics2DPlugin)

/**
 * 🧱 메인 랜딩 블록 빌드 인트로 — 로고의 붉은 벽돌에서 착안한 풀스크린 오프닝.
 *
 * 시나리오:
 *  1) 흰(크림) 배경에 벽돌을 바닥부터 한 켜씩 쌓아 화면을 채운다 (러닝본드 · 단색 벽돌).
 *  2) 벽이 완성되면 BLOCKCANVAS 워드마크가 떠오른다. 이 워드마크는 메인 히어로의
 *     BLOCKCANVAS(Uni Sans Heavy)와 폰트·크기·위치·색을 그대로 복제해, 스크롤 0 지점에서
 *     히어로 글자와 픽셀 단위로 포개진다.
 *  3) 벽돌과 흰 배경이 걷히면 그 자리에 동일한 히어로 BLOCKCANVAS가 그대로 남아,
 *     하나의 모션그래픽처럼 메인 랜딩으로 자연스럽게 이어진다.
 *
 * - 첫 방문(세션당 1회): 풀 시퀀스 / 재방문·모션 최소화: 즉시·빠른 페이드로 스킵
 * - 자체완결형 오버레이라 기존 히어로 스크롤/스냅 로직을 건드리지 않는다.
 */
const WORD = 'BLOCKCANVAS'

// 단색 벽돌 (그라데이션 없음).
const RED = ['#bb3a2d', '#a62f24', '#7c211a', '#e8392b']    // 베이스2 / 진한 마룬 / 포인트 밝은 빨강
const WHITE = ['#ffffff', '#f1eee8', '#e7e3d9', '#dad5c9']  // 화이트톤 변주

type Brick = { w: number; color: string; red: boolean }
type Layout = { bh: number; mortar: number; rowCount: number; rows: { offset: number; bricks: Brick[] }[] }

export default function BlockBuildIntro() {
  const [active, setActive] = useState(true) // 첫 페인트부터 덮어 콘텐츠 깜빡임 방지
  const [layout, setLayout] = useState<Layout | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // 1) 마운트 후 벽돌 레이아웃 계산 (또는 스킵 처리)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // 스토리지 전면 차단 브라우저에서 getItem이 SecurityError를 던지면 이 이펙트가 통째로 죽어
    // z-[100000] 오버레이가 영원히 화면을 덮는다 — throw 시 null(인트로 재생)로 폴백
    let seen: string | null = null
    try { seen = sessionStorage.getItem('bc_intro_seen') } catch {}

    if (seen || reduced) {
      const root = rootRef.current
      if (root) {
        const tw = gsap.to(root, {
          autoAlpha: 0,
          duration: reduced ? 0 : 0.25,
          onComplete: () => setActive(false),
        })
        return () => { tw.kill() }
      }
      setActive(false)
      return
    }

    const w = window.innerWidth
    const h = window.innerHeight
    // 큼직한 벽돌 (가로로 긴 비율)
    const bw = w < 480 ? 120 : w < 768 ? 170 : 240 // 더 큰 블록
    const bh = Math.round(bw * 0.42)
    const mortar = w < 480 ? 5 : 8 // 줄눈(블록 사이 크림색 줄)
    const rowCount = Math.ceil(h / (bh + mortar)) + 1

    // 워드마크(히어로 BLOCKCANVAS) 중심 좌표 — 이 주위로 빨간 벽돌이 모이고, 바깥은 화이트톤.
    // 히어로는 100vh flex-col justify-center + 상단 스페이서 → 중심 y = (h + spacer) / 2
    const spacer = w < 768 ? 96 : 128
    const cx = w / 2
    const cy = (h + spacer) / 2
    const redHalfW = w * 0.47
    const redHalfH = bh * 3

    const pickRed = (s: number) =>
      s % 19 === 0 ? RED[3] : s % 4 === 0 ? RED[2] : s % 2 ? RED[0] : RED[1]
    const pickWhite = (s: number) =>
      s % 7 === 0 ? WHITE[0] : s % 3 === 0 ? WHITE[3] : s % 2 ? WHITE[1] : WHITE[2]

    const rows: { offset: number; bricks: Brick[] }[] = []
    for (let r = 0; r < rowCount; r++) {
      const offset = r % 2 ? -Math.round(bw / 2) : 0 // 러닝 본드: 홀수 줄 반 칸 밀기
      const by = r * (bh + mortar) + bh / 2
      const bricks: Brick[] = []
      let x = offset
      let c = 0
      while (x < w + bw) {
        const seed = ((r * 73856093) ^ (c * 19349663)) >>> 0
        const ww = Math.round(bw * (0.74 + (seed % 1000) / 1000 * 0.5)) // 0.74~1.24배 폭 변주
        const bx = x + ww / 2
        const ex = (bx - cx) / redHalfW
        const ey = (by - cy) / redHalfH
        const dist = ex * ex + ey * ey
        let color: string
        let red: boolean
        if (dist <= 1) { color = pickRed(seed); red = true }                     // 글자 주위: 빨강
        else if (dist <= 1.7) {                                                  // 경계: 페더링
          red = seed % 2 === 1
          color = red ? pickRed(seed) : pickWhite(seed)
        } else { color = pickWhite(seed); red = false }                          // 바깥: 화이트톤
        bricks.push({ w: ww, color, red })
        x += ww + mortar
        c++
      }
      rows.push({ offset, bricks })
    }

    setLayout({ bh, mortar, rowCount, rows })
  }, [])

  // 2) 레이아웃이 준비되면 빌드 시퀀스 실행
  useEffect(() => {
    const root = rootRef.current
    if (!layout || !root) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const q = gsap.utils.selector(root)
    const bricks = q('.bc-brick')
    const redBricks = q('.bc-brick-red')
    const letters = q('.bc-letter')
    const dust = q('.bc-dust')
    const rc = layout.rowCount
    // 빨간 벽돌이 좌→우로 들썩이도록, 각 벽돌의 화면상 x로 지연 계산
    const recoilStagger = (_i: number, el: Element) =>
      ((el as HTMLElement).getBoundingClientRect().left / window.innerWidth) * 0.6

    // 바닥(아래 줄)부터 좌→우로 놓이도록 행/열 기반 스태거
    const layIn = (_i: number, el: Element) => {
      const ds = (el as HTMLElement).dataset
      return (rc - 1 - Number(ds.row)) * 0.045 + Number(ds.col) * 0.012
    }
    // 무너질 땐 위에서부터
    const fallOut = (_i: number, el: Element) => {
      const ds = (el as HTMLElement).dataset
      return Number(ds.row) * 0.028 + Number(ds.col) * 0.008
    }

    // 커스텀 이징 — 같은 이름으로 재생성해도 덮어쓰기라 리마운트에 안전
    // 벽돌 착지: 고무공이 아닌 단단한 벽돌 질감 (한두 번의 짧은 되튐 + 진한 스쿼시)
    // strength 0.4 = 되튐 1~2회로 절제(0.6은 고무공처럼 읽힘 — 리뷰 반영)
    CustomBounce.create('brickDrop', { strength: 0.4, squash: 1.8 })
    // 임팩트 셰이크: 감쇠하는 잔진동
    CustomWiggle.create('impactShake', { wiggles: 6, type: 'easeOut' })

    gsap.set(bricks, { opacity: 0, y: -14, scaleY: 0.55, transformOrigin: '50% 100%' })
    // 글자는 위에서 떨어질 준비 (스쿼시는 brickDrop-squash 이징이 전담 → 초기 스케일 1)
    gsap.set(letters, { opacity: 0, y: -130, scaleX: 1, scaleY: 1, transformOrigin: '50% 100%' })
    gsap.set(dust, { scale: 0.2, opacity: 0, y: 0, transformOrigin: '50% 100%' })

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        document.body.style.overflow = prevOverflow
        try { sessionStorage.setItem('bc_intro_seen', '1') } catch {}
        setActive(false)
      },
    })

    tl
      // 1) 벽돌을 바닥부터 한 장씩 놓아 벽을 쌓음 (살짝 눌렸다 펴지며 안착)
      .to(bricks, {
        opacity: 1,
        y: 0,
        scaleY: 1,
        duration: 0.42,
        ease: 'back.out(1.5)',
        stagger: layIn,
      })
      // 2) 글자가 위에서 쿵 떨어져 박힘 — CustomBounce 2-트윈 패턴 (낙하 + 페어 스쿼시, 좌→우)
      .addLabel('word', '-=0.1')
      .to(letters, {
        opacity: 1,
        duration: 0.14,
        ease: 'power1.in',
        stagger: 0.05,
      }, 'word')
      .to(letters, {
        y: 0,
        duration: 0.6,
        ease: 'brickDrop',
        stagger: 0.05,
      }, 'word')
      .to(letters, {
        // brickDrop-squash 이징이 0→1→0으로 왕복 → 착지 순간 아래 값까지 눌렸다가 1로 복귀.
        // 극값은 절제(1.14/0.80) — 세로 38% 압축(1.32/0.62)은 고무공 질감이라 완화(리뷰 반영)
        scaleX: 1.14,
        scaleY: 0.8,
        duration: 0.6,
        ease: 'brickDrop-squash',
        transformOrigin: '50% 100%',
        stagger: 0.05,
      }, 'word')
      // 2b) 주위 빨간 벽돌이 좌→우로 들썩 (단단한 bump)
      .to(redBricks, {
        keyframes: [
          { yPercent: -7, scaleY: 1.03, duration: 0.1, ease: 'power3.out' },
          { yPercent: 0, scaleY: 1, duration: 0.26, ease: 'back.out(2.4)' },
        ],
        stagger: recoilStagger,
      }, 'word')
      // 2c) 글자가 착지하는 순간 밑동에서 만화 먼지 퍼프 (좌→우로 퍽퍽)
      .to(dust, {
        keyframes: [
          { opacity: 0.95, scale: 1, y: -5, duration: 0.14, ease: 'power2.out' },
          { opacity: 0, scale: 1.7, y: -15, duration: 0.45, ease: 'power1.out' },
        ],
        stagger: 0.05,
      }, 'word+=0.16')
      // 2d) 글자들이 박히는 동안 카메라 임팩트 셰이크 — CustomWiggle x/y 2-트윈 (감쇠 잔진동)
      .to(root, { x: -7, duration: 0.3, ease: 'impactShake' }, 'word+=0.3')
      .to(root, { y: 5, duration: 0.3, ease: 'impactShake' }, 'word+=0.3')
      // (+살짝 punch-in, 가장자리 안 새도록 scale 동반 — 기존 유지)
      .to(root, {
        keyframes: [
          { scale: 1.025, duration: 0.08, ease: 'power2.out' },
          { scale: 1, duration: 0.22, ease: 'power2.out' },
        ],
        transformOrigin: '50% 50%',
      }, 'word+=0.3')
      // 3) 잠깐 정지 (히어로 인트로가 아래에서 조립을 마칠 시간 확보)
      .to({}, { duration: 0.5 })
      // 4) 벽돌과 흰 배경이 걷히며 메인 랜딩(히어로 흰 글자)이 드러남
      .addLabel('reveal')

    // 4a) 붕괴: Physics2D 포물선 낙하(잔해가 흩어지며 무너짐) — 위 줄부터.
    //     성능 가드: 벽돌이 많거나(>120) 모바일(좁은 화면·coarse 포인터)이면 기존 단순 낙하 유지.
    const smallScreen = window.matchMedia('(max-width: 768px)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    if (bricks.length <= 120 && !smallScreen && !coarsePointer) {
      tl.to(bricks, {
        physics2D: { velocity: 'random(60,160)', angle: 'random(70,110)', gravity: 900 },
        rotation: 'random(-25,25)',
        opacity: 0,
        duration: 0.65,
        ease: 'none',
        stagger: fallOut,
      }, 'reveal')
    } else {
      tl.to(bricks, {
        opacity: 0,
        y: 46,
        scaleY: 0.7,
        duration: 0.5,
        ease: 'power2.in',
        stagger: fallOut,
      }, 'reveal')
    }

    tl
      .to(q('.bc-bg'), { autoAlpha: 0, duration: 0.5, ease: 'power1.inOut' }, 'reveal')
      // 5) 오버레이 워드마크를 페이드아웃 → 동일·정렬된 히어로 워드마크로 무봉제 전환
      .to(q('.bc-wordmark'), { autoAlpha: 0, duration: 0.45, ease: 'power2.inOut' }, 'reveal+=0.55')

    return () => {
      tl.kill()
      document.body.style.overflow = prevOverflow
    }
  }, [layout])

  if (!active) return null

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100000] overflow-hidden select-none"
      aria-hidden="true"
    >
      <style>{`
        /* JS 시작 전 완성 상태가 한 프레임 깜빡이지 않도록 초기엔 숨김 */
        /* Borderless: 외곽선·라운딩 없는 평면 단색 블록 */
        .bc-brick {
          opacity: 0;
          will-change: transform, opacity;
        }
        .bc-letter { display: inline-block; opacity: 0; will-change: transform, opacity; }
        /* 만화 먼지 퍼프 — 중앙 원 + box-shadow로 퍼프 덩어리 (글자 크기에 비례, em) */
        .bc-dust {
          position: absolute;
          left: 50%;
          bottom: -0.08em;
          width: 0.1em;
          height: 0.1em;
          margin-left: -0.05em;
          border-radius: 50%;
          background: #efe3d2;
          box-shadow:
            -0.17em 0.02em 0 -0.012em #efe3d2,
            0.17em 0.03em 0 -0.012em #e6d6c1,
            -0.09em -0.06em 0 -0.03em #efe3d2,
            0.1em -0.05em 0 -0.02em #e6d6c1;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>

      {/* 흰(크림) 배경 레이어 — 걷히면 그 뒤의 메인 랜딩이 드러난다 */}
      <div className="bc-bg absolute inset-0 bg-[#FAF9F5]" />

      {/* 풀스크린 러닝본드 단색 벽돌 벽 */}
      {layout && (
        <div className="absolute inset-0 flex flex-col" style={{ gap: layout.mortar }}>
          {layout.rows.map((row, r) => (
            <div
              key={r}
              className="flex shrink-0"
              style={{ height: layout.bh, gap: layout.mortar, marginLeft: row.offset }}
            >
              {row.bricks.map((b, c) => (
                <div
                  key={c}
                  data-row={r}
                  data-col={c}
                  className={`bc-brick shrink-0${b.red ? ' bc-brick-red' : ''}`}
                  style={{ width: b.w, height: '100%', backgroundColor: b.color }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 중앙 워드마크 — 메인 히어로의 BLOCKCANVAS 레이아웃/클래스를 그대로 복제 (포개짐) */}
      <div className="bc-wordmark absolute inset-0 flex flex-col justify-center">
        {/* 히어로의 헤더 스페이서와 동일 */}
        <div className="h-24 md:h-32" />
        <div className="relative z-20 w-full px-6 md:px-12 flex flex-col items-center text-center my-auto">
          <h1 className="text-6xl md:text-9xl lg:text-[10rem] font-black tracking-tighter leading-[0.85] uppercase select-none luxury-text-heavy flex items-center justify-center gap-0.5 md:gap-1.5">
            {WORD.split('').map((ch, i) => (
              <span key={i} className="bc-slot relative inline-block">
                <span className="bc-letter inline-block" style={{ transformOrigin: 'bottom center' }}>{ch}</span>
                <span className="bc-dust" aria-hidden="true" />
              </span>
            ))}
          </h1>
          {/* (정렬 스페이서 제거됨 — 히어로 태그라인이 absolute로 레이아웃에서 분리되어
              히어로 h1이 원래의 단독 센터 위치로 복귀했으므로, 인트로 클론과 자연 정렬된다) */}
        </div>
      </div>
    </div>
  )
}

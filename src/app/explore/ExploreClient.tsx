'use client'

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Compass, Users, ArrowUpRight, Clock, Sparkles, Activity, X, Link2 } from 'lucide-react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { CustomWiggle } from 'gsap/CustomWiggle'
import CustomCursor from '@/components/ui/CustomCursor'
import { attachMagnetic } from '@/lib/magnetic'
import UserSidebar from '@/components/layout/UserSidebar'
import InfiniteMarquee from '@/components/ui/InfiniteMarquee'
import PixelDissolve from '@/components/ui/PixelDissolve'
import BlockImage from '@/components/ui/BlockImage'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip, ScrollTrigger, DrawSVGPlugin, Physics2DPlugin, CustomEase, CustomWiggle)
  // 공유 버튼 아이콘 흔들기용 위글 이징 — 모듈 로드 시 1회만 생성
  CustomWiggle.create('bc-wiggle', { wiggles: 5, type: 'easeOut' })
}

// SSR 렌더 경고 없이 페인트 전에 FLIP을 돌리기 위한 isomorphic layout effect
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface Category {
  id: string
  name: string
  slug: string
}

interface ProjectPreview {
  id: string
  title: string
  thumbnail_url: string | null
  category_id: string | null
}

interface CreatorProfile {
  id: string
  creator_name: string
  display_name: string | null
  avatar_url: string | null
  commission_open: boolean
  discord_id: string | null
  role: string
  created_at?: string | Date
  portfolios: {
    headline: string | null
    about_text: string | null
    banner_url: string | null
    theme_bg_color: string | null
    theme_bg_effect: string | null
    contact_email: string | null
  } | null
  projects: ProjectPreview[]
}

interface FeedProject {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  /** 서버(page.tsx)가 동봉한 16px 픽셀 플레이스홀더 data URI(로컬 썸네일만, 없으면 null) */
  blur_data_url?: string | null
  content: string | null
  created_at: Date
  category_id: string | null
  view_count: number
  like_count: number
  creator: {
    creator_name: string
    display_name: string | null
    avatar_url: string | null
  }
}

interface WipLogWithProfile {
  id: string
  creator_id: string
  title: string
  description: string | null
  media_url: string | null
  created_at: Date
  project_id: string | null
  profile: {
    creator_name: string
    display_name: string | null
    avatar_url: string | null
  }
  project: {
    id: string
    title: string
    thumbnail_url: string | null
    category_id: string | null
  } | null
}

interface ExploreClientProps {
  initialCreators: CreatorProfile[]
  initialProjects: FeedProject[]
  initialWipLogs: WipLogWithProfile[]
  categories: Category[]
  userProfile: any
}

// Clean title helper to strip [SIZE:...] tags
const cleanProjectTitle = (title: string) => {
  if (!title) return ''
  return title.replace(/\[\s*SIZE\s*:\s*[1-3]\s*(?:[xX]\s*[1-3])?\s*\]/gi, '').trim()
}

// Clean metadata helper to strip any square-bracketed CAPITALIZED metadata tags like [FONT:...], [RANGE:...]
const cleanMetadata = (text: string | null | undefined) => {
  if (!text) return ''
  return text.replace(/\[\s*[A-Z_]+\s*(?::[^\]]*)?\]/gi, '').trim()
}

// Format relative time helper
const formatRelativeTime = (dateInput: Date) => {
  const date = new Date(dateInput)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 0) return '방금 전'
  
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 24) return `${diffHours}시간 전`
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays}일 전`
  
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Helper to extract first image from widgets or Tiptap JSON content
const getFirstImageFromContent = (contentStr: string | null): string | null => {
  if (!contentStr) return null
  try {
    const parsed = JSON.parse(contentStr)
    // 1. If it's an array of widgets (standard BlockCanvas editor format)
    if (Array.isArray(parsed)) {
      for (const widget of parsed) {
        if (widget.type === 'image' || widget.widget_type === 'image' || widget.type === 'image_grid') {
          const urls = widget.content?.urls || widget.content || []
          if (Array.isArray(urls) && urls[0]) {
            return urls[0]
          } else if (typeof urls === 'string') {
            return urls
          }
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      // 2. If it is standard Tiptap JSON format
      if (parsed.content && Array.isArray(parsed.content)) {
        for (const node of parsed.content) {
          if (node.type === 'image' && node.attrs && node.attrs.src) {
            return node.attrs.src
          }
        }
      }
    }
  } catch (e) {
    // 3. Fallback regex to parse raw HTML strings for any img tag
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/i
    const match = contentStr.match(imgRegex)
    if (match && match[1]) return match[1]
  }
  return null
}


// Predefined premium gradients for thumbnail placeholders
const premiumGradients = [
  'from-neutral-900 via-zinc-800 to-neutral-950',
  'from-slate-900 via-slate-800 to-neutral-950',
  'from-stone-900 via-stone-800 to-neutral-950',
  'from-zinc-900 via-neutral-800 to-zinc-950'
]

// ── 피드 프로젝트 카드 ──────────────────────────────────────────────
// 썸네일 호버 오버레이를 픽셀 디졸브(청크 로딩) 백드롭으로 바꾸면서 카드별 hover 상태가 필요해져 분리.
// 동작(링크·공유(링크 복사)·리빌 클래스·탭 내비게이션)은 기존 인라인 카드와 동일하다.
function FeedCard({
  project,
  idx,
  protocol,
  baseDomain,
  featured = false,
}: {
  project: FeedProject
  idx: number
  protocol: string
  baseDomain: string
  /** 피드 리드(2칸) 카드 — 마크업은 동일하고 라벨·비율·타이포만 커진다 */
  featured?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const creator = project.creator
  const portfolioUrl = `${protocol}//${creator.creator_name}.${baseDomain}`
  const projectUrl = `${portfolioUrl}/project/${project.id}`
  const creatorAvatar = creator.avatar_url || '/default_avatar.png'
  const cleanTitle = cleanProjectTitle(project.title)
  const fallbackGradient = premiumGradients[idx % premiumGradients.length]

  // ── 공유(링크 복사) — 사이트 정책상 좋아요는 도입하지 않기로 결정, 대신 공유 버튼 ──
  const [copied, setCopied] = useState(false)
  const shareWrapRef = useRef<HTMLSpanElement>(null)
  const shareIconRef = useRef<HTMLSpanElement>(null)
  const shareBusyRef = useRef(false)          // 애니메이션 중 연타 가드
  const copiedTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    // 언마운트 시 라벨 복귀 타이머·잔여 파편 트윈 정리
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    if (shareWrapRef.current) gsap.killTweensOf(shareWrapRef.current.querySelectorAll('.bc-share-frag'))
  }, [])

  const handleShare = () => {
    if (shareBusyRef.current) return
    // 비보안 컨텍스트(HTTP)·구형 브라우저는 navigator.clipboard 자체가 undefined —
    // 가드 없이 호출하면 동기 TypeError로 busy 플래그가 영구히 잠겨 버튼이 먹통이 된다
    if (!navigator.clipboard?.writeText) return
    shareBusyRef.current = true
    navigator.clipboard.writeText(projectUrl).then(() => {
      setCopied(true)
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false)
        shareBusyRef.current = false
      }, 1200)

      // 모션 최소화 사용자: 복사 + 텍스트 피드백만 (전역 CSS는 GSAP 트윈을 못 막으므로 명시 가드)
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      // ① 아이콘 CustomWiggle 흔들기 — 인라인 transform은 완료 즉시 청소(하우스 룰)
      if (shareIconRef.current) {
        gsap.fromTo(
          shareIconRef.current,
          { rotation: 0 },
          { rotation: 14, duration: 0.6, ease: 'bc-wiggle', clearProps: 'transform' }
        )
      }

      // ② 블록 파편 버스트 — 4px 사각 조각(잉크 + 시그니처 레드 1개)이 위쪽 부채꼴로 튄다
      const wrap = shareWrapRef.current
      if (wrap) {
        const count = gsap.utils.random(4, 6, 1)
        for (let i = 0; i < count; i++) {
          const frag = document.createElement('span')
          frag.className = 'bc-share-frag'
          frag.style.cssText =
            'position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;pointer-events:none;z-index:10;background:' +
            (i === 0 ? '#FF424D' : '#1E2022')
          wrap.appendChild(frag)
          gsap.to(frag, {
            physics2D: {
              velocity: gsap.utils.random(60, 140),
              angle: gsap.utils.random(220, 320), // 위쪽 부채꼴(스크린 좌표계: 270°=위)
              gravity: 500,
            },
            opacity: 0,
            // 위글(0.6s)·먼지 퍼프와 결이 맞게 짧게 — 낙하 후반에 빠르게 소멸
            duration: 0.6,
            ease: 'power1.in',
            onComplete: () => frag.remove(),
          })
        }
      }
    }).catch(() => {
      shareBusyRef.current = false
    })
  }

  return (
    <div
      className={`explore-reveal group relative flex flex-col space-y-3 ${featured ? 'md:col-span-2' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovered(false) }}
    >
      {/* 리드 카드 전용 모노 마이크로 라벨 */}
      {featured && (
        <div className="flex items-center gap-2 px-1 text-[9px] font-mono font-black tracking-[0.25em] text-neutral-400 uppercase select-none">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FF424D]" />
          <span>[ FEATURED // №01 ]</span>
        </div>
      )}
      {/* 크롭마크는 다른 표면과 동일하게 "테두리 있는 카드"(썸네일) 모서리에 밀착 —
          overflow-hidden 클리핑은 내부 래퍼로 이관해 -5px 바깥 재단선이 잘리지 않게 한다 */}
      <a
        href={projectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`bc-cropmark relative ${featured ? 'aspect-[16/9]' : 'aspect-[4/3]'} rounded-[24px] bg-neutral-900 border border-neutral-200/80 group-hover:border-black group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all duration-500 select-none block`}
      >
        <div className="absolute inset-0 rounded-[24px] overflow-hidden">
        {(() => {
          const projectThumbnail = project.thumbnail_url || getFirstImageFromContent(project.content)
          if (projectThumbnail) {
            return (
              <BlockImage
                src={projectThumbnail}
                alt={cleanTitle}
                blurDataURL={project.blur_data_url}
                nextImage
                className="object-cover group-hover:scale-[1.04] transition-transform duration-700 brightness-95"
              />
            )
          }
          return (
            <div className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
              <div className="text-[8px] text-white/30 tracking-[0.2em] font-black uppercase mb-3">
                PORTFOLIO
              </div>
              <h3 className="text-xs md:text-sm font-extrabold text-white/90 leading-snug tracking-tight max-w-[160px] line-clamp-3 my-1 break-keep">
                {cleanTitle}
              </h3>
              <div className="flex items-center gap-1 mt-3 opacity-30">
                <span className="h-[1px] w-3 bg-white/40" />
                <Sparkles className="h-2.5 w-2.5 text-white" />
                <span className="h-[1px] w-3 bg-white/40" />
              </div>
            </div>
          )
        })()}
        {/* 픽셀 디졸브 백드롭 — 블록 셀이 무작위로 먼저 차오르고, 라벨은 살짝 늦게 뜬다 */}
        <PixelDissolve active={hovered} className="z-10" />
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDelay: hovered ? '120ms' : '0ms' }}
        >
          <div className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg text-[9px] font-black tracking-widest text-black flex items-center gap-1">
            <span>상세 작품 보기</span>
            <ArrowUpRight size={10} />
          </div>
        </div>
        </div>
      </a>

      <div className="flex items-start justify-between px-1 text-left">
        <div className="space-y-1.5 flex-1 min-w-0 pr-4">
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-bold text-neutral-900 hover:text-[#3b82f6] leading-tight block tracking-tight transition-colors ${
              featured ? 'text-2xl md:text-[28px] font-extrabold line-clamp-2 break-keep' : 'text-[14px] truncate'
            }`}
          >
            {cleanTitle}
          </a>
          {/* 리드 카드 세리프(명조) 바이라인 — 에디토리얼 악센트 */}
          {featured && (
            <p
              className="text-[13px] md:text-sm italic text-neutral-500 leading-snug"
              style={{ fontFamily: "'Nanum Myeongjo', serif" }}
            >
              {creator.display_name || creator.creator_name} 작가의 최신 작품
            </p>
          )}
          <a
            href={portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group/author w-max"
          >
            <div className="relative w-5 h-5 rounded-full overflow-hidden border border-neutral-100 bg-white">
              <Image
                src={creatorAvatar}
                alt={creator.display_name || creator.creator_name}
                fill
                className="object-cover"
              />
            </div>
            <span className="text-[11px] font-semibold text-neutral-500 group-hover/author:text-black transition-colors truncate">
              {creator.display_name || creator.creator_name}
            </span>
          </a>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 pt-0.5 select-none">
          {/* 파편이 버튼 밖으로 튀어야 하므로 position:relative 래퍼가 파편의 기준면이 된다 */}
          <span ref={shareWrapRef} className="relative inline-flex">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleShare() }}
              aria-label="작품 링크 복사"
              className={`flex items-center gap-1 transition-colors ${copied ? 'text-[#FF424D]' : 'text-neutral-400 hover:text-neutral-900'}`}
            >
              <span ref={shareIconRef} className="inline-flex">
                <Link2 size={13} />
              </span>
              {/* 피드백은 한글·동일 서체 유지('공유'→'복사됨') — 서체·언어가 동시에 바뀌는 이질감 방지 */}
              <span className="text-[9px] font-bold">
                {copied ? '복사됨' : '공유'}
              </span>
            </button>
          </span>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Clock size={11} />
            <span className="text-[9px] font-bold font-mono">
              {formatRelativeTime(project.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExploreClient({
  initialCreators,
  initialProjects,
  initialWipLogs = [],
  userProfile,
}: ExploreClientProps) {
  const [activeTab, setActiveTab] = useState<'feed' | 'wip' | 'creators'>('feed')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest')
  const [creatorSort, setCreatorSort] = useState<'latest' | 'name'>('latest')
  const [activeInitial, setActiveInitial] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)

  const [baseDomain, setBaseDomain] = useState('craftopia.work')
  const [protocol, setProtocol] = useState('https:')

  // 결과 그리드 스태거 리빌 스코프
  const contentRef = useRef<HTMLElement>(null)

  // ── FLIP 레이아웃 모핑 캡처 — 필터/정렬/탭 클릭 시 상태 변경 "직전" 레이아웃을 잡아두고
  //    렌더 후 layout effect에서 Flip.from으로 모핑한다(검색 타이핑은 캡처하지 않음 → 기존 리빌 유지)
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const setWithFlip = (apply: () => void) => {
    if (
      typeof window !== 'undefined' &&
      contentRef.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const items = contentRef.current.querySelectorAll('.explore-reveal')
      flipStateRef.current = items.length ? Flip.getState(items) : null
    }
    apply()
  }

  // ── WIP 타임라인 DrawSVG 스크롤 드로잉 refs ──
  const wipTimelineRef = useRef<HTMLDivElement>(null)
  const wipSvgRef = useRef<SVGSVGElement>(null)
  const wipLinePathRef = useRef<SVGPathElement>(null)
  const wipCapPathRef = useRef<SVGPathElement>(null)

  // Determine host and protocol dynamically on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host
      setProtocol(window.location.protocol)
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        setBaseDomain('localhost:3000')
      } else {
        const parts = host.split('.')
        if (parts.length >= 3) {
          setBaseDomain(parts.slice(1).join('.'))
        } else {
          setBaseDomain(host)
        }
      }
    }
  }, [])

  // 실시간 검색 + 정렬 (작품 / 크리에이터 / WIP). 키워드는 공백 기준 다중 토큰으로 모두 포함되어야 매칭(AND).
  // ⚠useMemo 파생값이어야 한다: useEffect+state로 하면 정렬 변경이 "한 렌더 늦게" 반영되어
  // FLIP 캡처가 DOM 미변경 커밋에서 소비되고 실제 재배열은 스냅된다(리뷰에서 발견된 무효화 버그).
  const { filteredProjects, filteredCreators, filteredWipLogs } = useMemo(() => {
    const tokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (haystack: string) => {
      if (!tokens.length) return true
      const h = haystack.toLowerCase()
      return tokens.every(t => h.includes(t))
    }

    // 1. Projects — 제목·설명·작가명/아이디
    let nextProjects = initialProjects.filter(project =>
      matches([
        cleanProjectTitle(project.title),
        cleanMetadata(project.description),
        project.creator.display_name,
        project.creator.creator_name,
      ].filter(Boolean).join(' '))
    )

    if (sortBy === 'popular') {
      nextProjects = [...nextProjects].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    } else {
      nextProjects = [...nextProjects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    // 2. Creators — 이름·아이디·한줄소개·소개글·작품명까지 폭넓게 매칭
    const nextCreators = initialCreators.filter(creator =>
      matches([
        creator.display_name,
        creator.creator_name,
        creator.portfolios?.headline,
        creator.portfolios?.about_text,
        ...(creator.projects || []).map(p => cleanProjectTitle(p.title)),
      ].filter(Boolean).join(' '))
    )

    // 3. WIP Logs — 제목·설명·작가명/아이디
    const nextWipLogs = initialWipLogs.filter(log =>
      matches([
        log.title,
        cleanMetadata(log.description),
        log.profile.display_name,
        log.profile.creator_name,
      ].filter(Boolean).join(' '))
    )

    return { filteredProjects: nextProjects, filteredCreators: nextCreators, filteredWipLogs: nextWipLogs }
  }, [searchTerm, sortBy, initialProjects, initialCreators, initialWipLogs])

  // GSAP Magnetic Effect — 공용 유틸(attachMagnetic)로 통합: quickTo 캐시·reduced-motion 가드·clearProps 회수 내장.
  // activeInitial 포함 필수 — 초성 인덱스 필터로 크리에이터 카드가 재마운트되면 재바인딩해야 한다.
  useEffect(() => {
    return attachMagnetic(document.querySelectorAll('.magnetic-target'))
  }, [activeTab, filteredProjects, filteredCreators, filteredWipLogs, activeInitial])

  // 탭/필터 등 의도적인 액션 시에만 반응 (검색 타이핑에는 반응하지 않음).
  // setWithFlip으로 캡처된 직전 레이아웃이 있으면 FLIP 모핑, 없으면(첫 마운트 등) 기존 스태거 리빌.
  useIsoLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const root = contentRef.current
    if (!root) return
    const captured = flipStateRef.current
    flipStateRef.current = null // 1회성 소비

    const items = root.querySelectorAll('.explore-reveal')
    if (!items.length) return

    // 모션 최소화 사용자는 리빌/모핑 생략 = 즉시 전환(전역 CSS 규칙은 GSAP 트윈을 못 막으므로 명시 가드)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (captured) {
      // FLIP: 이전 레이아웃 → 현재 레이아웃 모핑.
      // absolute:true는 리드 카드(md:col-span-2)·디바이더 밴드(col-span-full)를 흐름에서 빼내
      // 그리드 스팬이 무너지고 남은 카드 위치 계산이 틀어지므로 in-flow(transform) 방식을 쓴다.
      const anim = Flip.from(captured, {
        targets: items,
        duration: 0.5,
        ease: 'power3.inOut',
        stagger: 0.02,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { opacity: 0, scaleY: 0.85, transformOrigin: '50% 100%' },
            { opacity: 1, scaleY: 1, duration: 0.45, ease: 'back.out(1.7)', clearProps: 'opacity,transform' }
          ),
        onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.2 }),
        // 인라인 transform이 잔류하면 hover:-translate-y 클래스를 영구히 덮어쓰므로 완료 즉시 청소
        onComplete: () => gsap.set(items, { clearProps: 'transform,opacity' }),
      })
      return () => { anim.kill(); gsap.set(items, { clearProps: 'transform,opacity' }) }
    }

    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 22 },
      {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04, overwrite: 'auto',
        // 인라인 transform이 잔류하면 카드의 hover:-translate-y 클래스를 영구히 덮어쓰므로 완료 즉시 청소
        onComplete: () => gsap.set(items, { clearProps: 'transform,opacity' }),
      }
    )
    return () => { tween.kill(); gsap.set(items, { clearProps: 'transform,opacity' }) }
  }, [activeTab, sortBy, creatorSort, activeInitial])

  // ── WIP 타임라인: 픽셀 스텝 라인 DrawSVG 스크롤 드로잉 + 도트 팝 ─────────────
  // 타임라인은 탭 전환 시 언마운트되지만, 이펙트 정리(activeTab dep)가 먼저 트리거/트윈을 전부 kill한다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (activeTab !== 'wip') return
    const container = wipTimelineRef.current
    const svg = wipSvgRef.current
    const linePath = wipLinePathRef.current
    const capPath = wipCapPathRef.current
    if (!container || !svg || !linePath || !capPath) return

    // 실측 높이 기준으로 viewBox·경로를 구축. preserveAspectRatio=none이어도
    // viewBox 폭(16) = CSS 폭(w-4=16px)이라 x축 스케일 1:1 → 90° 조그가 찌그러지지 않는다.
    const buildPath = () => {
      const h = Math.max(2, Math.round(svg.getBoundingClientRect().height))
      svg.setAttribute('viewBox', `0 0 16 ${h}`)
      // 세로선(x=8) + ~120px마다 4px 90° 조그(픽셀 스텝) — 마지막 조그는 바닥 근처에서 생략
      let d = 'M8 0'
      let x = 8
      for (let y = 120; y < h - 40; y += 120) {
        const nx = x === 8 ? 12 : 8
        d += ` V${y} H${nx}`
        x = nx
      }
      d += ` V${h}`
      linePath.setAttribute('d', d)
      capPath.setAttribute('d', d)
    }
    buildPath()

    // 모션 최소화: 라인은 처음부터 전부 그려진 상태 + 도트 그대로, 트리거/리드 캡 없음
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      capPath.style.display = 'none'
      const ro = new ResizeObserver(() => buildPath())
      ro.observe(container)
      return () => { ro.disconnect(); capPath.style.display = '' }
    }

    // 스크럽 드로잉: 잉크 라인이 아래로 그려지고, 레드 3px 캡이 선단(2% 구간)을 따라간다
    const tl = gsap.timeline({
      scrollTrigger: { trigger: container, start: 'top 75%', end: 'bottom 60%', scrub: 0.5 },
    })
    tl.fromTo(linePath, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', duration: 1 }, 0)
      .fromTo(capPath, { drawSVG: '0% 2%' }, { drawSVG: '98% 100%', ease: 'none', duration: 1 }, 0)
      .to(capPath, { opacity: 0, duration: 0.04 }, 0.96)

    // 라인이 도트를 지날 때 도트 팝(1회성)
    const dots = Array.from(container.querySelectorAll<HTMLElement>('.wip-dot'))
    const dotTriggers = dots.map((dot) => {
      gsap.set(dot, { scale: 0 })
      return ScrollTrigger.create({
        trigger: dot,
        start: 'top 78%',
        once: true,
        // 인라인 transform 잔류 방지(하우스 룰) — 도트의 hover 색 전환 클래스와 충돌하지 않게 청소
        onEnter: () => gsap.to(dot, { scale: 1, duration: 0.5, ease: 'back.out(2)', clearProps: 'transform' }),
      })
    })

    // 이미지 로드 등으로 높이가 변하면 경로 재구축 + 트리거 위치 갱신
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        buildPath()
        tl.invalidate()
        ScrollTrigger.refresh()
      })
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      tl.scrollTrigger?.kill()
      tl.kill()
      dotTriggers.forEach((t) => t.kill())
      gsap.set([linePath, capPath, ...dots], { clearProps: 'all' })
    }
  }, [activeTab, filteredWipLogs])

  // ── 크리에이터 정렬 + 초성/A–Z 인덱스 ──────────────────────────────
  const creatorName = (c: CreatorProfile) => c.display_name || c.creator_name

  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
  const CHO_NORM: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' }
  const getInitial = (raw: string | null) => {
    const s = (raw || '').trim()
    if (!s) return '#'
    const code = s.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const cho = CHO[Math.floor((code - 0xac00) / 588)]
      return CHO_NORM[cho] || cho
    }
    if (/[a-z]/i.test(s[0])) return s[0].toUpperCase()
    return '#'
  }
  const INITIAL_ORDER = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#']

  const sortCreators = (arr: CreatorProfile[]) =>
    creatorSort === 'name'
      ? [...arr].sort((a, b) => creatorName(a).localeCompare(creatorName(b), 'ko'))
      : [...arr].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const availableInitials = INITIAL_ORDER.filter(init =>
    filteredCreators.some(c => getInitial(creatorName(c)) === init)
  )
  const effectiveInitial = activeInitial && availableInitials.includes(activeInitial) ? activeInitial : null
  const visibleCreators = effectiveInitial
    ? filteredCreators.filter(c => getInitial(creatorName(c)) === effectiveInitial)
    : filteredCreators

  // 공식 / 일반 크리에이터 구분 (역할 기준)
  const officialCreators = sortCreators(visibleCreators.filter(c => c.role === 'official' || c.role === 'admin'))
  const generalCreators = sortCreators(visibleCreators.filter(c => c.role !== 'official' && c.role !== 'admin'))

  // 검색 자동완성: 입력 중 일치하는 크리에이터 상위 6명 (탭과 무관하게 빠른 점프)
  const creatorSuggestions = searchTerm.trim() ? filteredCreators.slice(0, 6) : []

  const renderCreatorCard = (creator: CreatorProfile) => {
    const portfolioUrl = `${protocol}//${creator.creator_name}.${baseDomain}`
    const avatarSrc = creator.avatar_url || '/default_avatar.png'
    const projects = creator.projects || []
    const bannerSrc = creator.portfolios?.banner_url || '/default_banner.png'

    return (
      <div
        key={creator.id}
        className="explore-reveal group bc-cropmark relative bg-white border border-neutral-200/80 rounded-[32px] flex flex-col hover:border-black hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)] transition-all duration-500 hover:-translate-y-1.5"
      >
        {/* 루트의 overflow-hidden을 제거(크롭마크가 바깥에 그려져야 함)하면서 모서리 클리핑은 자식이 담당 */}
        <div className="h-52 bg-neutral-100 flex gap-1 p-1 shrink-0 relative overflow-hidden rounded-t-[32px]">
          {projects.length >= 3 ? (
            <div className="w-full h-full flex gap-1 rounded-t-[26px] overflow-hidden">
              <div className="w-2/3 h-full relative overflow-hidden bg-neutral-200">
                <Image 
                  src={projects[0].thumbnail_url || bannerSrc} 
                  alt={projects[0].title}
                  fill
                  className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                />
              </div>
              <div className="w-1/3 h-full flex flex-col gap-1">
                <div className="h-1/2 relative overflow-hidden bg-neutral-200">
                  <Image 
                    src={projects[1].thumbnail_url || bannerSrc} 
                    alt={projects[1].title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="h-1/2 relative overflow-hidden bg-neutral-200">
                  <Image 
                    src={projects[2].thumbnail_url || bannerSrc} 
                    alt={projects[2].title}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          ) : projects.length === 2 ? (
            <div className="w-full h-full flex gap-1 rounded-t-[26px] overflow-hidden">
              <div className="w-1/2 h-full relative overflow-hidden bg-neutral-200">
                <Image 
                  src={projects[0].thumbnail_url || bannerSrc} 
                  alt={projects[0].title}
                  fill
                  className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                />
              </div>
              <div className="w-1/2 h-full relative overflow-hidden bg-neutral-200">
                <Image 
                  src={projects[1].thumbnail_url || bannerSrc} 
                  alt={projects[1].title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          ) : projects.length === 1 ? (
            <div className="w-full h-full relative rounded-t-[26px] overflow-hidden bg-neutral-200">
              <Image 
                src={projects[0].thumbnail_url || bannerSrc} 
                alt={projects[0].title}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
              />
            </div>
          ) : (
            <div className="w-full h-full relative rounded-t-[26px] overflow-hidden bg-neutral-200">
              <Image
                src={bannerSrc}
                alt={creator.display_name || creator.creator_name}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
              />
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-1 relative bg-white rounded-b-[32px]">
          <div className="flex items-center gap-3 mb-4 text-left">
            <div className="relative w-11 h-11 rounded-full border-2 border-neutral-100 bg-white overflow-hidden shadow-sm shrink-0">
              <Image
                src={avatarSrc}
                alt={creator.display_name || creator.creator_name}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-neutral-950 truncate tracking-tight text-sm">
                  {creator.display_name || creator.creator_name}
                </h4>
                {(creator.role === 'official' || creator.role === 'admin') && (
                  <svg className="w-3.5 h-3.5 text-blue-500 fill-current shrink-0" viewBox="0 0 24 24">
                    <title>공식 크리에이터</title>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-neutral-400 font-mono font-bold leading-none">
                  @{creator.creator_name}
                </p>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase leading-none ${
                  creator.role === 'official'
                    ? 'bg-blue-50 text-blue-600 border border-blue-200/50'
                    : creator.role === 'admin'
                      ? 'bg-purple-50 text-purple-600 border border-purple-200/50'
                      : 'bg-neutral-50 text-neutral-500 border border-neutral-200/50'
                }`}>
                  {creator.role === 'official' ? 'Official' : creator.role === 'admin' ? 'Admin' : 'Creator'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 font-medium text-left leading-relaxed line-clamp-2 h-9 mb-4">
            {creator.portfolios?.headline || '이 크리에이터는 아직 한 줄 소개를 작성하지 않았습니다.'}
          </p>

          <div className="flex items-center justify-end pt-4 border-t border-neutral-100 mt-auto select-none">
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-black text-black hover:text-[#3b82f6] flex items-center gap-1 group/link magnetic-target"
            >
              <span>포트폴리오 방문</span>
              <ArrowUpRight size={11} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-neutral-900 font-sans transition-colors duration-500 pb-24">
      {/* Grid lines background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E2E2D933_1px,transparent_1px),linear-gradient(to_bottom,#E2E2D933_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Main Platform Header */}
      <header className="sticky top-0 z-50 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-neutral-200/40 py-5 w-full">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-5 h-5 transition-transform duration-500 group-hover:rotate-90">
              <Image src="/logo_icon.png" alt="BlockCanvas Logo" fill className="object-contain" />
            </div>
            {/* 타이핑 워드마크 → 브랜드 로고 이미지(CreatorNavbar와 동일 자산) */}
            <Image
              src="/logo_text.png"
              alt="BLOCK CANVAS"
              width={133}
              height={16}
              className="h-3.5 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-6">
            {userProfile && (
              <UserSidebar
                userName={userProfile.display_name || userProfile.creator_name}
                userHandle={userProfile.creator_name}
                avatarUrl={userProfile.avatar_url || ''}
                isOwner={true}
                userRole={userProfile.role || undefined}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Combined Content Frame */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 pt-10 relative z-10">
        
        {/* 단일 컬럼 — 상단 큰 검색 + 가로 탭 */}
        <div>

          {/* 🔍 Prominent Search Bar — 페이지 최상단, 누구나 바로 발견.
              포커스 추적은 래퍼에서 relatedTarget 포함 검사로 처리(FeedCard와 동일 패턴) —
              기존 setTimeout(150) 방식은 Tab으로 제안 링크에 포커스를 옮기면 드롭다운이 먼저 닫혀
              키보드로는 '크리에이터 바로가기'를 실행할 수 없었다 */}
          <div
            className="relative mb-5 max-w-3xl mx-auto"
            onFocus={() => setSearchFocused(true)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSearchFocused(false) }}
          >
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="크리에이터·작품 검색 — 이름, 아이디, 작품명까지 한 번에"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-4 text-sm font-semibold bg-white border border-neutral-200 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] focus:outline-none focus:border-black focus:shadow-[0_12px_44px_rgba(0,0,0,0.08)] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="검색어 지우기"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
              >
                <X size={15} />
              </button>
            )}

            {/* 자동완성: 일치하는 크리에이터 바로가기 */}
            {searchFocused && creatorSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-neutral-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.14)] overflow-hidden">
                <div className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  크리에이터 바로가기
                </div>
                {creatorSuggestions.map((c) => (
                  <a
                    key={c.id}
                    href={`${protocol}//${c.creator_name}.${baseDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="relative w-8 h-8 rounded-full overflow-hidden border border-neutral-100 bg-white shrink-0">
                      <Image src={c.avatar_url || '/default_avatar.png'} alt={creatorName(c)} fill className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-neutral-900 truncate">{creatorName(c)}</span>
                      <span className="block text-[11px] text-neutral-400 font-mono truncate">@{c.creator_name}</span>
                    </span>
                    <ArrowUpRight size={13} className="text-neutral-300 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* 가로 탭 pill */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {([
              { key: 'feed', label: '최신 작품', icon: Compass },
              { key: 'wip', label: '진행 중 (WIP)', icon: Activity },
              { key: 'creators', label: '크리에이터', icon: Users },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setWithFlip(() => setActiveTab(key))}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all magnetic-target ${
                  activeTab === key
                    ? 'bg-black text-white shadow-md'
                    : 'bg-white border border-neutral-200 text-neutral-500 hover:text-black hover:border-neutral-400'
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <main ref={contentRef} className="w-full">
            
            {/* Header Title with Signature Red Dot */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-5 border-b border-neutral-200/40 gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 select-none">
                  Explore<span className="text-[#FF424D]">.</span>
                </h1>
                <p className="text-xs text-neutral-500 font-medium mt-1.5">
                  {activeTab === 'feed' ? (
                    <>
                      {/* 세리프 악센트는 리드 카드 바이라인 한 곳만 — 같은 뷰포트에 2곳이면 포인트가 희석됨 */}
                      크리에이터들이 선보이는 하이엔드 최신 포트폴리오 컬렉션
                    </>
                  ) : activeTab === 'wip'
                    ? '실시간으로 업로드되는 프로젝트 빌드 및 제작 현황'
                    : '플랫폼에서 활동 중인 크리에이터 프로필 디렉토리'}
                </p>
              </div>

              {/* Sorting controls for Feed tab */}
              {activeTab === 'feed' && (
                <div className="flex items-center gap-1 bg-neutral-100 border border-neutral-200/40 p-1 rounded-xl w-fit self-start sm:self-auto select-none">
                  <button
                    onClick={() => setWithFlip(() => setSortBy('latest'))}
                    className={`px-3.5 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all duration-300 magnetic-target ${
                      sortBy === 'latest'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    최신순
                  </button>
                  <button
                    onClick={() => setWithFlip(() => setSortBy('popular'))}
                    className={`px-3.5 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all duration-300 magnetic-target ${
                      sortBy === 'popular'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    인기순
                  </button>
                </div>
              )}

              {/* Sorting controls for Creators tab */}
              {activeTab === 'creators' && (
                <div className="flex items-center gap-1 bg-neutral-100 border border-neutral-200/40 p-1 rounded-xl w-fit self-start sm:self-auto select-none">
                  <button
                    onClick={() => setWithFlip(() => setCreatorSort('latest'))}
                    className={`px-3.5 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all duration-300 magnetic-target ${
                      creatorSort === 'latest'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    최신 합류순
                  </button>
                  <button
                    onClick={() => setWithFlip(() => setCreatorSort('name'))}
                    className={`px-3.5 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all duration-300 magnetic-target ${
                      creatorSort === 'name'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    이름순
                  </button>
                </div>
              )}
            </div>

            {/* 🧱 크리에이터 Marquee — 검색하지 않을 때 전체 크리에이터가 동등하게 흐름 */}
            {!searchTerm.trim() && initialCreators.length > 0 && (
              <div className="mb-10 -mx-6 md:-mx-12">
                <div className="flex items-center gap-2 mb-2 px-6 md:px-12">
                  <Sparkles size={13} className="text-[#FF424D]" />
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-neutral-500">주목할 만한 크리에이터</h2>
                </div>
                <InfiniteMarquee speed={48} maskFade>
                  {initialCreators.map((c) => (
                    <a
                      key={c.id}
                      href={`${protocol}//${c.creator_name}.${baseDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 w-[150px] bg-white border border-neutral-200/80 rounded-2xl p-3 flex flex-col items-center text-center hover:border-black hover:shadow-[0_16px_36px_rgba(0,0,0,0.07)] hover:-translate-y-1 transition-all duration-300"
                    >
                      <span className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-neutral-100 mb-2">
                        <Image src={c.avatar_url || '/default_avatar.png'} alt={creatorName(c)} fill className="object-cover" />
                      </span>
                      <span className="text-xs font-bold text-neutral-900 truncate w-full">{creatorName(c)}</span>
                      <span className="text-[10px] text-neutral-400 font-mono truncate w-full">@{c.creator_name}</span>
                    </a>
                  ))}
                </InfiniteMarquee>
              </div>
            )}

            {activeTab === 'feed' ? (
              // DISCOVER PROJECTS GRID
              filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {(() => {
                    // 리드 카드: 검색 중이 아니고 기본 정렬(최신순)이며 작품이 충분할 때만 첫 작품을 2칸 리드로 승격
                    // (임의의 검색 히트에 FEATURED 라벨이 붙는 의미 왜곡 방지)
                    const showLead = !searchTerm.trim() && sortBy === 'latest' && filteredProjects.length >= 3
                    const nodes: React.ReactNode[] = []
                    filteredProjects.forEach((project, idx) => {
                      // 에디토리얼 디바이더 밴드 — 6셀마다 삽입(키는 섹션 번호로 고정, 프로젝트 키와 충돌 없음).
                      // 리드 카드는 2셀을 차지하므로 주기를 1카드 앞당겨야 밴드 직전 행에 빈칸이 안 생긴다
                      // (첫 섹션 = 리드 2셀 + 카드 4장 = 6셀 = 3열 기준 정확히 2행)
                      const isDividerSlot = showLead
                        ? idx >= 5 && (idx - 5) % 6 === 0
                        : idx > 0 && idx % 6 === 0
                      if (isDividerSlot) {
                        const section = showLead ? (idx - 5) / 6 + 1 : idx / 6
                        nodes.push(
                          <div
                            key={`feed-divider-${section}`}
                            aria-hidden="true"
                            className="explore-reveal col-span-full flex items-center gap-5 md:gap-8 py-4 md:py-7 select-none"
                          >
                            <span
                              className="bc-pixel-num text-5xl md:text-7xl leading-none text-transparent shrink-0"
                              style={{ WebkitTextStroke: '1.5px rgba(30,32,34,0.16)' }}
                            >
                              {/* 디바이더는 "다음 섹션"의 머리말 — 옆 SECTION 라벨과 같은 번호(section+1)로 통일 */}
                              {String(section + 1).padStart(2, '0')}
                            </span>
                            <span className="h-px flex-1 bg-neutral-200/80" />
                            <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-neutral-400 uppercase shrink-0">
                              [ COLLECTION // SECTION_{String(section + 1).padStart(2, '0')} ]
                            </span>
                          </div>
                        )
                      }
                      nodes.push(
                        <FeedCard
                          key={project.id}
                          project={project}
                          idx={idx}
                          featured={showLead && idx === 0}
                          protocol={protocol}
                          baseDomain={baseDomain}
                        />
                      )
                    })
                    return nodes
                  })()}
                </div>
              ) : (
                <div className="text-center py-24 bg-white border border-neutral-200/80 rounded-[32px] max-w-md mx-auto p-8 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                  <div className="w-12 h-12 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                    <Compass size={22} className="animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-neutral-900">최근 업로드된 작품이 없습니다</h3>
                    <p className="text-xs text-neutral-500 font-medium">검색어를 바꾼 뒤 다시 확인해보세요.</p>
                  </div>
                </div>
              )
            ) : activeTab === 'wip' ? (
              // WIP LOGS TIMELINE FEED
              filteredWipLogs.length > 0 ? (
                <div
                  ref={wipTimelineRef}
                  className="relative border-l border-transparent ml-4 md:ml-6 pl-6 md:pl-8 space-y-8 py-2"
                >
                  {/* 정적 border-l을 대체하는 픽셀 스텝 라인 — 투명 보더로 레이아웃(1px)은 그대로 유지.
                      viewBox·경로는 마운트 후 실측 높이로 세팅(DrawSVG 스크럽 드로잉, 위 이펙트 참조) */}
                  <svg
                    ref={wipSvgRef}
                    aria-hidden="true"
                    preserveAspectRatio="none"
                    className="absolute top-0 bottom-0 -left-2 w-4 pointer-events-none select-none"
                  >
                    <path
                      ref={wipLinePathRef}
                      fill="none"
                      stroke="#1E2022"
                      strokeOpacity="0.2"
                      strokeWidth="2"
                      shapeRendering="crispEdges"
                    />
                    {/* 시그니처 레드 리드 캡 — 드로잉 선단을 3px로 따라간다 */}
                    <path
                      ref={wipCapPathRef}
                      fill="none"
                      stroke="#FF424D"
                      strokeWidth="3"
                      shapeRendering="crispEdges"
                    />
                  </svg>
                  {filteredWipLogs.map((log) => {
                    const creator = log.profile
                    const portfolioUrl = `${protocol}//${creator.creator_name}.${baseDomain}`
                    const creatorAvatar = creator.avatar_url || '/default_avatar.png'
                    const projectUrl = log.project ? `${portfolioUrl}/project/${log.project.id}` : null

                    return (
                      <div key={log.id} className="explore-reveal relative group">
                        {/* Timeline point dot — 라인이 지나갈 때 ScrollTrigger로 팝(scale 0→1) */}
                        <div className="wip-dot absolute -left-[31px] md:-left-[39px] top-2.5 w-3.5 h-3.5 rounded-full bg-white border-[3px] border-neutral-900 group-hover:bg-[#FF424D] group-hover:border-[#FF424D] transition-colors duration-300" />
                        
                        <div className="bg-white border border-neutral-200/80 rounded-[28px] p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.015)] hover:border-black hover:shadow-[0_20px_40px_rgba(0,0,0,0.03)] transition-all duration-500 relative flex flex-col md:flex-row gap-6 md:gap-8">
                          
                          {/* Left text column */}
                          <div className="flex-1 space-y-4 text-left min-w-0">
                            {/* Creator Header */}
                            <div className="flex items-center justify-between gap-4">
                              <a 
                                href={portfolioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 group/author"
                              >
                                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-neutral-100 bg-white">
                                  <Image
                                    src={creatorAvatar}
                                    alt={creator.display_name || creator.creator_name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-neutral-950 truncate tracking-tight text-xs group-hover/author:text-black transition-colors">
                                    {creator.display_name || creator.creator_name}
                                  </h4>
                                  <p className="text-[9px] text-neutral-400 font-mono font-bold leading-none mt-0.5">
                                    @{creator.creator_name}
                                  </p>
                                </div>
                              </a>

                              <div className="flex items-center gap-1.5 text-neutral-400 select-none">
                                <Clock size={11} />
                                <span className="text-[9px] font-bold font-mono">
                                  {formatRelativeTime(log.created_at)}
                                </span>
                              </div>
                            </div>

                            {/* WIP Content */}
                            <div className="space-y-2">
                              <h3 className="text-sm md:text-base font-bold text-neutral-900 tracking-tight">
                                {log.title}
                              </h3>
                              {log.description && (
                                <p className="text-[12px] text-neutral-600 font-medium leading-relaxed whitespace-pre-wrap">
                                  {cleanMetadata(log.description)}
                                </p>
                              )}
                            </div>

                            {/* References & Links */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 select-none">
                              {log.project && (
                                <a 
                                  href={projectUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/50 rounded-xl text-[10px] font-bold text-neutral-500 hover:text-black transition-all duration-300 magnetic-target"
                                >
                                  <Sparkles size={11} className="text-[#FF424D]" />
                                  <span className="truncate max-w-[150px]">프로젝트: {cleanProjectTitle(log.project.title)}</span>
                                  <ArrowUpRight size={10} />
                                </a>
                              )}
                              <a 
                                href={portfolioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[9px] font-black tracking-wider uppercase transition-colors duration-300 magnetic-target"
                              >
                                <span>작가 홈</span>
                                <ArrowUpRight size={9} />
                              </a>
                            </div>
                          </div>

                          {/* Right image/media column if exists */}
                          {log.media_url && (
                            <div className="w-full md:w-48 shrink-0 aspect-[4/3] relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200/40 group-hover:border-neutral-900 transition-colors duration-500">
                              <Image 
                                src={log.media_url}
                                alt={log.title}
                                fill
                                className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                              />
                            </div>
                          )}

                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-24 bg-white border border-neutral-200/80 rounded-[32px] max-w-md mx-auto p-8 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                  <div className="w-12 h-12 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                    <Activity size={22} className="animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-neutral-900">검색 조건에 맞는 작업 로그가 없습니다</h3>
                    <p className="text-xs text-neutral-500 font-medium">검색어를 변경하여 다시 시도해 주세요.</p>
                  </div>
                </div>
              )
            ) : (
              // CREATORS DIRECTORY GRID
              <>
                {/* 초성 / A–Z 인덱스 점프 */}
                {availableInitials.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mb-8">
                    <button
                      onClick={() => setWithFlip(() => setActiveInitial(null))}
                      className={`min-w-[28px] h-7 px-2 rounded-lg text-[11px] font-black transition-all magnetic-target ${
                        !effectiveInitial ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'
                      }`}
                    >
                      전체
                    </button>
                    {availableInitials.map((init) => (
                      <button
                        key={init}
                        onClick={() => setWithFlip(() => setActiveInitial((p) => (p === init ? null : init)))}
                        className={`min-w-[28px] h-7 px-1.5 rounded-lg text-[11px] font-black transition-all magnetic-target ${
                          effectiveInitial === init ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'
                        }`}
                      >
                        {init}
                      </button>
                    ))}
                  </div>
                )}

                {officialCreators.length + generalCreators.length > 0 ? (
                <div className="space-y-12">
                  {/* 공식 크리에이터 */}
                  {officialCreators.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-neutral-200/30 pb-3 text-left">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <h2 className="text-lg font-black tracking-tight text-neutral-900">공식 크리에이터 (Official Creators)</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {officialCreators.map((creator) => renderCreatorCard(creator))}
                      </div>
                    </div>
                  )}

                  {/* 일반 크리에이터 */}
                  {generalCreators.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-neutral-200/30 pb-3 text-left">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-neutral-400" />
                        <h2 className="text-lg font-black tracking-tight text-neutral-900">일반 크리에이터 (General Creators)</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {generalCreators.map((creator) => renderCreatorCard(creator))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-24 bg-white border border-neutral-200/80 rounded-[32px] max-w-md mx-auto p-8 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                  <div className="w-12 h-12 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                    <Compass size={22} className="animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-neutral-900">검색 조건에 맞는 크리에이터가 없습니다</h3>
                    <p className="text-xs text-neutral-500 font-medium">검색어나 인덱스를 변경하여 다시 시도해 주세요.</p>
                  </div>
                </div>
              )}
              </>
            )}

          </main>

        </div>

      </div>
      <CustomCursor />
    </div>
  )
}

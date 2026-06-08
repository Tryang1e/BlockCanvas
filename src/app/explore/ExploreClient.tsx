'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Compass, Users, ArrowUpRight, Clock, Sparkles, Filter, CheckCircle2, Activity, ChevronDown } from 'lucide-react'
import { gsap } from 'gsap'
import CustomCursor from '@/components/ui/CustomCursor'
import UserSidebar from '@/components/layout/UserSidebar'

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
  content: string | null
  created_at: Date
  category_id: string | null
  view_count: number
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

// Default categories (excluding Architecture and Interior as requested)
const defaultCategories = [
  { id: 'all', name: '모두 보기', slug: 'all' },
  { id: 'design', name: '기획 및 디자인 (Design)', slug: 'design' },
  { id: 'graphics', name: '3D 그래픽 (3D Graphics)', slug: 'graphics' },
  { id: 'dev', name: '개발 및 시스템 (Dev)', slug: 'dev' }
]

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

export default function ExploreClient({
  initialCreators,
  initialProjects,
  initialWipLogs = [],
  categories = [],
  userProfile,
}: ExploreClientProps) {
  const [activeTab, setActiveTab] = useState<'feed' | 'wip' | 'creators'>('feed')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest')
  const [commissionOnly, setCommissionOnly] = useState(false)
  
  const [filteredProjects, setFilteredProjects] = useState<FeedProject[]>(initialProjects)
  const [filteredCreators, setFilteredCreators] = useState<CreatorProfile[]>(initialCreators)
  const [filteredWipLogs, setFilteredWipLogs] = useState<WipLogWithProfile[]>(initialWipLogs)
  
  const [baseDomain, setBaseDomain] = useState('craftopia.work')
  const [protocol, setProtocol] = useState('https:')

  // Filter categories to remove Architecture/Interior from DB categories if any exist
  const categoriesList = categories.length > 0
    ? [
        { id: 'all', name: '모두 보기', slug: 'all' },
        ...categories.filter(c => {
          const name = c.name.toLowerCase()
          return !name.includes('건축') && !name.includes('architecture') && !name.includes('인테리어') && !name.includes('interior')
        })
      ]
    : defaultCategories

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

  // Live filter and sort projects, creators, and WIP logs
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase()

    // 1. Filter and Sort Projects
    let nextProjects = initialProjects.filter(project => {
      const title = cleanProjectTitle(project.title).toLowerCase()
      const desc = cleanMetadata(project.description).toLowerCase()
      const creatorName = (project.creator.display_name || '').toLowerCase()
      const creatorHandle = (project.creator.creator_name || '').toLowerCase()

      const isSearchMatch = !term ||
        title.includes(term) ||
        desc.includes(term) ||
        creatorName.includes(term) ||
        creatorHandle.includes(term)

      const isCategoryMatch = selectedCategory === 'all' || project.category_id === selectedCategory

      return isSearchMatch && isCategoryMatch
    })

    if (sortBy === 'popular') {
      nextProjects = [...nextProjects].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    } else {
      nextProjects = [...nextProjects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    setFilteredProjects(nextProjects)

    // 2. Filter Creators
    const nextCreators = initialCreators.filter(creator => {
      const name = (creator.display_name || '').toLowerCase()
      const handle = (creator.creator_name || '').toLowerCase()
      const headline = (creator.portfolios?.headline || '').toLowerCase()
      const about = (creator.portfolios?.about_text || '').toLowerCase()

      const isSearchMatch = !term ||
        name.includes(term) ||
        handle.includes(term) ||
        headline.includes(term) ||
        about.includes(term)

      let isCategoryMatch = selectedCategory === 'all'
      if (selectedCategory !== 'all') {
        const categoryObj = categoriesList.find(c => c.id === selectedCategory)
        const categoryName = categoryObj ? categoryObj.name.toLowerCase() : ''
        
        const hasProjectWithCategory = creator.projects.some(p => p.category_id === selectedCategory)
        const textContainsCategory = headline.includes(categoryName) || about.includes(categoryName)
        
        isCategoryMatch = hasProjectWithCategory || textContainsCategory
      }

      const isCommissionMatch = !commissionOnly || creator.commission_open

      return isSearchMatch && isCategoryMatch && isCommissionMatch
    })
    setFilteredCreators(nextCreators)

    // 3. Filter WIP Logs
    const nextWipLogs = initialWipLogs.filter(log => {
      const title = log.title.toLowerCase()
      const desc = cleanMetadata(log.description).toLowerCase()
      const creatorName = (log.profile.display_name || '').toLowerCase()
      const creatorHandle = (log.profile.creator_name || '').toLowerCase()

      const isSearchMatch = !term ||
        title.includes(term) ||
        desc.includes(term) ||
        creatorName.includes(term) ||
        creatorHandle.includes(term)

      let isCategoryMatch = selectedCategory === 'all'
      if (selectedCategory !== 'all') {
        isCategoryMatch = log.project?.category_id === selectedCategory
      }

      return isSearchMatch && isCategoryMatch
    })
    setFilteredWipLogs(nextWipLogs)

  }, [searchTerm, selectedCategory, sortBy, commissionOnly, initialProjects, initialCreators, initialWipLogs, categoriesList])

  // GSAP Magnetic Effect
  useEffect(() => {
    const magneticElements = document.querySelectorAll('.magnetic-target')
    const handlers: { el: Element; leave: () => void; move: (e: MouseEvent) => void }[] = []

    magneticElements.forEach((el) => {
      const onMouseLeave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'power2.out' })
      }
      const onMouseMoveMagnetic = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width / 2
        const y = e.clientY - rect.top - rect.height / 2
        gsap.to(el, {
          x: x * 0.35,
          y: y * 0.35,
          duration: 0.2,
          ease: 'power2.out'
        })
      }
      el.addEventListener('mouseleave', onMouseLeave)
      el.addEventListener('mousemove', onMouseMoveMagnetic as any)
      handlers.push({ el, leave: onMouseLeave, move: onMouseMoveMagnetic })
    })

    return () => {
      handlers.forEach(({ el, leave, move }) => {
        el.removeEventListener('mouseleave', leave)
        el.removeEventListener('mousemove', move as any)
        gsap.set(el, { x: 0, y: 0 })
      })
    }
  }, [activeTab, filteredProjects, filteredCreators, filteredWipLogs])

  const officialCreators = filteredCreators.filter(c => c.role === 'creator' || c.role === 'admin')
  const generalCreators = filteredCreators.filter(c => c.role !== 'creator' && c.role !== 'admin')

  const renderCreatorCard = (creator: CreatorProfile) => {
    const portfolioUrl = `${protocol}//${creator.creator_name}.${baseDomain}`
    const avatarSrc = creator.avatar_url || '/default_avatar.png'
    const projects = creator.projects || []
    const bannerSrc = creator.portfolios?.banner_url || '/default_banner.png'

    return (
      <div 
        key={creator.id}
        className="group bg-white border border-neutral-200/80 rounded-[32px] overflow-hidden flex flex-col hover:border-black hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)] transition-all duration-500 hover:-translate-y-1.5"
      >
        <div className="h-52 bg-neutral-100 flex gap-1 p-1 shrink-0 relative overflow-hidden">
          {projects.length >= 3 ? (
            <div className="w-full h-full flex gap-1 rounded-t-[26px] overflow-hidden">
              <div className="w-2/3 h-full relative overflow-hidden bg-neutral-200">
                <Image 
                  src={projects[0].thumbnail_url || '/default_banner.png'} 
                  alt={projects[0].title}
                  fill
                  className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                />
              </div>
              <div className="w-1/3 h-full flex flex-col gap-1">
                <div className="h-1/2 relative overflow-hidden bg-neutral-200">
                  <Image 
                    src={projects[1].thumbnail_url || '/default_banner.png'} 
                    alt={projects[1].title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="h-1/2 relative overflow-hidden bg-neutral-200">
                  <Image 
                    src={projects[2].thumbnail_url || '/default_banner.png'} 
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
                  src={projects[0].thumbnail_url || '/default_banner.png'} 
                  alt={projects[0].title}
                  fill
                  className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
                />
              </div>
              <div className="w-1/2 h-full relative overflow-hidden bg-neutral-200">
                <Image 
                  src={projects[1].thumbnail_url || '/default_banner.png'} 
                  alt={projects[1].title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          ) : projects.length === 1 ? (
            <div className="w-full h-full relative rounded-t-[26px] overflow-hidden bg-neutral-200">
              <Image 
                src={projects[0].thumbnail_url || '/default_banner.png'} 
                alt={projects[0].title}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
              />
            </div>
          ) : (
            <div className="w-full h-full relative rounded-t-[26px] overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 flex items-center justify-center p-6 text-center select-none">
              <Image 
                src={bannerSrc}
                alt="Fallback Banner"
                fill
                className="object-cover opacity-30 group-hover:scale-[1.03] transition-transform duration-700"
              />
              <div className="relative z-10 space-y-1 opacity-60">
                <Sparkles className="h-5 w-5 text-white mx-auto animate-pulse" />
                <span className="text-[8px] text-white tracking-widest font-bold uppercase block">BlockCanvas</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-1 relative bg-white">
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
                {(creator.role === 'creator' || creator.role === 'admin') && (
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
                  creator.role === 'creator'
                    ? 'bg-blue-50 text-blue-600 border border-blue-200/50'
                    : creator.role === 'admin'
                      ? 'bg-purple-50 text-purple-600 border border-purple-200/50'
                      : 'bg-neutral-50 text-neutral-500 border border-neutral-200/50'
                }`}>
                  {creator.role === 'creator' ? 'Official' : creator.role === 'admin' ? 'Admin' : 'Creator'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 font-medium text-left leading-relaxed line-clamp-2 h-9 mb-4">
            {creator.portfolios?.headline || '이 크리에이터는 아직 한 줄 소개를 작성하지 않았습니다.'}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100 mt-auto select-none">
            {/* Commission Badge (Only show if open. Remove closed display completely) */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold min-h-[1.5rem]">
              {creator.commission_open && (
                <>
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  <span className="text-emerald-700">의뢰 가능</span>
                </>
              )}
            </div>

            <a 
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-black text-black hover:text-[#3b82f6] flex items-center gap-0.5 group/link magnetic-target"
            >
              <span>포트폴리오 방문</span>
              <ArrowUpRight size={10} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
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
            <span className="font-extrabold text-sm tracking-widest uppercase text-black">
              BLOCKCANVAS
            </span>
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
        
        {/* Layout Wrapper: Left Sidebar Filter / Right Grid Content */}
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* 1. Left Sidebar Filter Panel (Behance layout) */}
          <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6 bg-white border border-neutral-200/80 rounded-[32px] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.02)] h-fit relative">
            
            {/* Tab switch buttons */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-3">탐색 카테고리</h3>
              <button
                onClick={() => { setActiveTab('feed'); setSelectedCategory('all') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all magnetic-target ${
                  activeTab === 'feed'
                    ? 'bg-black text-white shadow-md'
                    : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'
                }`}
              >
                <Compass size={16} />
                <span>최신 작품 둘러보기</span>
              </button>
              <button
                onClick={() => { setActiveTab('wip'); setSelectedCategory('all') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all magnetic-target ${
                  activeTab === 'wip'
                    ? 'bg-black text-white shadow-md'
                    : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'
                }`}
              >
                <Activity size={16} />
                <span>진행 중인 작업 (WIP)</span>
              </button>
              <button
                onClick={() => { setActiveTab('creators'); setSelectedCategory('all') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all magnetic-target ${
                  activeTab === 'creators'
                    ? 'bg-black text-white shadow-md'
                    : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'
                }`}
              >
                <Users size={16} />
                <span>크리에이터 디렉토리</span>
              </button>
            </div>

            {/* Search Input Box */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">실시간 검색</h3>
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'feed' 
                      ? '작품, 태그, 작가 검색...' 
                      : activeTab === 'wip'
                        ? '진행 작업, 작가 검색...'
                        : '크리에이터 검색...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-neutral-50 border border-neutral-200 focus:bg-white rounded-xl focus:outline-none focus:border-black transition-all"
                />
              </div>
            </div>

          </aside>

          {/* 2. Right Content Grid */}
          <main className="flex-1 min-w-0">
            
            {/* Header Title with Signature Red Dot */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-5 border-b border-neutral-200/40 gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 select-none">
                  Explore<span className="text-[#FF424D]">.</span>
                </h1>
                <p className="text-xs text-neutral-500 font-medium mt-1.5">
                  {activeTab === 'feed' 
                    ? '크리에이터들이 선보이는 하이엔드 최신 포트폴리오 컬렉션' 
                    : activeTab === 'wip'
                      ? '실시간으로 업로드되는 프로젝트 빌드 및 제작 현황'
                      : '플랫폼에서 활동 중인 크리에이터 프로필 디렉토리'}
                </p>
              </div>

              {/* Sorting controls for Feed tab */}
              {activeTab === 'feed' && (
                <div className="flex items-center gap-1 bg-neutral-100 border border-neutral-200/40 p-1 rounded-xl w-fit self-start sm:self-auto select-none">
                  <button
                    onClick={() => setSortBy('latest')}
                    className={`px-3.5 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-lg transition-all duration-300 magnetic-target ${
                      sortBy === 'latest'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    최신순
                  </button>
                  <button
                    onClick={() => setSortBy('popular')}
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
            </div>

            {activeTab === 'feed' ? (
              // DISCOVER PROJECTS GRID
              filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProjects.map((project, idx) => {
                    const creator = project.creator
                    const portfolioUrl = `${protocol}//${creator.creator_name}.${baseDomain}`
                    const projectUrl = `${portfolioUrl}/project/${project.id}`
                    const creatorAvatar = creator.avatar_url || '/default_avatar.png'
                    const cleanTitle = cleanProjectTitle(project.title)
                    const fallbackGradient = premiumGradients[idx % premiumGradients.length]

                    return (
                      <div key={project.id} className="group flex flex-col space-y-3">
                        <a 
                          href={projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-[4/3] rounded-[24px] overflow-hidden bg-neutral-900 border border-neutral-200/80 group-hover:border-black group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all duration-500 select-none block"
                        >
                          {(() => {
                            const projectThumbnail = project.thumbnail_url || getFirstImageFromContent(project.content)
                            if (projectThumbnail) {
                              return (
                                <Image
                                  src={projectThumbnail}
                                  alt={cleanTitle}
                                  fill
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
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                            <div className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg text-[9px] font-black tracking-widest text-black flex items-center gap-1">
                              <span>상세 작품 보기</span>
                              <ArrowUpRight size={10} />
                            </div>
                          </div>
                        </a>

                        <div className="flex items-start justify-between px-1 text-left">
                          <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                            <a 
                              href={projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-neutral-900 hover:text-[#3b82f6] text-[14px] leading-tight block truncate tracking-tight transition-colors"
                            >
                              {cleanTitle}
                            </a>
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

                          <div className="flex items-center gap-1.5 text-neutral-400 shrink-0 pt-0.5 select-none">
                            <Clock size={11} />
                            <span className="text-[9px] font-bold font-mono">
                              {formatRelativeTime(project.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-24 bg-white border border-neutral-200/80 rounded-[32px] max-w-md mx-auto p-8 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                  <div className="w-12 h-12 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                    <Compass size={22} className="animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-neutral-900">최근 업로드된 작품이 없습니다</h3>
                    <p className="text-xs text-neutral-500 font-medium">카테고리 필터 또는 검색어를 바꾼 뒤 다시 확인해보세요.</p>
                  </div>
                </div>
              )
            ) : activeTab === 'wip' ? (
              // WIP LOGS TIMELINE FEED
              filteredWipLogs.length > 0 ? (
                <div className="relative border-l border-neutral-200/60 ml-4 md:ml-6 pl-6 md:pl-8 space-y-8 py-2">
                  {filteredWipLogs.map((log) => {
                    const creator = log.profile
                    const portfolioUrl = `${protocol}//${creator.creator_name}.${baseDomain}`
                    const creatorAvatar = creator.avatar_url || '/default_avatar.png'
                    const projectUrl = log.project ? `${portfolioUrl}/project/${log.project.id}` : null

                    return (
                      <div key={log.id} className="relative group">
                        {/* Timeline point dot */}
                        <div className="absolute -left-[31px] md:-left-[39px] top-2.5 w-3.5 h-3.5 rounded-full bg-white border-[3px] border-neutral-900 group-hover:bg-[#FF424D] group-hover:border-[#FF424D] transition-colors duration-300" />
                        
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
                    <p className="text-xs text-neutral-500 font-medium">검색어나 카테고리 필터를 변경하여 다시 시도해 주세요.</p>
                  </div>
                </div>
              )
            ) : (
              // CREATORS DIRECTORY GRID
              filteredCreators.length > 0 ? (
                <div className="space-y-12">
                  {/* Official Creators Section */}
                  {officialCreators.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-neutral-200/30 pb-3 text-left">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <h2 className="text-lg font-black tracking-tight text-neutral-900">공식 크리에이터 (Official Creators)</h2>
                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200/30">
                          {officialCreators.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {officialCreators.map((creator) => renderCreatorCard(creator))}
                      </div>
                    </div>
                  )}

                  {/* General Creators Section */}
                  {generalCreators.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-neutral-200/30 pb-3 text-left">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-neutral-400" />
                        <h2 className="text-lg font-black tracking-tight text-neutral-900">일반 크리에이터 (General Creators)</h2>
                        <span className="text-[10px] font-extrabold bg-neutral-50 text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-200/50">
                          {generalCreators.length}
                        </span>
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
                    <p className="text-xs text-neutral-500 font-medium">검색어나 카테고리 필터를 변경하여 다시 시도해 주세요.</p>
                  </div>
                </div>
              )
            )}

          </main>

        </div>

      </div>
      <CustomCursor />
    </div>
  )
}

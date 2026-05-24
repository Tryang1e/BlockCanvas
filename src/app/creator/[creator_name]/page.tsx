import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import ProjectActionButtons from '@/components/creator/ProjectActionButtons'
import BannerUploadButton from '@/components/creator/BannerUploadButton'
import AvatarUploadButton from '@/components/creator/AvatarUploadButton'
import DraggablePortfolio from '@/components/creator/DraggablePortfolio'
import { notFound } from 'next/navigation'
import JumpingScrollButton from '@/components/ui/JumpingScrollButton'
import BusinessCardContact from '@/components/creator/BusinessCardContact'
import HeroAnimator from '@/components/creator/HeroAnimator'
import CustomCursor from '@/components/ui/CustomCursor'
import MagneticEffect from '@/components/ui/MagneticEffect'
import ScrollFillText from '@/components/ui/ScrollFillText'
import CreatorNavbar from '@/components/layout/CreatorNavbar'
import ThemeColorEditor from '@/components/creator/ThemeColorEditor'
import ThemeEffectEditor from '@/components/creator/ThemeEffectEditor'
import ScrollSpyNav from '@/components/creator/ScrollSpyNav'
import { PreviewLinkCard } from '@/components/ui/preview-link-card'
import DynamicBackground from '@/components/ui/backgrounds/DynamicBackground'
import { ScrollProgressProvider, ScrollProgress } from '@/components/ui/ScrollProgress'

// 테마 종합 디자인 설정 파서 (효과, 카드 모서리, 섹션 모서리, 이미지 모서리, 그리드 갭)
const parseThemeDesignConfig = (themeBgEffect: string | null | undefined) => {
  let effect = 'none'
  let cardRound = false
  let sectionRound = false
  let imageRound = false
  let gridGap = 24

  if (themeBgEffect) {
    const parts = themeBgEffect.split('|')
    effect = parts[0] || 'none'
    parts.forEach(part => {
      if (part.startsWith('card:')) {
        cardRound = part.replace('card:', '') === 'round'
      }
      if (part.startsWith('section:')) {
        sectionRound = part.replace('section:', '') === 'round'
      }
      if (part.startsWith('image:')) {
        imageRound = part.replace('image:', '') === 'round'
      }
      if (part.startsWith('gap:')) {
        const val = parseInt(part.replace('gap:', ''), 10)
        if (!isNaN(val)) gridGap = val
      }
    })
  }

  return { effect, cardRound, sectionRound, imageRound, gridGap }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creator_name: string }>
}): Promise<Metadata> {
  const { creator_name } = await params

  // 1. Fetch Creator Profile alongside their Portfolio info to build dynamic metadata
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { portfolios: true }
  })

  if (!profile) {
    return {
      title: 'BlockCanvas Creator',
      description: 'BlockCanvas에서 드래그 앤 드롭으로 만드는 나만의 포트폴리오 캔버스',
    }
  }

  const nickname = profile.display_name || creator_name
  const portfolio = profile.portfolios
  const aboutText = portfolio?.about_text || portfolio?.headline || `BlockCanvas에서 창작 활동을 펼치는 ${nickname} 크리에이터의 아름다운 작품 캔버스입니다.`
  const avatarUrl = profile.avatar_url || '/logo/plains/logo.png' // 디폴트 아바타/로고 백업

  // 디스코드 OG 봇이 상대 경로를 수집하지 못하므로, 로컬 호스트 호스트명을 지능 결합하여 전송!
  const absoluteAvatarUrl = avatarUrl.startsWith('http') 
    ? avatarUrl 
    : `http://craftopia.work:9000${avatarUrl}`

  return {
    title: `${nickname} | BlockCanvas Portfolio`,
    description: aboutText,
    openGraph: {
      title: `${nickname} | BlockCanvas Portfolio`,
      description: aboutText,
      url: `http://craftopia.work:9000/creator/${creator_name}`,
      siteName: 'BlockCanvas',
      images: [
        {
          url: absoluteAvatarUrl,
          width: 800,
          height: 800,
          alt: `${nickname} 프로필`,
        },
      ],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${nickname} | BlockCanvas Portfolio`,
      description: aboutText,
      images: [absoluteAvatarUrl],
    },
  }
}

export default async function CreatorPortfolioPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  const isOwner = session === creator_name

  // 로그인한 유저 본인의 프로필 정보가 타인 포트폴리오 구경 시에도 헤더에 정상 매핑되도록 추가 쿼리 수행
  let viewerProfile = null
  if (session) {
    viewerProfile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
  }

  // 1. Fetch Creator Profile alongside their Portfolio info
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { portfolios: true }
  })

  console.log('--- DEBUG PROFILE DATA ---')
  console.log(JSON.stringify(profile, null, 2))
  console.log('--------------------------')

  if (!profile) {
    notFound()
  }

  const hasPortfolio = !!profile.portfolios
  const isPublished = profile.portfolios?.is_published ?? true

  // If portfolio is not active or not published, handle it
  if (!hasPortfolio || (!isPublished && !isOwner)) {
    if (isOwner && !hasPortfolio) {
      // Owner trying to see their own portfolio without activating it
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 flex-col gap-4">
          <h1 className="text-2xl font-bold">포트폴리오 사이트가 아직 활성화되지 않았습니다.</h1>
          <p className="text-neutral-500">대시보드에서 포트폴리오를 생성해주세요.</p>
          <Link href={`/creator/${creator_name}/dashboard/portfolio`} className="px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-neutral-800 transition-colors">
            대시보드로 가기
          </Link>
        </div>
      )
    } else {
      // Visitor trying to see inactive or unpublished portfolio
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 flex-col gap-4">
          <h1 className="text-2xl font-bold">현재 비공개 상태인 포트폴리오입니다.</h1>
          <p className="text-neutral-500">크리에이터가 포트폴리오를 비공개 처리했거나 준비 중입니다.</p>
          <Link href="/" className="px-6 py-3 bg-neutral-200 text-neutral-800 rounded-lg font-bold hover:bg-neutral-300 transition-colors">
            메인으로 돌아가기
          </Link>
        </div>
      )
    }
  }

  // 2. Fetch Projects associated with this creator
  const projectsData = await prisma.project.findMany({
    where: { creator_id: profile.id },
    orderBy: [
      { sort_order: 'asc' },
      { created_at: 'desc' }
    ]
  })

  // Map Prisma projects to expected format (if needed)
  const projects = projectsData.map(p => ({
    ...p,
    category: { name: p.category_id || 'Uncategorized' },
    likes_count: 0
  }))

  // 3. Fetch Portfolio Sections
  const sectionsData = await prisma.portfolioSection.findMany({
    where: { creator_id: profile.id },
    orderBy: { sort_order: 'asc' }
  })

  let sections = sectionsData
  if (sections.length === 0) {
    // Automatically create a default section for the creator
    const newSection = await prisma.portfolioSection.create({
      data: {
        creator_id: profile.id,
        name: 'Main Projects',
        sort_order: 0
      }
    })
    sections = [newSection]
  }

  // 4. Fetch WIP 메이킹 로그 데이터
  const wipLogs = await prisma.wipLog.findMany({
    where: { creator_id: profile.id },
    orderBy: { created_at: 'desc' },
    include: {
      project: true
    }
  })

  const portfolio = profile.portfolios

  // Parse sns_settings JSON string if it exists
  let snsSettings = { discord: true, twitter: true, youtube: true, instagram: true, patreon: false }
  if (portfolio?.sns_settings) {
    try {
      snsSettings = typeof portfolio.sns_settings === 'string' ? JSON.parse(portfolio.sns_settings) : portfolio.sns_settings
    } catch (e) {
      console.error('Failed to parse sns_settings', e)
    }
  }

  const profileData = {
    creator_name: profile.creator_name,
    display_name: profile.display_name,
    discord_id: profile.discord_id || '',
    headline: portfolio?.headline || '',
    about_text: portfolio?.about_text || '',
    contact_email: portfolio?.contact_email || profile.email || '',
    youtube_url: portfolio?.youtube_url || '',
    twitter_url: portfolio?.twitter_url || '',
    instagram_url: portfolio?.instagram_url || '',
    patreon_url: portfolio?.patreon_url || '',
    sns_settings: snsSettings,
    banner_url: portfolio?.banner_url || '',
    theme_bg_color: portfolio?.theme_bg_color || '#222222'
  }

  // 테마 종합 디자인 복합 설정 파싱
  const designConfig = parseThemeDesignConfig(portfolio?.theme_bg_effect)

  return (
    <ScrollProgressProvider global>
      <ScrollProgress />
      <div 
        className="min-h-screen text-neutral-900 font-sans relative overflow-x-hidden dark:text-neutral-50"
        style={{
          ['--card-corner-radius' as any]: designConfig.cardRound ? '16px' : '0px',
          ['--section-corner-radius' as any]: designConfig.sectionRound ? '16px' : '0px',
          ['--editor-image-corner-radius' as any]: designConfig.imageRound ? '16px' : '0px',
          ['--grid-gap' as any]: `${designConfig.gridGap}px`,
        }}
      >
      {/* Site-wide fixed background layer */}
      <div className="fixed inset-0 -z-20 transition-colors" style={{ backgroundColor: profileData.theme_bg_color }} />
      {/* Dark mode overlay to darken the custom background for text readability */}
      <div className="fixed inset-0 -z-20 hidden dark:block bg-black/85 pointer-events-none transition-opacity" />
      <DynamicBackground effect={designConfig.effect} />
      
      {/* Navigation Buttons */}
      <JumpingScrollButton />
      <ScrollSpyNav sections={sections} />

      <CustomCursor />
      <HeroAnimator />
      
      {/* Top Navbar (Fixed across the whole page) */}
      <CreatorNavbar 
        userName={profileData.display_name || profileData.creator_name}
        userHandle={profileData.creator_name}
        avatarUrl={profile.avatar_url || ''}
        viewerSession={session}
        viewerName={viewerProfile?.display_name || session}
        viewerAvatarUrl={viewerProfile?.avatar_url || ''}
      />

      {/* Hero Header */}
      <header className="hero-container sticky top-0 w-full flex flex-col text-white group pt-20 z-0 min-h-[600px] md:min-h-[750px] overflow-hidden">

          {/* Banner Container (Fixed Height) */}
          <div className="absolute top-0 left-0 w-full h-[450px] md:h-[600px] overflow-hidden z-0" style={{ perspective: '1000px', WebkitMaskImage: 'linear-gradient(to top, transparent, black 15%)', maskImage: 'linear-gradient(to top, transparent, black 15%)' }}>
            <img 
              src={profileData.banner_url || '/example1.png'} 
              alt="Banner" 
              className="hero-banner-image absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity" 
            />
            <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: `linear-gradient(to top, ${profileData.theme_bg_color}, transparent)` }} />
          </div>

        {/* Banner Edit Buttons (Shows on Hover - Bottom Right of Banner) */}
        {isOwner && (
          <div className="absolute top-[390px] md:top-[540px] right-8 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
            <BannerUploadButton creatorName={creator_name} currentBanner={profileData.banner_url} />
          </div>
        )}

        {/* SETTINGS & THEME BUTTONS (Absolute Top Right) */}
        {isOwner && (
          <div className="absolute top-20 right-8 z-30 flex flex-col gap-3 items-end">
            <MagneticEffect strength={15}>
              <Link
                href={`/creator/${creator_name}/settings`}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest backdrop-blur-sm transition-all shadow-md block"
              >
                설정
              </Link>
            </MagneticEffect>
            <div className="flex items-center gap-2">
              <ThemeEffectEditor creatorName={creator_name} currentEffect={portfolio?.theme_bg_effect || null} />
              <ThemeColorEditor creatorName={creator_name} currentThemeColor={profileData.theme_bg_color} currentThemeEffect={portfolio?.theme_bg_effect || null} />
            </div>
          </div>
        )}

        {/* Content Below Banner */}
        <div className="relative z-20 text-center flex flex-col items-center mt-[250px] md:mt-[400px] w-full px-4 pb-16 pointer-events-auto">

          {/* Avatar Area */}
          <div className="hero-avatar mb-6 -mt-16 md:-mt-20">
            <MagneticEffect strength={30}>
              <div>
                {isOwner ? (
                  <AvatarUploadButton creatorName={creator_name} currentAvatar={profile.avatar_url || ''} />
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl overflow-hidden bg-neutral-200">
                    <img 
                      src={profile.avatar_url || '/example5.png'} 
                      alt={profile.display_name || creator_name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                )}
              </div>
            </MagneticEffect>
          </div>

          <h1 className="hero-title text-4xl md:text-6xl font-extrabold tracking-tight mb-3 drop-shadow-md capitalize">
            {profile.display_name}
          </h1>

          <div className="hero-subtitle flex items-center gap-4 mb-4">
            <div className="hidden sm:block h-[1px] w-8 bg-white/30" />
            <p className="text-base md:text-lg font-light tracking-wide text-neutral-200">{profileData.headline || 'Minecraft Level Designer'}</p>
            <div className="hidden sm:block h-[1px] w-8 bg-white/30" />
          </div>

          <div className="hero-details text-xs md:text-sm font-medium text-neutral-400 space-y-1 mb-6 tracking-wider">
            <p>Contact : {profileData.contact_email}</p>
            {profile.discord_id && <p>Discord ID : {profile.discord_id}</p>}
          </div>

          {/* SNS Buttons */}
          <div className="hero-sns flex flex-wrap justify-center gap-3 mt-4">
            {profileData.youtube_url && profileData.sns_settings.youtube === true && (
              <MagneticEffect strength={20}>
                <PreviewLinkCard href={profileData.youtube_url} asChild>
                  <Link href={profileData.youtube_url} target="_blank" className="bg-[#FF0000] hover:bg-red-600 px-5 py-2 rounded-full font-bold transition-all shadow-md text-xs tracking-wider flex items-center gap-2">
                    ▶ YouTube
                  </Link>
                </PreviewLinkCard>
              </MagneticEffect>
            )}
            {profileData.twitter_url && profileData.sns_settings.twitter === true && (
              <MagneticEffect strength={20}>
                <PreviewLinkCard href={profileData.twitter_url} asChild>
                  <Link href={profileData.twitter_url} target="_blank" className="bg-black border border-neutral-700 hover:bg-neutral-800 px-5 py-2 rounded-full font-bold transition-all shadow-md text-xs tracking-wider flex items-center gap-2 text-white">
                    🐦 X (Twitter)
                  </Link>
                </PreviewLinkCard>
              </MagneticEffect>
            )}
            {profileData.instagram_url && profileData.sns_settings.instagram === true && (
              <MagneticEffect strength={20}>
                <PreviewLinkCard href={profileData.instagram_url} asChild>
                  <Link href={profileData.instagram_url} target="_blank" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 px-5 py-2 rounded-full font-bold transition-all shadow-md text-xs tracking-wider flex items-center gap-2 text-white">
                    📷 Instagram
                  </Link>
                </PreviewLinkCard>
              </MagneticEffect>
            )}
            {profileData.patreon_url && profileData.sns_settings.patreon === true && (
              <MagneticEffect strength={20}>
                <PreviewLinkCard href={profileData.patreon_url} asChild>
                  <Link href={profileData.patreon_url} target="_blank" className="bg-[#FF424D] hover:bg-red-500 px-5 py-2 rounded-full font-bold transition-all shadow-md text-xs tracking-wider flex items-center gap-2 text-white">
                    🧡 Patreon
                  </Link>
                </PreviewLinkCard>
              </MagneticEffect>
            )}
          </div>
        </div>
      </header>

      {/* Content wrapper that slides over the sticky header */}
      <div id="content-wrapper" className="relative z-10 w-full bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.15)] min-h-screen dark:bg-neutral-900">


        {/* Animated Boundary Line */}
        <div className="w-full h-[2px] bg-neutral-100 relative overflow-hidden">
          <div
            className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-neutral-400 to-transparent opacity-80"
            style={{ animation: 'shimmerSweep 3s infinite ease-in-out' }}
          />
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
        @keyframes shimmerSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}} />

        {/* Main Gallery Container */}
        <main id="portfolio-start" className="w-full max-w-[2000px] mx-auto mt-16 mb-24 px-4 sm:px-6 lg:px-8 scroll-mt-24">

          {/* About Text Section */}
          {profileData.about_text && (
            <div className="max-w-3xl mx-auto text-center mb-16 px-4 mt-8">
              <p className="text-neutral-500 leading-relaxed font-medium text-lg">&quot;{profileData.about_text}&quot;</p>
            </div>
          )}

          <DraggablePortfolio
            creatorId={profile.id}
            creatorName={creator_name}
            initialSections={sections}
            initialProjects={projects}
            initialWipLogs={wipLogs}
            isOwner={isOwner}
          />
        </main>
        
        <BusinessCardContact 
          profileData={profileData} 
          profile={profile} 
          footer_title={portfolio?.footer_title || undefined}
          footer_subtitle={portfolio?.footer_subtitle || undefined}
        />
      </div>
    </div>
    </ScrollProgressProvider>
  )
}

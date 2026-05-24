import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import SettingsForm from './SettingsForm'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (session !== creator_name) {
    redirect(`/creator/${creator_name}`)
  }

  // Fetch Creator Profile
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { portfolios: true }
  })

  if (!profile) {
    notFound()
  }

  const portfolio = profile.portfolios
  
  let snsSettings = { discord: true, twitter: true, youtube: true, instagram: true, patreon: false }
  if (portfolio?.sns_settings) {
    try {
      snsSettings = typeof portfolio.sns_settings === 'string' ? JSON.parse(portfolio.sns_settings) : portfolio.sns_settings
    } catch (e) {}
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
    footer_title: portfolio?.footer_title || '',
    footer_subtitle: portfolio?.footer_subtitle || '',
    theme_bg_color: portfolio?.theme_bg_color || '#222222',
    theme_bg_effect: portfolio?.theme_bg_effect || 'none'
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 pb-20 font-sans">
      {/* Top Navbar */}
      <nav className="w-full px-8 py-5 flex justify-between items-center bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
        <div className="flex gap-4 items-center">
          <Link href={`/creator/${creator_name}`} className="text-neutral-500 hover:text-black font-bold text-sm tracking-widest transition-colors flex items-center gap-2">
            <span>←</span> BACK TO PORTFOLIO
          </Link>
        </div>
        <div className="hidden sm:block font-black text-xl tracking-tighter">
          BlockCanvas <span className="font-light text-neutral-400">Settings</span>
        </div>
      </nav>

      {/* Main Settings Container */}
      <main className="max-w-4xl mx-auto mt-12 px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">설정 (Settings)</h1>
          <p className="text-neutral-500 font-medium">크리에이터 프로필 정보와 SNS 노출 여부를 관리하세요.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <SettingsForm profile={profileData} />
        </div>
      </main>
    </div>
  )
}

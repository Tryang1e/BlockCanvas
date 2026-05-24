'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import MagneticEffect from '@/components/ui/MagneticEffect'
import UserSidebar from './UserSidebar'
import { ThemeTogglerButton } from '@/components/ui/theme-toggler'

interface CreatorNavbarProps {
  userName: string
  userHandle: string
  avatarUrl: string
  viewerSession?: string
  viewerName?: string
  viewerAvatarUrl?: string
}

export default function CreatorNavbar({ 
  userName, 
  userHandle, 
  avatarUrl, 
  viewerSession,
  viewerName,
  viewerAvatarUrl 
}: CreatorNavbarProps) {
  const [bannerBottom, setBannerBottom] = useState(600)

  useEffect(() => {
    const handleScroll = () => {
      // 450px on mobile, 600px on desktop is the banner height.
      const bannerHeight = window.innerWidth >= 768 ? 600 : 450
      const bottom = Math.max(0, bannerHeight - window.scrollY)
      setBannerBottom(bottom)
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)
    // Initial check
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  // nav py-5 (20px) + link p-2 (8px) = 28px offset from top
  const clipHeight = Math.max(0, bannerBottom - 28)

  return (
    <nav className="fixed top-0 left-0 w-full z-[9999] px-4 md:px-8 py-4 md:py-5 flex justify-between items-center pointer-events-none">
      <div className="flex items-center pointer-events-auto">
        <MagneticEffect strength={15}>
          <Link href="/" className="relative grid group/logo p-2">

            {/* Base Logo (Red/Colored) - Visible when white logo is clipped */}
            <div 
              className="col-start-1 row-start-1 flex items-center gap-2"
              style={{
                clipPath: `inset(${clipHeight}px 0 0 0)`
              }}
            >
              <Image
                src="/logo_icon.png"
                alt="BlockCanvas Icon"
                width={40}
                height={40}
                className="h-9 w-auto object-contain group-hover/logo:scale-110 transition-transform duration-300"
              />
              <Image
                src="/logo_text.png"
                alt="BlockCanvas"
                width={120}
                height={32}
                className="h-6 w-auto object-contain hidden sm:block"
              />
            </div>

            {/* Top Logo (White) - Clipped to the banner area */}
            <div
              className="col-start-1 row-start-1 flex items-center gap-2 pointer-events-none"
              style={{
                clipPath: `inset(0 0 calc(100% - ${clipHeight}px) 0)`
              }}
            >
              <Image
                src="/logo_icon_white.png"
                alt="BlockCanvas Icon"
                width={40}
                height={40}
                className="h-9 w-auto object-contain group-hover/logo:scale-110 transition-transform duration-300"
              />
              <Image
                src="/logo_text.png"
                alt="BlockCanvas"
                width={120}
                height={32}
                className="h-6 w-auto object-contain hidden sm:block brightness-0 invert"
              />
            </div>

          </Link>
        </MagneticEffect>
      </div>
      <div className="flex items-center gap-4 pointer-events-auto">
        {viewerSession ? (
          <UserSidebar
            userName={viewerSession === userHandle ? userName : (viewerName || viewerSession)}
            userHandle={viewerSession}
            avatarUrl={viewerSession === userHandle ? avatarUrl : (viewerAvatarUrl || '')}
            isOwner={viewerSession === userHandle}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-white font-bold text-sm px-4 py-2 hover:text-neutral-300 transition-colors"
            >
              로그인
            </Link>
            {/* <Link 
              href="/login" 
              className="bg-white text-black font-bold text-sm px-4 py-2 rounded-full hover:bg-neutral-200 transition-colors shadow-lg"
            >
              회원가입
            </Link> */}
          </div>
        )}
      </div>
    </nav>
  )
}

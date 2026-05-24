'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

import { logout } from '@/app/actions/auth'
import Link from 'next/link'

export default function UserSidebar({ 
  userName = "사용자 이름", 
  userHandle = "user_id", 
  avatarUrl = "",
  isOwner = false
}: { 
  userName?: string, 
  userHandle?: string, 
  avatarUrl?: string,
  isOwner?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const MenuItem = ({ icon, text, hasArrow = false, onClick, className = "", type = "button" }: { icon: React.ReactNode, text: string, hasArrow?: boolean, onClick?: () => void, className?: string, type?: "button" | "submit" | "div" }) => {
    const content = (
      <>
        <div className="flex items-center gap-4">
          <div className="text-neutral-400 flex items-center justify-center w-6 h-6">
            {icon}
          </div>
          <span>{text}</span>
        </div>
        {hasArrow && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        )}
      </>
    )

    const baseClass = `flex items-center justify-between w-full px-4 py-2 hover:bg-[#3f3f3f] transition-colors text-sm text-white font-medium ${className}`

    if (type === "div") {
      return <div className={baseClass}>{content}</div>
    }

    return (
      <button type={type as "button" | "submit"} onClick={onClick} className={baseClass}>
        {content}
      </button>
    )
  }

  const Separator = () => <div className="w-full h-px bg-[#3f3f3f] my-2" />

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Avatar Button */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full overflow-hidden bg-teal-700 flex items-center justify-center text-white border border-neutral-700 hover:border-neutral-500 transition-colors shadow-lg relative"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-[300px] bg-[#282828] border border-[#3f3f3f] rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.5)] z-[100] text-white flex flex-col py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-[#717171] scrollbar-track-transparent">
          
          {/* Profile Section */}
          <div className="flex items-start gap-4 px-4 py-3">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-teal-700 flex items-center justify-center text-white mt-1 relative">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-base tracking-wide">{userName}</span>
              <span className="text-sm text-neutral-400 font-medium">@{userHandle}</span>
            </div>
          </div>

          <Separator />

          <Link href={`/creator/${userHandle}`}>
            <MenuItem 
              type="div"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>} 
              text="내 포트폴리오로 가기" 
            />
          </Link>
          <Link href={`/creator/${userHandle}/dashboard`}>
            <MenuItem 
              type="div"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>} 
              text="크리에이터 대시보드로 가기" 
            />
          </Link>
          <MenuItem 
            type="button"
            onClick={async () => {
              await logout()
            }}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>} 
            text="로그아웃" 
          />

          <Separator />
          <Link href={`/creator/${userHandle}/dashboard/settings`}>
            <MenuItem 
              type="div"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>} 
              text="설정" 
            />
          </Link>

          <Separator />

          <MenuItem 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>} 
            text="고객센터" 
          />
          <MenuItem 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>} 
            text="의견 보내기" 
          />

        </div>
      )}
    </div>
  )
}

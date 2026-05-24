'use client'

import React, { useEffect } from 'react'

interface TwitterFeedProps {
  xUrl: string | null
}

export default function TwitterFeed({ xUrl }: TwitterFeedProps) {
  useEffect(() => {
    // Load Twitter Widget script
    const script = document.createElement("script")
    script.src = "https://platform.twitter.com/widgets.js"
    script.async = true
    document.body.appendChild(script)
  }, [])

  if (!xUrl) {
    return (
      <div className="w-full max-w-3xl mx-auto my-24 p-8 bg-neutral-50 rounded-3xl border border-neutral-100 text-center text-neutral-400">
        <p className="font-medium">SNS 연동이 없습니다.</p>
        <p className="text-sm mt-2">프로필 설정에서 X(Twitter) 주소를 입력하시면 최신 피드가 여기에 표시됩니다.</p>
      </div>
    )
  }

  // Extract username from URL (e.g. https://twitter.com/username)
  // Handles twitter.com, x.com, etc.
  const usernameMatch = xUrl.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i)
  const username = usernameMatch ? usernameMatch[1] : null

  if (!username) {
    return (
      <div className="w-full max-w-3xl mx-auto my-24 p-8 bg-neutral-50 rounded-3xl border border-neutral-100 text-center text-neutral-400">
        <p>유효하지 않은 X(Twitter) 주소입니다.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto my-24 p-8 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-3">
          <span className="text-black text-3xl leading-none">𝕏</span> 
          Latest Updates
        </h3>
        <a 
          href={xUrl} 
          target="_blank" 
          rel="noreferrer"
          className="text-sm font-bold text-neutral-500 hover:text-black transition-colors"
        >
          @{username}
        </a>
      </div>
      
      {/* 
        data-tweet-limit: Restricts to recent tweets so it doesn't take up infinite space 
        data-chrome: Removes default borders and headers for a cleaner, custom integration
      */}
      <div className="h-[500px] overflow-y-auto rounded-xl custom-scrollbar border border-neutral-100 p-2">
        <a 
          className="twitter-timeline" 
          href={`https://twitter.com/${username}`}
          data-tweet-limit="3"
          data-chrome="noheader nofooter noborders transparent"
        >
          Loading latest tweets from @{username}...
        </a>
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { incrementProjectViewCount } from '@/app/actions/project'
import { Tweet } from 'react-tweet'
import ReactPlayer from 'react-player'
import HTMLRenderer from '@/components/ui/HTMLRenderer'
import { PreviewLinkCard } from '@/components/ui/preview-link-card'
import CreatorFooter from '@/components/layout/CreatorFooter'
import { ScrollProgressProvider, ScrollProgress } from '@/components/ui/ScrollProgress'

interface ProjectDetailsViewerProps {
  project: any
  widgets: any[]
  creatorName: string
  isModal?: boolean
  otherProjects?: any[]
  relatedType?: string
  profileData?: any
}

// [SIZE:WxH] 또는 [SIZE:W] 메타 지시어를 제거하여 렌더링용 순수 타이틀만 추출하는 헬퍼
const cleanProjectTitle = (title: string) => {
  if (!title) return ''
  return title.replace(/\[SIZE:[1-3](?:x[1-3])?\]/, '').trim()
}

export default function ProjectDetailsViewer({ project, widgets, creatorName, isModal = false, otherProjects = [], relatedType = 'creator', profileData }: ProjectDetailsViewerProps) {

  // Track View Count invisibly
  useEffect(() => {
    if (project?.id) {
      incrementProjectViewCount(project.id)
    }
  }, [project?.id])

  // Particle effect for 'icon' style buttons (Animate UI inspired)
  useEffect(() => {
    const handleIconClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[data-style="icon"]');
      if (!target) return;
      
      const rect = target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'absolute w-1.5 h-1.5 rounded-full pointer-events-none z-50';
        
        // Match button text or background color
        particle.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        particle.style.left = `${clickX}px`;
        particle.style.top = `${clickY}px`;
        
        target.appendChild(particle);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = 20 + Math.random() * 40;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        
        particle.animate([
          { transform: `translate(-50%, -50%) scale(1)`, opacity: 1 },
          { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
        ], {
          duration: 500 + Math.random() * 300,
          easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => particle.remove();
      }
    };

    document.addEventListener('click', handleIconClick);
    return () => document.removeEventListener('click', handleIconClick);
  }, [])

  const sliderRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -400, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 400, behavior: 'smooth' })
    }
  }

  return (
    <ScrollProgressProvider global={!isModal}>
      <ScrollProgress />
      <div className={`w-full flex flex-col ${isModal ? 'bg-white min-h-full md:min-h-0' : 'min-h-screen bg-[#fcfcfc]'}`}>

      {/* Top Header */}
      {!isModal && (
        <header className="h-16 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-50">
          <Link href={`/creator/${creatorName}`} className="font-bold text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="transition-transform group-hover:-translate-x-1">&larr;</span> 돌아가기
          </Link>
          <div className="font-extrabold text-neutral-800 tracking-tight text-lg">
            {project.creator.display_name}
          </div>
          <div className="w-16" /> {/* Spacer */}
        </header>
      )}

      {/* Minimal Title at the Top (Only for Page Route) */}
      {!isModal && (
        <div className="w-full max-w-[1440px] mx-auto text-center px-6 animate-in fade-in slide-in-from-top-4 duration-500 pt-16 pb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight leading-tight mb-2">{cleanProjectTitle(project.title)}</h1>
          {project.description && (
            <p className="text-sm sm:text-base text-neutral-500 max-w-2xl mx-auto whitespace-pre-wrap font-medium">
              {project.description}
            </p>
          )}
        </div>
      )}

      <main className={`w-full max-w-[1440px] mx-auto flex-grow pb-16 ${isModal ? 'pt-16 sm:pt-20' : ''}`}>
        {/* Dynamic Blocks */}
        <div className="flex flex-col gap-10 md:gap-16">
          {widgets.map((w: any, index: number) => {
            const delayClass = index < 5 ? `delay-[${(index + 1) * 100}ms]` : ''

            if (w.widget_type === 'text') {
              return (
                <div
                  key={w.id}
                  className={`prose prose-lg md:prose-xl prose-neutral text-left w-full max-w-[1400px] mx-auto text-neutral-800 break-words px-4 sm:px-8 lg:px-12 [&_p]:w-full [&_p]:block [&_p]:leading-relaxed [&_p]:tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both ${delayClass}`}
                >
                  <HTMLRenderer html={w.content?.html || ''} />
                </div>
              )
            }
            if (w.widget_type === 'image') {
              const urls = w.content?.urls || []
              if (urls.length === 0) return null;
              return (
                <div key={w.id} className={`flex flex-wrap w-full justify-center bg-neutral-50 animate-in fade-in duration-1000 fill-mode-both ${delayClass}`}>
                  {urls.map((url: string, idx: number) => (
                    <div key={idx} className="relative flex-grow flex justify-center bg-neutral-50 group" style={{ flexBasis: urls.length >= 3 ? '30%' : urls.length === 2 ? '48%' : '100%' }}>
                      <img src={url} alt={`media-${idx}`} className="w-full h-auto object-cover block transition-transform duration-700 ease-out group-hover:scale-[1.01]" />
                    </div>
                  ))}
                </div>
              )
            }
            if (w.widget_type === 'video') {
              const url = w.content?.url
              if (!url) return null
              const isAudio = url.match(/\.(mp3|wav|ogg)$/i)
              return (
                <div key={w.id} className={`w-full flex justify-center my-4 bg-black animate-in fade-in duration-1000 fill-mode-both ${delayClass}`}>
                  {isAudio ? (
                    <audio src={url} controls className="w-full max-w-md my-12 px-4" />
                  ) : (
                    <video src={url} controls className="w-full h-auto max-h-[90vh] bg-black" />
                  )}
                </div>
              )
            }
            if (w.widget_type === 'embed') {
              const code = w.content?.html
              if (!code) return null

              const tweetMatch = code.match(/twitter\.com\/.*\/status\/(\d+)|x\.com\/.*\/status\/(\d+)/)
              const tweetId = tweetMatch ? (tweetMatch[1] || tweetMatch[2]) : null
              const isVideoUrl = !code.includes('<iframe') && !tweetId && (code.includes('youtube.com') || code.includes('youtu.be') || code.includes('vimeo.com') || code.includes('twitch.tv'))

              return (
                <div key={w.id} className={`w-full flex justify-center my-8 ${delayClass}`}>
                  <div className={`w-full ${tweetId ? 'max-w-lg' : isVideoUrl ? 'max-w-4xl aspect-video bg-black shadow-2xl' : 'max-w-4xl'}`}>
                    {tweetId ? (
                      <div className="light w-full flex justify-center">
                        <Tweet id={tweetId} />
                      </div>
                    ) : isVideoUrl ? (
                      <div className="w-full max-w-3xl aspect-video mx-auto relative shadow-lg rounded-xl overflow-hidden bg-black animate-in fade-in duration-1000">
                        {/* @ts-ignore */}
                        <ReactPlayer url={code} width="100%" height="100%" controls />
                      </div>
                    ) : (
                      <div
                        className="w-full relative aspect-video bg-black shadow-2xl [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:border-none"
                        dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? require('isomorphic-dompurify').sanitize(code, { ADD_TAGS: ['iframe'] }) : code }}
                      />
                    )}
                  </div>
                </div>
              )
            }
            return null
          })}
        </div>
      </main>

      {/* Dark Footer (Behance Style) */}
      <footer className="w-full bg-[#111111] text-white py-16 px-6 mt-12 flex flex-col items-center">
        {/* Premium Creator Info & SNS Links */}
        <div className="flex flex-col items-center max-w-4xl w-full border-t border-neutral-800/50 pt-16">
          <div className="w-24 h-24 bg-neutral-900 overflow-hidden mb-8 border border-neutral-800">
            {project.creator.avatar_url ? (
              <img src={project.creator.avatar_url} alt={project.creator.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-500 font-light text-3xl uppercase">
                {project.creator.display_name?.charAt(0) || project.creator.creator_name?.charAt(0) || '?'}
              </div>
            )}
          </div>

          <h2 className="text-3xl font-bold tracking-widest uppercase mb-2 text-white/90">{project.creator.display_name}</h2>

          <p className="text-neutral-500 text-sm tracking-widest uppercase mb-10">
            게시: {new Date(project.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          {project.creator.portfolios && (
            <div className="flex flex-wrap items-center justify-center gap-4">
              {project.creator.portfolios.youtube_url && (
                <PreviewLinkCard href={project.creator.portfolios.youtube_url} asChild>
                  <a href={project.creator.portfolios.youtube_url} target="_blank" rel="noopener noreferrer" className="bg-transparent border border-neutral-700 hover:border-white hover:text-white text-neutral-400 py-3 px-8 transition-all text-xs tracking-widest uppercase flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg>
                    YouTube
                  </a>
                </PreviewLinkCard>
              )}
              {project.creator.portfolios.twitter_url && (
                <PreviewLinkCard href={project.creator.portfolios.twitter_url} asChild>
                  <a href={project.creator.portfolios.twitter_url} target="_blank" rel="noopener noreferrer" className="bg-transparent border border-neutral-700 hover:border-white hover:text-white text-neutral-400 py-3 px-8 transition-all text-xs tracking-widest uppercase flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    Twitter
                  </a>
                </PreviewLinkCard>
              )}
              {project.creator.portfolios.instagram_url && (
                <PreviewLinkCard href={project.creator.portfolios.instagram_url} asChild>
                  <a href={project.creator.portfolios.instagram_url} target="_blank" rel="noopener noreferrer" className="bg-transparent border border-neutral-700 hover:border-white hover:text-white text-neutral-400 py-3 px-8 transition-all text-xs tracking-widest uppercase flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                    Instagram
                  </a>
                </PreviewLinkCard>
              )}
              {project.creator.portfolios.patreon_url && (
                <PreviewLinkCard href={project.creator.portfolios.patreon_url} asChild>
                  <a href={project.creator.portfolios.patreon_url} target="_blank" rel="noopener noreferrer" className="bg-transparent border border-neutral-700 hover:border-white hover:text-white text-neutral-400 py-3 px-8 transition-all text-xs tracking-widest uppercase flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M15.386 0.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM0 24h3.618V.524H0V24z"/></svg>
                    Patreon
                  </a>
                </PreviewLinkCard>
              )}
            </div>
          )}
        </div>

        {/* Other Projects Slider */}
        {otherProjects && otherProjects.length > 0 && (
          <div className="w-full max-w-[1400px] mt-24">
            <div className="flex items-center justify-between px-4 mb-6">
              <h3 className="text-white font-bold tracking-widest uppercase text-lg">
                {relatedType === 'category' ? '비슷한 카테고리의 다른 작품' :
                  relatedType === 'section' ? '이 섹션의 다른 게시물' :
                    '크리에이터의 다른 게시물'}
              </h3>
              <div className="flex gap-2">
                <button onClick={scrollLeft} className="w-12 h-12 bg-transparent border border-neutral-800 hover:border-neutral-500 hover:text-white flex items-center justify-center transition-all text-neutral-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" /></svg>
                </button>
                <button onClick={scrollRight} className="w-12 h-12 bg-transparent border border-neutral-800 hover:border-neutral-500 hover:text-white flex items-center justify-center transition-all text-neutral-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
                </button>
              </div>
            </div>
            <div ref={sliderRef} className="flex overflow-x-auto gap-6 pb-8 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              {otherProjects.map((p) => (
                <a href={`/creator/${creatorName}/project/${p.id}`} key={p.id} className="group block relative shrink-0 w-[85vw] sm:w-[500px] md:w-[600px] aspect-video bg-neutral-800 snap-center overflow-hidden">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">No Image</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <h4 className="text-white font-bold text-xl truncate drop-shadow-md">{p.title}</h4>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </footer>

      {/* Global Creator Footer */}
      {!isModal && profileData && (
        <CreatorFooter profileData={profileData} creatorName={creatorName} />
      )}
      </div>
    </ScrollProgressProvider>
  )
}

'use client'

import React, { useEffect, useState } from 'react'

interface ScrollSpyNavProps {
  sections: { id: string; name: string }[]
}

export default function ScrollSpyNav({ sections }: ScrollSpyNavProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible section (or the last intersecting one)
        let visibleSection = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSection = entry.target.id;
          }
        }

        if (visibleSection) {
          // Extract the id from "section-{id}"
          const id = visibleSection.replace('section-', '');
          setActiveSectionId(id);
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px', // Focus on what's currently in the top/middle of the screen
        threshold: 0
      }
    )

    sections.forEach((section) => {
      const element = document.getElementById(`section-${section.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect()
  }, [sections])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(`section-${id}`);
    if (element) {
      // Add a slight delay to ensure UI updates don't jank the scroll
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  if (!sections || sections.length === 0) return null;

  return (
    <div className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-4 items-end pointer-events-none">

      {/* Top (맨위) Button */}
      <div className="group relative flex items-center pointer-events-auto">
        <span className="absolute right-8 px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-bold whitespace-nowrap transition-all duration-300 transform opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:mr-2">
          맨위 (Top)
        </span>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="p-2 -mr-2 rounded-full cursor-pointer focus:outline-none"
        >
          <div className="transition-all duration-300 rounded-full bg-neutral-400 dark:bg-neutral-500 hover:bg-black dark:hover:bg-white hover:scale-125 w-2 h-2 shadow-sm" />
        </button>
      </div>

      {/* Section Dots */}
      {sections.map((section) => {
        const isActive = activeSectionId === section.id;

        return (
          <div key={section.id} className="group relative flex items-center pointer-events-auto">
            {/* Tooltip / Name */}
            <span
              className={`absolute right-8 px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-bold whitespace-nowrap transition-all duration-300 transform 
                ${isActive ? 'opacity-100 translate-x-0 mr-2' : 'opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:mr-2'}`}
            >
              {section.name}
            </span>

            {/* Dot Indicator */}
            <button
              onClick={() => scrollToSection(section.id)}
              className="p-2 -mr-2 rounded-full cursor-pointer focus:outline-none"
              aria-label={`Scroll to ${section.name}`}
            >
              <div
                className={`transition-all duration-300 rounded-full shadow border-2 border-white dark:border-neutral-800 ${isActive
                    ? 'w-4 h-4 bg-black dark:bg-white scale-110'
                    : 'w-3 h-3 bg-neutral-400 dark:bg-neutral-500 hover:bg-neutral-800 dark:hover:bg-neutral-300 hover:scale-125 opacity-70'
                  }`}
              />
            </button>
          </div>
        )
      })}

      {/* Contact Button */}
      <div className="group relative flex items-center pointer-events-auto">
        <span className="absolute right-8 px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-bold whitespace-nowrap transition-all duration-300 transform opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:mr-2">
          맨아래 (Bottom)
        </span>
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          className="p-2 -mr-2 rounded-full cursor-pointer focus:outline-none"
        >
          <div className="transition-all duration-300 rounded-full bg-neutral-400 dark:bg-neutral-500 hover:bg-black dark:hover:bg-white hover:scale-125 w-2 h-2 shadow-sm" />
        </button>
      </div>

    </div>
  )
}

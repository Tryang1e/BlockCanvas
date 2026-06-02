'use client'

import React from 'react'

/**
 * Dedicated Scroll Configuration for the Main Landing Page (craftopia.work)
 * Restores Native CSS Section Snap Scroll functionality and resets global scroll styles.
 */
export default function LandingScroll({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Reset and enable native snap scroll behaviors */
        html, body {
          scroll-behavior: smooth !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          height: auto !important;
          width: 100% !important;
        }

        /* Essential snap section configurations */
        .snap-section {
          height: 100vh !important;
          height: 100dvh !important;
          position: relative !important;
          overflow: hidden !important;
          /* Ensure snapping works if parent container is configured for it */
        }
      `}} />
      {children}
    </>
  )
}

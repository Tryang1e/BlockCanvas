'use client'

import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function HeroAnimator() {
  useEffect(() => {
    let ctx = gsap.context(() => {
      // 1. Initial State (prevent flash before JS loads)
      gsap.set('.hero-avatar, .hero-title, .hero-subtitle, .hero-details, .hero-sns > *', { opacity: 0 })

      // 2. High-End Minimalist Entrance Reveal (Awwwards Style)
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
      
      // Avatar smoothly fades and scales up
      tl.fromTo('.hero-avatar', 
        { scale: 0.9, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 1.5, ease: 'expo.out' }, 
        0.2
      )
      
      // Text elegantly slides up using clip-path to act as an invisible mask
      tl.fromTo('.hero-title', 
        { y: 50, opacity: 0, clipPath: 'inset(100% 0 0 0)' }, 
        { y: 0, opacity: 1, clipPath: 'inset(-20% -20% -20% -20%)', duration: 1.5, ease: 'expo.out' }, 
        0.3
      )
      
      tl.fromTo('.hero-subtitle', 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out' }, 
        0.5
      )
      
      tl.fromTo('.hero-details', 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out' }, 
        0.6
      )
      
      // SNS buttons fade and slide up smoothly without bouncing
      tl.fromTo('.hero-sns > *', 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.1, ease: 'expo.out' }, 
        0.7
      )

      // 3. Banner Image Parallax & Zoom-in on Scroll
      const banner = document.querySelector('.hero-banner-image')
      if (banner) {
        // Cinematic zoom-in tied to user scroll speed
        gsap.fromTo(banner, 
          { scale: 1.0, transformOrigin: 'top center' },
          {
            scale: 1.3,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero-container',
              start: 'top top',
              end: 'bottom top',
              scrub: true // Reacts instantly to scrolling
            }
          }
        )
      }
    });

    return () => ctx.revert();
  }, [])

  return null
}

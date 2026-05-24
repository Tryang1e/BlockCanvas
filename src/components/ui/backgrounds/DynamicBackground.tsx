'use client'

import React, { useState, useEffect } from 'react'
import FloatingBlocks from './floating-blocks'
import MovingGrid from './moving-grid'
import CssStars from './css-stars'
import AuroraGlow from './aurora-glow'

import ParticleNetwork from './particle-network'
import GravityStars from './gravity-stars'
import Fireworks from './fireworks'

import RetroGrid from './retro-grid'
import FlickeringGrid from './flickering-grid'
import ShootingStars from './shooting-stars'
import WavyBackground from './wavy-background'

import { BubbleBackground } from './animate-bubble'
import { FireworksBackground } from './animate-fireworks'
import { GradientBackground } from './animate-gradient'
import { GravityStarsBackground } from './animate-gravity-stars'
import { HexagonBackground } from './animate-hexagon'
import { StarsBackground } from './animate-stars'

interface DynamicBackgroundProps {
  effect?: string | null;
}

export default function DynamicBackground({ effect }: DynamicBackgroundProps) {
  const [activeEffect, setActiveEffect] = useState<string | null>(effect || 'none')

  useEffect(() => {
    setActiveEffect(effect || 'none')
  }, [effect])

  useEffect(() => {
    const handleEffectChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setActiveEffect(customEvent.detail || 'none')
    }

    window.addEventListener('theme-effect-change', handleEffectChange)
    return () => {
      window.removeEventListener('theme-effect-change', handleEffectChange)
    }
  }, [])

  if (!activeEffect || activeEffect === 'none') return null;

  switch (activeEffect) {
    case 'floating_blocks':
      return <FloatingBlocks />
    case 'moving_grid':
      return <MovingGrid />
    case 'css_stars':
      return <CssStars />
    case 'aurora':
      return <AuroraGlow />
    case 'retro_grid':
      return <RetroGrid />
    case 'particle_network':
      return <ParticleNetwork />
    case 'gravity_stars':
      return <GravityStars />
    case 'fireworks':
      return <Fireworks />
    case 'flickering_grid':
      return <FlickeringGrid />
    case 'shooting_stars':
      return <ShootingStars />
    case 'wavy_waves':
      return <WavyBackground />
    case 'animate_bubble':
      return <BubbleBackground interactive={true} />
    case 'animate_fireworks':
      return <FireworksBackground />
    case 'animate_gradient':
      return <GradientBackground />
    case 'animate_gravity_stars':
      return <GravityStarsBackground />
    case 'animate_hexagon':
      return <HexagonBackground />
    case 'animate_stars':
      return <StarsBackground />
    default:
      return null;
  }
}

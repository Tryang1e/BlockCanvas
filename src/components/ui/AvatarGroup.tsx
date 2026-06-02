'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Tooltip from './Tooltip'

export interface AvatarGroupItem {
  name: string
  avatarUrl: string
  creatorName: string
  subdomainUrl?: string
}

interface AvatarGroupProps {
  items: AvatarGroupItem[]
  className?: string
}

export default function AvatarGroup({ items, className = '' }: AvatarGroupProps) {
  const [hostDomain, setHostDomain] = React.useState('craftopia.work')
  const [protocol, setProtocol] = React.useState('http:')

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host
      setProtocol(window.location.protocol)
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        setHostDomain('localhost:3000')
      } else {
        const parts = host.split('.')
        if (parts.length >= 3) {
          setHostDomain(parts.slice(1).join('.'))
        } else {
          setHostDomain(host)
        }
      }
    }
  }, [])

  if (!items || items.length === 0) return null

  // animate-ui의 Overlapping Spring Animation & Y-translate 효과 구현
  const containerVariants: any = {
    initial: {},
    hover: {}
  }

  const avatarVariants: any = {
    initial: { y: 0, scale: 1 },
    hover: { 
      y: -10, 
      scale: 1.08,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 15
      }
    }
  }

  return (
    <motion.div 
      className={`flex items-center -space-x-3.5 hover:space-x-[-8px] transition-all duration-300 pointer-events-auto ${className}`}
      variants={containerVariants}
      initial="initial"
      whileHover="hover"
    >
      {items.map((item, index) => {
        const zIndex = items.length - index
        const avatarSrc = item.avatarUrl || '/default_avatar.png'
        const targetUrl = item.subdomainUrl || `${protocol}//${item.creatorName}.${hostDomain}`

        return (
          <Tooltip key={item.creatorName} text={item.name} position="top">
            <motion.a
              href={targetUrl}
              className="relative w-11 h-11 rounded-full border-[3px] border-[#FAF9F5] bg-[#FAF9F5] shadow-sm overflow-hidden flex-shrink-0 cursor-pointer block hover:z-50"
              style={{ zIndex }}
              variants={avatarVariants}
              whileHover={{ 
                zIndex: 99,
                y: -12,
                scale: 1.15,
                transition: { type: 'spring', stiffness: 350, damping: 12 }
              }}
            >
              <div className="relative w-full h-full rounded-full overflow-hidden bg-neutral-200">
                <Image
                  src={avatarSrc}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
            </motion.a>
          </Tooltip>
        )
      })}
    </motion.div>
  )
}

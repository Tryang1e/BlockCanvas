'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { safeStorage } from '@/lib/storage'

type Theme = 'dark' | 'light' | 'system'
const ThemeContext = createContext<{theme: Theme, resolvedTheme: 'dark'|'light', setTheme: (t:Theme)=>void}>({theme:'system', resolvedTheme:'light', setTheme:()=>{}})

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'dark'|'light'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = safeStorage.getItem('theme') as Theme
    if (saved) setThemeState(saved)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.remove('dark')
    setResolvedTheme('light')
  }, [theme, mounted])

  return <ThemeContext.Provider value={{theme, resolvedTheme, setTheme: setThemeState}}><MotionConfig reducedMotion="user">{children}</MotionConfig></ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

'use client'

import { useEffect } from 'react'

/**
 * 크리에이터가 설정에서 "커스텀 스크롤바"를 켰을 때만 렌더된다.
 * 문서 루트(<html>)에 `custom-scrollbar` 클래스를 부착/해제하여
 * globals.css의 `html.custom-scrollbar` 스크롤바 스타일을 활성화한다.
 * 컴포넌트가 언마운트(다른 페이지로 이동)되면 클래스를 제거해
 * 스타일이 플랫폼 전역으로 새어 나가지 않도록 한다.
 */
export default function CustomScrollbar() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.add('custom-scrollbar')
    return () => {
      root.classList.remove('custom-scrollbar')
    }
  }, [])

  return null
}

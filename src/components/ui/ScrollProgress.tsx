'use client';

import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import { motion, useScroll, useSpring, SpringOptions } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScrollProgressContextType {
  scrollYProgress: any;
}

const ScrollProgressContext = createContext<ScrollProgressContextType | null>(null);

// 가장 가까운 스크롤 가능한 부모 엘리먼트를 실시간 자동 색출하는 지능형 헬퍼 함수
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;

  if (node.scrollHeight > node.clientHeight) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || node.hasAttribute('data-lenis-prevent')) {
      return node;
    }
  }

  return getScrollParent(node.parentElement);
}

export function ScrollProgressProvider({
  children,
  global = false,
  direction = 'vertical',
  transition = { stiffness: 250, damping: 40, bounce: 0 },
}: {
  children: React.ReactNode;
  global?: boolean;
  direction?: 'horizontal' | 'vertical';
  transition?: SpringOptions;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (global) return;

    // 마운트 직후 자신을 둘러싼 실제 스크롤 호스트(모달 등) 부모 노드를 스캔하여 동적 센싱
    // 이 방식은 어떠한 물리 래핑 div 레이어도 자식에 가하지 않으므로 Lenis 스크롤락 충돌이 완전히 제로화됩니다!
    const parent = getScrollParent(sentinelRef.current);
    if (parent) {
      setScrollContainer(parent);
    }
  }, [global]);

  // global이 true이면 viewport 스크롤을, false이면 센싱된 실제 부모 스크롤을 추적
  const { scrollYProgress } = useScroll({
    container: global ? undefined : (scrollContainer ? { current: scrollContainer } : undefined),
    axis: direction === 'horizontal' ? 'x' : 'y'
  });

  const smoothProgress = useSpring(scrollYProgress, transition);

  return (
    <ScrollProgressContext.Provider value={{ scrollYProgress: smoothProgress }}>
      {/* 래핑용 div를 완전히 제거함으로써 Lenis와의 Stacking / Overflow 중첩 스크롤 잠금 버그 영구 소멸! */}
      {!global && <div ref={sentinelRef} className="hidden" aria-hidden="true" />}
      {children}
    </ScrollProgressContext.Provider>
  );
}

export function useScrollProgress() {
  const context = useContext(ScrollProgressContext);
  if (!context) {
    throw new Error('useScrollProgress must be used within a ScrollProgressProvider');
  }
  return context;
}

export function ScrollProgress({
  mode = 'scaleX',
  className,
  ...props
}: {
  mode?: 'width' | 'height' | 'scaleY' | 'scaleX';
  className?: string;
  [key: string]: any;
}) {
  const context = useScrollProgress();
  const scrollYProgress = context?.scrollYProgress;

  const style: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999999, // 오버레이/푸터보다 무조건 위로 노출 보장
  };

  if (mode === 'width' || mode === 'scaleX') {
    style.height = '8px'; // 시인성을 강화한 8px 두께 유지
    style.transformOrigin = 'left';
  } else if (mode === 'height' || mode === 'scaleY') {
    style.width = '8px';
    style.transformOrigin = 'top';
  }

  const motionStyle = {
    ...style,
    scaleX: mode === 'scaleX' || mode === 'width' ? scrollYProgress : 1,
    scaleY: mode === 'scaleY' || mode === 'height' ? scrollYProgress : 1,
  };

  // Animate UI 공식 디자인 미학: 그림자 없이 아주 절제되고 슬릭(Sleek)하며 모던한 단일 하이엔드 테마 컬러 바 렌더링
  return (
    <motion.div
      style={motionStyle}
      className={cn(
        "bg-[#313131] dark:bg-white transition-colors",
        className
      )}
      {...props}
    />
  );
}

export function ScrollProgressContainer({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  return (
    <div className={cn("relative w-full h-full", className)} {...props}>
      {children}
    </div>
  );
}

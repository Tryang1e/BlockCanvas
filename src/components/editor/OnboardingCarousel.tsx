import React, { useState } from "react"
import { X, Play, BookOpen, Layers, Sparkles } from "lucide-react"

interface OnboardingCarouselProps {
  onClose: () => void
}

export default function OnboardingCarousel({ onClose }: OnboardingCarouselProps) {
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0)

  const tabs = [
    {
      id: 0,
      icon: <BookOpen size={16} />,
      label: "단락 포커스 & 범위 선택",
      title: "1. 단락 포커싱 & Outline 제어",
      description: "에디터 본문의 단락을 클릭하면 은은한 파란 외곽선이 활성화되어 활성 단락을 가리킵니다. 이 상태에서 Ctrl+A를 입력하면 전체 문서가 아닌 해당 단락만 지능적으로 범위가 잡혀서 편리하게 복사하거나 변경할 수 있습니다.",
      animationClass: "anim-outline",
      visual: (
        <div className="w-full flex flex-col gap-2">
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold border rounded-lg px-3 py-2 w-full flex justify-between bg-white dark:bg-neutral-900 shadow-sm border-blue-500/40 anim-pulse-outline">
            <span className="flex items-center gap-1.5 font-sans">
              📝 본문 텍스트 단락
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </span>
            <span className="text-[8px] opacity-75 font-mono">active focus</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
          <div className="w-4/5 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full opacity-60" />
        </div>
      )
    },
    {
      id: 1,
      icon: <Layers size={16} />,
      label: "블록 자유 정렬",
      title: "2. 블록 이동 (Drag & Drop)",
      description: "마우스 커서를 블록 근처에 가져가면 나타나는 드래그 핸들(⠿)을 잡아 순서를 바꿀 수 있습니다. 키보드만 사용하더라도 빈 블록 상태에서 Backspace 또는 Delete를 누르는 즉시 해당 블록이 깔끔하게 지워집니다.",
      animationClass: "anim-drag",
      visual: (
        <div className="w-full flex flex-col gap-2 relative h-full justify-center">
          <div className="w-full h-7 bg-white dark:bg-neutral-900 border border-blue-500/30 dark:border-blue-400/20 shadow-md rounded-lg flex items-center justify-between px-3 text-[9px] font-bold text-blue-600 dark:text-blue-400 select-none z-10 anim-drag-block">
            <span className="flex items-center gap-1.5 font-sans">⠿ 텍스트 블록</span>
            <span>🗑</span>
          </div>
          <div className="w-full h-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-lg flex items-center justify-between px-3 text-[9px] font-bold text-neutral-400 select-none opacity-45">
            <span className="flex items-center gap-1.5 font-sans">⠿ 이미지 그리드</span>
            <span>🗑</span>
          </div>
        </div>
      )
    },
    {
      id: 2,
      icon: <Sparkles size={16} />,
      label: "유튜브 자동 임베드",
      title: "3. 유튜브 실시간 자동 임베딩",
      description: "비디오 블록을 생성하고 입력창에 유튜브 주소(youtube.com 또는 youtu.be)를 붙여넣으면, 에디터 엔진이 이를 즉각 감지하여 보안이 강화된 세련된 유튜브 비디오 임베드 플레이어 블록으로 자동 변환합니다.",
      animationClass: "anim-embed",
      visual: (
        <div className="w-full flex flex-col gap-2 justify-center items-center">
          {/* Mock input field typing */}
          <div className="text-[10px] bg-white dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 px-3 py-1.5 rounded-full font-mono text-neutral-600 dark:text-neutral-300 w-full truncate text-center relative border-neutral-300/80">
            <span className="anim-type-sim"></span>
            <span className="w-px h-3 bg-neutral-600 dark:bg-neutral-300 inline-block animate-pulse align-middle ml-0.5" />
          </div>
          {/* Pulsing play player */}
          <div className="w-3/4 h-8 bg-red-650 hover:bg-red-700 rounded-lg shadow-md flex items-center justify-center text-white text-[9px] font-bold gap-1.5 anim-player-sim">
            <Play size={10} fill="white" />
            <span className="font-sans">YouTube Player</span>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="mb-8 w-full bg-gradient-to-br from-indigo-50/60 to-blue-50/60 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-100/90 dark:border-indigo-900/30 rounded-2xl p-6 shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-500 text-left">
      
      {/* Custom Inline Keyframe Animations */}
      <style>{`
        @keyframes pulse-outline-glow {
          0%, 100% { border-color: rgba(59, 130, 246, 0.45); box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.1); }
          50% { border-color: rgba(59, 130, 246, 0.85); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); }
        }
        @keyframes mock-drag-motion-slide {
          0%, 100% { transform: translateY(0); }
          40%, 60% { transform: translateY(34px); }
        }
        @keyframes link-type-sim-anim {
          0% { content: ""; }
          5% { content: "y"; }
          10% { content: "yo"; }
          15% { content: "yout"; }
          20% { content: "youtu."; }
          25% { content: "youtu.be"; }
          30%, 75% { content: "youtu.be/watch_id"; }
          85%, 100% { content: ""; }
        }
        @keyframes player-fade-in-out {
          0%, 30% { opacity: 0; transform: scale(0.95); }
          40%, 75% { opacity: 1; transform: scale(1); }
          85%, 100% { opacity: 0; transform: scale(0.95); }
        }
        .anim-pulse-outline {
          animation: pulse-outline-glow 2.5s infinite ease-in-out;
        }
        .anim-drag-block {
          animation: mock-drag-motion-slide 3.5s infinite ease-in-out;
        }
        .anim-type-sim::after {
          content: "";
          animation: link-type-sim-anim 4.5s infinite steps(1);
        }
        .anim-player-sim {
          animation: player-fade-in-out 4.5s infinite ease-in-out;
        }
      `}</style>

      {/* Dismiss Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/5 hover:bg-neutral-900/10 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-600 hover:text-neutral-850 dark:text-neutral-350 dark:hover:text-white transition-all text-[11px] font-bold rounded-full cursor-pointer shadow-sm border border-neutral-200/50 dark:border-neutral-700/20"
        title="이 가이드라인 영구히 닫기"
      >
        <X size={13} />
        <span>가이드 닫기</span>
      </button>

      <h3 className="text-sm font-black text-neutral-850 dark:text-white tracking-wider mb-2 flex items-center gap-2">
        <span>💡 BlockCanvas 에디터 시작하기 가이드</span>
        <span className="text-[9px] bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono font-bold">TUTORIAL</span>
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-450 mb-5 font-medium leading-relaxed">
        처음 오신 크리에이터 분들을 위한 핵심 3대 제어 방식을 직관적인 마이크로 비주얼 가이드로 소개합니다.
      </p>

      {/* Grid Flow */}
      <div className="flex flex-col md:flex-row gap-6 items-stretch min-h-[160px]">
        {/* Left Side Tab Buttons */}
        <div className="flex flex-row md:flex-col gap-2 w-full md:w-64 shrink-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:flex-initial text-left flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[11px] font-bold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-blue-600 border-blue-200 dark:bg-neutral-900 dark:text-blue-400 dark:border-blue-900/60 shadow-sm"
                    : "bg-white/40 border-neutral-200/60 text-neutral-500 hover:bg-white/80 dark:bg-white/5 dark:border-neutral-800/40 dark:text-neutral-400 dark:hover:bg-white/10"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right Side Content & Interactive Mock Sandbox */}
        <div className="flex-1 bg-white/70 dark:bg-neutral-900/40 border border-white/50 dark:border-neutral-800/40 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 shadow-sm">
          
          {/* Animated Mock Canvas Frame */}
          <div className="w-full md:w-48 h-24 bg-neutral-50 dark:bg-neutral-950 rounded-lg overflow-hidden flex items-center justify-center p-4 border border-neutral-200/30 dark:border-neutral-800/30 shrink-0">
            {tabs[activeTab].visual}
          </div>

          {/* Feature Explanations */}
          <div className="flex-1 flex flex-col justify-center">
            <h4 className="text-[13px] font-extrabold text-neutral-800 dark:text-white mb-2 leading-none">
              {tabs[activeTab].title}
            </h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
              {tabs[activeTab].description}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

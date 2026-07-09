"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * 갤러리 상세 모달 셸(클라이언트). GalleryClient 가 카드 클릭을 가로채 열고, URL 은 History API 로 /gallery/[id] 동기화한다.
 * 닫기(배경 클릭·ESC·X)는 onClose 콜백(= history.back 으로 목록 복귀).
 */
export default function GalleryModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  // 포털 마운트 + 배경 스크롤 잠금.
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC 로 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-4xl min-h-screen sm:min-h-0 sm:my-8 sm:rounded-2xl shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-[0.98] duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 flex items-center justify-center shadow-sm transition-colors"
        >
          <X size={18} />
        </button>
        <div className="p-5 md:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

"use client";

import Link from "next/link";
import { Boxes, ArrowLeft } from "lucide-react";
import GalleryDetailBody, { type DetailPost } from "../GalleryDetailBody";

interface Props {
  post: DetailPost;
  isOwner: boolean;
  isStaff: boolean;
  hasMinecraft: boolean;
  alreadyDownloaded: boolean;
  alreadyReported: boolean;
  bookmarked: boolean;
  purchased: boolean;
  canDownload: boolean;
}

/** 블루프린트 상세 — 전체 페이지(직접 링크·새로고침·SEO). 소프트 내비게이션은 @modal 인터셉트가 모달로 대체한다. */
export default function GalleryDetailClient(props: Props) {
  return (
    <div className="relative min-h-screen bg-[#FAF9F5] text-neutral-900">
      {/* CAD 그리드 배경 — 랜딩/탐색과 동일한 브랜드 캔버스(ExploreClient 와 같은 값) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E2E2D933_1px,transparent_1px),linear-gradient(to_bottom,#E2E2D933_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <header className="sticky top-0 z-30 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-neutral-200/40">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/gallery" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-bold text-sm min-w-0">
            <ArrowLeft size={18} className="shrink-0" /> <span className="truncate">갤러리</span>
          </Link>
          <span className="flex items-center gap-1.5 font-black text-base tracking-tighter shrink-0">
            <Boxes size={18} className="text-neutral-900" /> <span>블루프린트<span className="text-[#FF424D]">.</span></span>
          </span>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-6">
        <GalleryDetailBody {...props} inModal={false} />
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download, Cloud, Flag, Trash2, Loader2, CheckCircle2, ShieldAlert, FileBox, Eye, Tag as TagIcon, EyeOff, HardDrive, Bookmark, ThumbsUp, ShoppingCart,
} from "lucide-react";
import { addBlueprintToCloudAction, deleteMyBlueprintAction, recordGalleryView, toggleBookmarkAction, purchaseBlueprintAction } from "@/app/actions/gallery";
import { formatBytes } from "@/lib/worldQuota";
import McAvatar from "@/components/dashboard/McAvatar";
import ReportModal from "./ReportModal";

export interface DetailPost {
  id: string;
  title: string;
  ext: string;
  coverUrl: string | null;
  tags: string[];
  price?: number; // 판매가(코인). 0/미지정 = 무료.
  buyerFeePercent?: number; // 구매수수료율(%) — 총 지불액 표시용.
  downloads: number;
  views: number;
  bookmarks?: number;
  reactions?: number;
  createdAt: number;
  description: string | null;
  fileBytes: number;
  status: string;
  author: { name: string; handle: string; avatarUrl: string | null; uuid: string | null };
}

interface Props {
  post: DetailPost;
  isOwner: boolean;
  isStaff: boolean;
  hasMinecraft: boolean;
  alreadyDownloaded: boolean;
  alreadyReported: boolean;
  bookmarked: boolean;
  /** 유료 블루프린트를 이 뷰어가 이미 구매했는지. */
  purchased?: boolean;
  /** 파일 다운로드/클라우드 추가가 허용되는지(무료·작성자·스태프·구매자). false 면 구매 버튼을 노출. */
  canDownload?: boolean;
  /** 모달(인터셉트 라우트) 내부에서 렌더될 때 true. 태그 링크·삭제 후 이동을 하드 내비게이션으로 바꿔 병렬 슬롯이 깨끗이 닫히게 한다. */
  inModal?: boolean;
}

function fmtDate(ms: number) {
  try {
    return new Date(ms).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}

/**
 * 갤러리 게시물 상세 본문(커버 + 정보 + 액션). 전체 페이지(GalleryDetailClient)와
 * 인터셉트 라우트 모달(@modal/(.)[id]) 양쪽에서 공유한다.
 */
export default function GalleryDetailBody({ post, isOwner, isStaff, hasMinecraft, alreadyDownloaded, alreadyReported, bookmarked: initialBookmarked, purchased: initialPurchased = false, canDownload: initialCanDownload = true, inModal = false }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState(initialPurchased);
  const [canDownload, setCanDownload] = useState(initialCanDownload);
  const [deleting, setDeleting] = useState(false);

  // 유료 판매 금액/총 지불액 계산.
  const price = Math.max(0, Math.floor(post.price ?? 0));
  const isPaid = price > 0;
  const buyerFee = Math.ceil((price * Math.min(100, Math.max(0, post.buyerFeePercent ?? 0))) / 100);
  const grossPay = price + buyerFee;
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(alreadyReported);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarks ?? 0);
  const [bmBusy, setBmBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const toggleBookmark = async () => {
    setBmBusy(true);
    const r = await toggleBookmarkAction(post.id);
    if (r.success) {
      setBookmarked(r.bookmarked);
      setBookmarkCount((c) => Math.max(0, c + (r.bookmarked ? 1 : -1)));
    } else {
      setToast({ type: "error", text: r.error || "북마크 처리에 실패했습니다." });
    }
    setBmBusy(false);
  };

  useEffect(() => {
    recordGalleryView(post.id).catch(() => {});
  }, [post.id]);

  const addToCloud = async () => {
    setAdding(true);
    setToast(null);
    const r = await addBlueprintToCloudAction(post.id);
    setToast({ type: r.success ? "success" : "error", text: r.success ? r.message || "내 클라우드에 추가했습니다." : r.error || "추가에 실패했습니다." });
    setAdding(false);
  };

  const buy = async () => {
    if (!hasMinecraft) {
      setToast({ type: "error", text: "먼저 마인크래프트 계정을 연동해주세요." });
      return;
    }
    if (!confirm(`이 블루프린트를 구매하시겠습니까?\n\n판매가 ${price.toLocaleString()} + 구매수수료 ${buyerFee.toLocaleString()} = 총 🪙 ${grossPay.toLocaleString()} 코인이 차감됩니다.`)) return;
    setBuying(true);
    setToast(null);
    const r = await purchaseBlueprintAction(post.id);
    if (r.success) {
      setPurchased(true);
      setCanDownload(true);
      setToast({ type: "success", text: r.message || "구매했습니다." });
    } else {
      setToast({ type: "error", text: r.error || "구매에 실패했습니다." });
    }
    setBuying(false);
  };

  const remove = async () => {
    if (!confirm("이 게시물을 삭제하시겠습니까? (되돌릴 수 없음)")) return;
    setDeleting(true);
    const r = await deleteMyBlueprintAction(post.id);
    if (r.success) {
      // 모달에서 삭제 시 하드 내비게이션으로 목록을 새로 불러와 삭제된 카드가 남지 않게 한다.
      if (inModal) window.location.href = "/gallery";
      else router.push("/gallery");
    } else {
      setToast({ type: "error", text: r.error || "삭제에 실패했습니다." });
      setDeleting(false);
    }
  };

  const isBp = post.ext === ".bp";

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {/* 표지 */}
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="aspect-square bg-[#F1EFE8] flex items-center justify-center">
            {post.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.coverUrl} alt={post.title} className="w-full h-full object-contain" style={isBp ? { imageRendering: "pixelated" } : undefined} />
            ) : (
              <div className="flex flex-col items-center gap-2 text-neutral-300">
                <FileBox size={48} />
                <span className="text-xs font-bold">{post.ext}</span>
              </div>
            )}
          </div>
        </div>

        {/* 정보 + 액션 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 확장자 배지 — 하우스 모노 텔레메트리 칩(잉크 온 #F1EFE8), 인디고 제거 */}
            <span className="px-2 py-0.5 rounded bg-[#F1EFE8] text-neutral-700 font-mono font-bold text-[10px] tracking-wider uppercase">
              {isBp ? "[ AXIOM_BP // .BP ]" : "[ WORLDEDIT // .SCHEM ]"}
            </span>
            {isPaid ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-neutral-900 text-white flex items-center gap-1">🪙 <span className="bc-pixel-num">{price.toLocaleString()}</span> 코인</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F1EFE8] text-neutral-600">무료</span>
            )}
            {post.status === "hidden" && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1"><EyeOff size={11} /> 검토 대기</span>
            )}
          </div>

          <h1 className="text-2xl font-black text-neutral-900 leading-tight">{post.title}</h1>

          <div className="flex items-center gap-2.5">
            <McAvatar id={post.author.uuid} name={post.author.name} size={28} />
            <div className="min-w-0">
              <div className="text-sm font-bold text-neutral-800 truncate">{post.author.name}</div>
              <div className="text-[11px] text-neutral-400">{fmtDate(post.createdAt)}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[13px] text-neutral-500 flex-wrap">
            {/* 숫자는 A그룹 시그니처 bc-pixel-num(숫자/라틴 전용) — 한글 라벨은 밖에 둔다 */}
            <span className="flex items-center gap-1.5" title="다운로드 수"><Download size={14} /> <span className="bc-pixel-num">{post.downloads.toLocaleString()}</span> 다운로드</span>
            <span className="flex items-center gap-1.5" title="👍 반응 수"><ThumbsUp size={14} /> <span className="bc-pixel-num">{(post.reactions ?? 0).toLocaleString()}</span></span>
            <span className="flex items-center gap-1.5" title="북마크 수"><Bookmark size={14} /> <span className="bc-pixel-num">{bookmarkCount.toLocaleString()}</span></span>
            <span className="flex items-center gap-1.5" title="조회수"><Eye size={14} /> <span className="bc-pixel-num">{post.views.toLocaleString()}</span></span>
            <span className="flex items-center gap-1.5"><HardDrive size={14} /> {formatBytes(post.fileBytes)}</span>
          </div>

          {post.description && (
            <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed bg-white border border-neutral-200 rounded-xl p-3.5">{post.description}</p>
          )}

          {post.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {post.tags.map((t) =>
                inModal ? (
                  // 모달에서는 하드 내비게이션 — 모달이 닫히고 목록이 태그 필터로 새로 마운트된다.
                  <a key={t} href={`/gallery?tag=${encodeURIComponent(t)}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                    <TagIcon size={10} /> {t}
                  </a>
                ) : (
                  <Link key={t} href={`/gallery?tag=${encodeURIComponent(t)}`} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                    <TagIcon size={10} /> {t}
                  </Link>
                )
              )}
            </div>
          )}

          {toast && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${toast.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
              {toast.type === "success" ? <CheckCircle2 size={14} className="mt-px" /> : <ShieldAlert size={14} className="mt-px" />}
              <span>{toast.text}</span>
            </div>
          )}

          {/* 유료·미구매 → 구매 버튼 / 그 외(무료·작성자·스태프·구매완료) → 다운로드 선택 */}
          {isPaid && !canDownload ? (
            <div className="space-y-2 pt-1">
              <button
                onClick={buy}
                disabled={buying || !hasMinecraft}
                title={hasMinecraft ? "구매하고 다운로드" : "마인크래프트 연동이 필요합니다"}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {buying ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} 구매하고 다운로드 · 🪙 <span className="bc-pixel-num text-[#FF424D]">{grossPay.toLocaleString()}</span>
              </button>
              <p className="text-[11px] text-neutral-400 leading-snug">
                판매가 {price.toLocaleString()} + 구매수수료 {buyerFee.toLocaleString()} 코인. 구매 후에는 언제든 다시 내려받을 수 있어요.
                {hasMinecraft ? "" : " 구매하려면 마인크래프트 계정 연동이 필요합니다."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href={`/api/gallery/download?id=${post.id}`}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-bold transition-colors"
                >
                  <Download size={16} /> 파일 다운로드
                </a>
                <button
                  onClick={addToCloud}
                  disabled={adding || !hasMinecraft}
                  title={hasMinecraft ? "내 스키매틱 클라우드(갤러리 폴더)에 추가" : "마인크래프트 연동이 필요합니다"}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-neutral-300 bg-white hover:border-black text-neutral-800 text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {adding ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />} 내 클라우드에 추가
                </button>
              </div>
              {isPaid && (purchased || isOwner) && (
                <p className="text-[11px] font-medium text-emerald-600 -mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {isOwner ? "내가 판매하는 블루프린트입니다." : "구매 완료 — 자유롭게 다운로드하세요."}
                </p>
              )}
              {!isPaid && alreadyDownloaded && <p className="text-[11px] text-neutral-400 -mt-1.5">이미 다운로드한 게시물입니다.</p>}
            </>
          )}

          {/* 보조 액션 */}
          <div className="flex items-center gap-3 pt-2 border-t border-neutral-200">
            <button
              onClick={toggleBookmark}
              disabled={bmBusy}
              className={`flex items-center gap-1.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${bookmarked ? "text-[#FF424D]" : "text-neutral-400 hover:text-black"}`}
            >
              {bmBusy ? <Loader2 size={13} className="animate-spin" /> : <Bookmark size={13} fill={bookmarked ? "currentColor" : "none"} />}
              {bookmarked ? "북마크됨" : "북마크"}
            </button>
            {!isOwner &&
              (reported ? (
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-neutral-400"><Flag size={13} /> 신고함</span>
              ) : (
                <button onClick={() => setReportOpen(true)} className="flex items-center gap-1.5 text-[12px] font-bold text-neutral-400 hover:text-rose-600 transition-colors">
                  <Flag size={13} /> 신고
                </button>
              ))}
            {(isOwner || isStaff) && (
              <button onClick={remove} disabled={deleting} className="flex items-center gap-1.5 text-[12px] font-bold text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50 ml-auto">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} {isOwner ? "삭제" : "스태프 삭제"}
              </button>
            )}
          </div>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          postId={post.id}
          onClose={() => setReportOpen(false)}
          onDone={(msg) => {
            setReportOpen(false);
            setReported(true);
            setToast({ type: "success", text: msg });
          }}
        />
      )}
    </>
  );
}

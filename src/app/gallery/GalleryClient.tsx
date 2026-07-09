"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Boxes, Upload, Search, Loader2, Download, LogIn, Clock, Flame, FileBox, Trash2, EyeOff, X, Tag as TagIcon, CheckCircle2, ShieldAlert, Bookmark, LayoutDashboard, ThumbsUp, BookOpen,
} from "lucide-react";
import { listGalleryPosts, getMyBlueprintPosts, deleteMyBlueprintAction, getMyBookmarks, toggleBookmarkAction, getGalleryPost } from "@/app/actions/gallery";
import McAvatar from "@/components/dashboard/McAvatar";
import BlockImage from "@/components/ui/BlockImage";
import GalleryUploadModal from "./GalleryUploadModal";
import GalleryModal from "./GalleryModal";
import GalleryDetailBody, { type DetailPost } from "./GalleryDetailBody";

interface Card {
  id: string;
  title: string;
  ext: string;
  coverUrl: string | null;
  /** 서버 액션이 동봉한 표지 16px 픽셀 플레이스홀더 data URI(로컬 표지만, 없으면 null) */
  blurDataURL?: string | null;
  tags: string[];
  price?: number;
  downloads: number;
  views: number;
  bookmarks?: number;
  reactions?: number;
  bookmarked?: boolean;
  createdAt: number;
  author: { name: string; handle: string; avatarUrl: string | null; uuid: string | null };
  status?: string;
  reportCount?: number;
}

type Sort = "new" | "popular";
type Tab = "browse" | "bookmarks" | "mine";
const PAGE = 24;

function extBadge(ext: string) {
  const isBp = ext === ".bp";
  return (
    // 확장자 배지 — 하우스 모노 텔레메트리 칩(잉크 온 #F1EFE8), 인디고 제거.
    <span className="px-1.5 py-0.5 rounded bg-[#F1EFE8] text-neutral-700 font-mono font-bold text-[9px] tracking-wider uppercase">
      {isBp ? "[ AXIOM_BP ]" : "[ SCHEM ]"}
    </span>
  );
}

function statusBadge(status?: string) {
  if (!status || status === "published") return null;
  if (status === "hidden")
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1"><EyeOff size={10} /> 검토 대기</span>;
  if (status === "removed")
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">제거됨</span>;
  return null;
}

function PostCard({ post, onOpen, onDelete, onBookmark }: { post: Card; onOpen?: () => void; onDelete?: () => void; onBookmark?: () => void }) {
  // onOpen 이 있으면(회원) 평범한 좌클릭은 모달로 가로챈다. 수식어 클릭(Ctrl/⌘/Shift·가운데버튼)은
  // 새 탭 열기 등 브라우저 기본 동작을 위해 그대로 전체 페이지로 보낸다.
  const handleClick = onOpen
    ? (e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onOpen();
      }
    : undefined;
  return (
    // 루트의 overflow-hidden 은 bc-cropmark(모서리 재단선이 바깥 -5px에 그려짐)를 잘라먹으므로
    // 표지 컨테이너에 rounded-t-2xl 을 줘서 클리핑을 안쪽으로 옮겼다. 시각 결과는 동일.
    <div className="group relative bc-cropmark bg-white rounded-2xl border border-neutral-200 hover:border-black hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow]">
      <Link href={`/gallery/${post.id}`} onClick={handleClick} className="block">
        <div className="relative aspect-square bg-[#F1EFE8] overflow-hidden rounded-t-2xl flex items-center justify-center">
          {post.coverUrl ? (
            <BlockImage
              src={post.coverUrl}
              alt={post.title}
              blurDataURL={post.blurDataURL}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-neutral-300">
              <FileBox size={34} />
              <span className="text-[10px] font-bold">{post.ext}</span>
            </div>
          )}
          {/* 표지 하단 판매금액 배지 — 유료는 코인, 무료는 '무료'. */}
          {(post.price ?? 0) > 0 ? (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900/90 text-white text-[11px] font-bold tabular-nums shadow-sm">
              🪙 <span className="bc-pixel-num">{(post.price ?? 0).toLocaleString()}</span>
            </span>
          ) : (
            <span className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/55 text-white text-[11px] font-bold shadow-sm">무료</span>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            {extBadge(post.ext)}
            {statusBadge(post.status)}
          </div>
          <h3 className="text-sm font-bold text-neutral-900 truncate">{post.title}</h3>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <McAvatar id={post.author.uuid} name={post.author.name} size={18} />
              <span className="text-[11px] text-neutral-500 truncate">{post.author.name}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-400 shrink-0 tabular-nums">
              <span className="flex items-center gap-0.5" title="다운로드 수"><Download size={11} /> <span className="bc-pixel-num">{post.downloads}</span></span>
              <span className="flex items-center gap-0.5" title="👍 반응 수"><ThumbsUp size={11} /> <span className="bc-pixel-num">{post.reactions ?? 0}</span></span>
              <span className="flex items-center gap-0.5" title="북마크 수"><Bookmark size={11} /> <span className="bc-pixel-num">{post.bookmarks ?? 0}</span></span>
            </span>
          </div>
        </div>
      </Link>
      {onDelete ? (
        <button
          onClick={onDelete}
          title="삭제"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 border border-rose-200 text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={13} />
        </button>
      ) : onBookmark ? (
        <button
          onClick={onBookmark}
          title={post.bookmarked ? "북마크 해제" : "북마크"}
          className={`absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 border transition-opacity ${post.bookmarked
              ? "border-neutral-900 text-[#FF424D] opacity-100"
              : "border-neutral-200 text-neutral-500 hover:text-[#FF424D] hover:border-black opacity-0 group-hover:opacity-100"
            }`}
        >
          <Bookmark size={13} fill={post.bookmarked ? "currentColor" : "none"} />
        </button>
      ) : null}
    </div>
  );
}

// 상세 모달 로더 — getGalleryPost 로 상세를 불러와 GalleryModal 안에 GalleryDetailBody 를 렌더한다.
// (인터셉트 라우트 대신 클라이언트 모달 + History API 로 /gallery/[id] URL 을 동기화한다.)
function GalleryModalLoader({ id, onClose }: { id: string; onClose: () => void }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; post: DetailPost; isOwner: boolean; isStaff: boolean; hasMinecraft: boolean; alreadyDownloaded: boolean; alreadyReported: boolean; bookmarked: boolean; purchased: boolean; canDownload: boolean }
  >({ kind: "loading" });

  // id 별로 remount(key) 되므로 초기 state 가 곧 loading — 여기서는 fetch 만 한다.
  useEffect(() => {
    let alive = true;
    getGalleryPost(id)
      .then((r) => {
        if (!alive) return;
        if (r.success && r.post) {
          setState({ kind: "ready", post: r.post, isOwner: r.isOwner, isStaff: r.isStaff, hasMinecraft: r.hasMinecraft, alreadyDownloaded: r.alreadyDownloaded, alreadyReported: r.alreadyReported, bookmarked: r.bookmarked, purchased: r.purchased, canDownload: r.canDownload });
        } else {
          setState({ kind: "error", message: r.error || "게시물을 불러오지 못했습니다." });
        }
      })
      .catch((e) => alive && setState({ kind: "error", message: e instanceof Error ? e.message : "게시물을 불러오지 못했습니다." }));
    return () => { alive = false; };
  }, [id]);

  return (
    <GalleryModal onClose={onClose}>
      {state.kind === "loading" ? (
        <div className="flex items-center justify-center gap-2 py-24 text-neutral-400 text-sm">
          <Loader2 size={18} className="animate-spin" /> 불러오는 중...
        </div>
      ) : state.kind === "error" ? (
        <div className="flex flex-col items-center text-center py-16 px-2">
          <div className="w-14 h-14 mb-4 rounded-2xl bg-neutral-100 flex items-center justify-center"><Boxes className="text-neutral-400" size={26} /></div>
          <h2 className="text-lg font-black text-neutral-900 mb-1.5">게시물을 볼 수 없습니다</h2>
          <p className="text-sm text-neutral-500 font-medium max-w-sm">{state.message}</p>
        </div>
      ) : (
        <GalleryDetailBody
          post={state.post}
          isOwner={state.isOwner}
          isStaff={state.isStaff}
          hasMinecraft={state.hasMinecraft}
          alreadyDownloaded={state.alreadyDownloaded}
          alreadyReported={state.alreadyReported}
          bookmarked={state.bookmarked}
          purchased={state.purchased}
          canDownload={state.canDownload}
          inModal
        />
      )}
    </GalleryModal>
  );
}

export default function GalleryClient({ viewer, dashboardUrl }: { viewer: { isMember: boolean; handle: string | null; isStaff: boolean }; dashboardUrl?: string | null }) {
  const [tab, setTab] = useState<Tab>("browse");
  const [posts, setPosts] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<Sort>("new");
  const [q, setQ] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") || "" : ""));
  const [tag, setTag] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tag") || "" : ""));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 카드 클릭 → 상세 모달 열기 + History API 로 /gallery/[id] URL 동기화(뒤로가기로 닫힘).
  const openModal = useCallback((id: string) => {
    window.history.pushState({ galleryModal: id }, "", `/gallery/${id}`);
    setModalId(id);
  }, []);
  const closeModal = useCallback(() => {
    // 우리가 pushState 로 쌓은 항목이면 back 으로 목록 URL 복원(뒤로가기와 동일), 아니면 상태만 해제.
    if (typeof window !== "undefined" && (window.history.state as { galleryModal?: string } | null)?.galleryModal) {
      window.history.back();
    } else {
      setModalId(null);
    }
  }, []);
  // 브라우저 뒤로/앞으로 → 모달 상태를 URL(history state)과 동기화.
  useEffect(() => {
    const onPop = () => setModalId((window.history.state as { galleryModal?: string } | null)?.galleryModal ?? null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const loadBrowse = useCallback(async (reset: boolean, opts: { sort: Sort; q: string; tag: string }) => {
    const skip = reset ? 0 : posts.length;
    if (reset) setLoading(true); else setLoadingMore(true);
    const r = await listGalleryPosts({ sort: opts.sort, q: opts.q, tag: opts.tag, take: PAGE, skip });
    if (r.success) {
      setPosts((prev) => (reset ? r.posts : [...prev, ...r.posts]));
      setTotal(r.total);
    } else {
      setToast({ type: "error", text: r.error || "목록을 불러오지 못했습니다." });
    }
    setLoading(false);
    setLoadingMore(false);
  }, [posts.length]);

  const loadSimple = useCallback(async (which: "mine" | "bookmarks") => {
    setLoading(true);
    const r = which === "mine" ? await getMyBlueprintPosts() : await getMyBookmarks();
    if (r.success) {
      setPosts(r.posts as Card[]);
      setTotal(r.posts.length);
    } else {
      setToast({ type: "error", text: r.error || "목록을 불러오지 못했습니다." });
    }
    setLoading(false);
  }, []);

  // 탭 / 정렬 / 검색 / 태그 변경 시 재조회.
  useEffect(() => {
    if (tab === "mine" || tab === "bookmarks") {
      loadSimple(tab);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => loadBrowse(true, { sort, q, tag }), q ? 300 : 0);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sort, q, tag]);

  const handleDeleteMine = async (id: string, title: string) => {
    if (!confirm(`'${title}' 게시물을 삭제하시겠습니까? (되돌릴 수 없음)`)) return;
    const r = await deleteMyBlueprintAction(id);
    if (r.success) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setToast({ type: "success", text: r.message || "삭제했습니다." });
    } else {
      setToast({ type: "error", text: r.error || "삭제에 실패했습니다." });
    }
  };

  const handleToggleBookmark = async (id: string) => {
    const r = await toggleBookmarkAction(id);
    if (!r.success) {
      setToast({ type: "error", text: r.error || "북마크 처리에 실패했습니다." });
      return;
    }
    setPosts((prev) => {
      let next = prev.map((p) =>
        p.id === id ? { ...p, bookmarked: r.bookmarked, bookmarks: Math.max(0, (p.bookmarks ?? 0) + (r.bookmarked ? 1 : -1)) } : p
      );
      if (tab === "bookmarks" && !r.bookmarked) next = next.filter((p) => p.id !== id); // 북마크 탭에서 해제하면 목록에서 제거
      return next;
    });
    if (tab === "bookmarks" && !r.bookmarked) setTotal((t) => Math.max(0, t - 1));
  };

  return (
    <div className="relative min-h-screen bg-[#FAF9F5] text-neutral-900">
      {/* CAD 그리드 배경 — 랜딩/탐색과 동일한 브랜드 캔버스(ExploreClient 와 같은 값) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E2E2D933_1px,transparent_1px),linear-gradient(to_bottom,#E2E2D933_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      {/* 상단 바 */}
      <header className="sticky top-0 z-30 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-neutral-200/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 font-black text-lg tracking-tighter min-w-0 shrink-0" title="메인으로">
            <Boxes size={20} className="text-neutral-900 shrink-0" /> <span className="truncate">블루프린트 갤러리</span>
          </a>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={process.env.NEXT_PUBLIC_WIKI_URL || "https://wiki.craftopia.work"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/70 text-xs font-bold transition-colors"
              title="위키 — 가이드·문서"
            >
              <BookOpen size={14} className="text-sky-500" /> <span className="hidden sm:inline">위키</span>
            </a>
            {viewer.isMember ? (
              <>
                {dashboardUrl && (
                  <a
                    href={dashboardUrl}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:border-black text-neutral-700 text-xs font-bold transition-colors"
                    title="내 건축 대시보드로 이동"
                  >
                    <LayoutDashboard size={14} /> <span className="hidden sm:inline">건축 대시보드</span><span className="sm:hidden">대시보드</span>
                  </a>
                )}
                <button
                  onClick={() => setUploadOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-colors"
                >
                  <Upload size={14} /> 공유하기
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-colors"
              >
                <LogIn size={14} /> 로그인하고 공유
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* 타이포 히어로 — 탐색(Explore.) 헤더와 같은 스케일/트래킹: 모노 텔레메트리 + 시그니처 레드 도트 */}
        <div className="pb-5 border-b border-neutral-200/40">
          <p className="text-[9px] text-neutral-400 font-mono font-bold tracking-widest uppercase mb-2 select-none">
            [ ARCHIVE // .BP + .SCHEM ]
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 select-none">
            Blueprint Gallery<span className="text-[#FF424D]">.</span>
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1.5">
            크리에이터들이 공유하는 Axiom 블루프린트 · WorldEdit 스키매틱 아카이브
          </p>
        </div>

        {/* 탭 + 도구 */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center rounded-xl border border-neutral-200 bg-white overflow-hidden text-[12px] font-bold">
            <button onClick={() => setTab("browse")} className={`px-4 py-2 ${tab === "browse" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>둘러보기</button>
            {viewer.isMember && (
              <button onClick={() => setTab("bookmarks")} className={`flex items-center gap-1 px-4 py-2 ${tab === "bookmarks" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>
                <Bookmark size={12} /> 북마크
              </button>
            )}
            {viewer.isMember && (
              <button onClick={() => setTab("mine")} className={`px-4 py-2 ${tab === "mine" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>내 게시물</button>
            )}
          </div>

          {tab === "browse" && (
            <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
              <div className="relative flex-1 sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="제목·설명 검색"
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:outline-none"
                />
              </div>
              <div className="flex items-center rounded-lg border border-neutral-200 bg-white overflow-hidden text-[11px] font-bold shrink-0">
                <button onClick={() => setSort("new")} className={`flex items-center gap-1 px-2.5 py-2 ${sort === "new" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}><Clock size={12} /> 최신</button>
                <button onClick={() => setSort("popular")} className={`flex items-center gap-1 px-2.5 py-2 ${sort === "popular" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}><Flame size={12} /> 인기</button>
              </div>
            </div>
          )}
        </div>

        {/* 활성 태그 필터 */}
        {tab === "browse" && tag && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-neutral-800 border border-neutral-300 text-[12px] font-bold">
              <TagIcon size={12} className="text-[#FF424D]" /> {tag}
              <button onClick={() => setTag("")} className="text-neutral-400 hover:text-black"><X size={12} /></button>
            </span>
          </div>
        )}

        {toast && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${toast.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
            {toast.type === "success" ? <CheckCircle2 size={14} className="mt-px" /> : <ShieldAlert size={14} className="mt-px" />}
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="ml-auto text-current/60 hover:text-current"><X size={13} /></button>
          </div>
        )}

        {/* 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-neutral-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> 불러오는 중...
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-neutral-200 rounded-2xl">
            <Boxes className="mx-auto text-neutral-300 mb-3" size={36} />
            <p className="text-sm text-neutral-500 font-medium">
              {tab === "mine" ? "아직 공유한 블루프린트가 없습니다." : tab === "bookmarks" ? "북마크한 블루프린트가 없습니다." : "표시할 블루프린트가 없습니다."}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {tab === "bookmarks" ? "마음에 드는 블루프린트를 북마크해 모아보세요." : "상단의 “공유하기”로 첫 블루프린트를 올려보세요."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onOpen={viewer.isMember ? () => openModal(p.id) : undefined}
                  onDelete={tab === "mine" ? () => handleDeleteMine(p.id, p.title) : undefined}
                  onBookmark={viewer.isMember && tab !== "mine" ? () => handleToggleBookmark(p.id) : undefined}
                />
              ))}
            </div>
            {tab === "browse" && posts.length < total && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => loadBrowse(false, { sort, q, tag })}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 bg-white hover:border-black text-sm font-bold text-neutral-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? <Loader2 size={15} className="animate-spin" /> : null} 더 보기 ({posts.length}/{total})
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {uploadOpen && (
        <GalleryUploadModal
          onClose={() => setUploadOpen(false)}
          onPublished={(id) => {
            setUploadOpen(false);
            openModal(id);
          }}
        />
      )}

      {modalId && <GalleryModalLoader key={modalId} id={modalId} onClose={closeModal} />}
    </div>
  );
}

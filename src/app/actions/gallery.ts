"use server";

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { Profile } from "@prisma/client";
import { sessionProfile } from "@/lib/server-auth";
import { canUseBuildDashboard } from "@/lib/roles";
import { requireStaff } from "@/lib/admin-auth";
import {
  galleryFileAbs,
  deleteGalleryFiles,
  getGalleryConfig,
  GALLERY_MAX_FILE_BYTES,
} from "@/lib/blueprintGallery";
import { recordDownloadAndReward } from "@/lib/blueprintPublish";
import { purchaseBlueprintForProfile, canAccessBlueprint } from "@/lib/blueprintPurchase";
import { getEconomyConfig } from "@/lib/economyConfig";
import { getModerationState } from "@/lib/moderation";
import { deleteBlueprintDiscordMessage } from "@/lib/discord";
import {
  savePlayerSchematic,
  schemPathExists,
  walkSchematics,
  safeSchemName,
  hasValidMagic,
  MAX_FILES,
} from "@/lib/schematics";
import { getQuotaUsage, evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { formatBytes } from "@/lib/worldQuota";
import { getBlurPlaceholders } from "@/lib/blurPlaceholder";

// "use server" 파일은 async 함수만 export 가능 → 상수/타입은 내부에만 둔다(라벨은 ReportModal 에 별도 정의).
const REPORT_REASONS = ["stolen", "inappropriate", "spam", "broken", "other"] as const;

// ---------------------------------------------------------------------------
//  공통: 뷰어 게이트(인증 완료 유저만 갤러리 이용)
// ---------------------------------------------------------------------------
async function viewer(): Promise<Profile> {
  const p = await sessionProfile();
  if (!p) throw new Error("로그인이 필요합니다.");
  if (!canUseBuildDashboard(p)) throw new Error("갤러리는 인증을 완료한 유저만 이용할 수 있습니다.");
  // 이용정지/차단 계정은 회원 액션(구매·클라우드 추가·신고 등) 차단 — UI(page.tsx)뿐 아니라 서버 액션 직접 호출도 봉쇄.
  if (getModerationState(p).isBlocked) throw new Error("현재 계정이 이용정지/차단 상태로 갤러리 기능을 이용할 수 없습니다.");
  return p;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t) => typeof t === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

const cardSelect = {
  id: true,
  title: true,
  ext: true,
  cover_path: true,
  tags: true,
  price: true,
  download_count: true,
  view_count: true,
  bookmark_count: true,
  reaction_count: true,
  created_at: true,
  author: {
    select: { creator_name: true, display_name: true, minecraft_username: true, minecraft_uuid: true, avatar_url: true },
  },
} as const;

type CardRow = {
  id: string;
  title: string;
  ext: string;
  cover_path: string | null;
  tags: string | null;
  price: number;
  download_count: number;
  view_count: number;
  bookmark_count: number;
  reaction_count: number;
  created_at: Date;
  author: {
    creator_name: string;
    display_name: string | null;
    minecraft_username: string | null;
    minecraft_uuid: string | null;
    avatar_url: string | null;
  };
};

function toCard(r: CardRow) {
  return {
    id: r.id,
    title: r.title,
    ext: r.ext,
    coverUrl: r.cover_path,
    tags: parseTags(r.tags),
    price: r.price,
    downloads: r.download_count,
    views: r.view_count,
    bookmarks: r.bookmark_count,
    reactions: r.reaction_count,
    createdAt: r.created_at.getTime(),
    author: {
      name: r.author.minecraft_username || r.author.display_name || r.author.creator_name,
      handle: r.author.creator_name,
      avatarUrl: r.author.avatar_url,
      uuid: r.author.minecraft_uuid,
    },
  };
}

// ---------------------------------------------------------------------------
//  목록 / 상세 / 조회수
// ---------------------------------------------------------------------------

export interface ListGalleryOpts {
  sort?: "new" | "popular";
  q?: string;
  tag?: string;
  take?: number;
  skip?: number;
}

/** 공개(published) 게시물 목록 + 검색/태그/정렬/페이지네이션. 둘러보기(보기)는 비로그인 포함 누구나 가능. */
export async function listGalleryPosts(opts?: ListGalleryOpts) {
  try {
    // 인증 불필요 — 공개 둘러보기. 게시(published) 상태만 노출(hidden/removed 제외).
    const take = Math.min(Math.max(opts?.take ?? 24, 1), 48);
    const skip = Math.max(opts?.skip ?? 0, 0);
    const q = (opts?.q || "").trim();
    const tag = (opts?.tag || "").trim();
    const where = {
      status: "published" as const,
      ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}),
      ...(tag ? { tags: { contains: `"${tag}"` } } : {}),
    };
    const orderBy =
      opts?.sort === "popular"
        ? [{ download_count: "desc" as const }, { created_at: "desc" as const }]
        : [{ created_at: "desc" as const }];
    const me = await sessionProfile(); // 게스트면 null — 둘러보기는 공개
    const [rows, total] = await Promise.all([
      prisma.blueprintPost.findMany({ where, orderBy, take, skip, select: cardSelect }),
      prisma.blueprintPost.count({ where }),
    ]);
    // 로그인 회원이면 각 카드의 북마크 여부 표시.
    let bm = new Set<string>();
    if (me && rows.length) {
      const rb = await prisma.blueprintBookmark.findMany({
        where: { profile_id: me.id, post_id: { in: rows.map((r) => r.id) } },
        select: { post_id: true },
      });
      bm = new Set(rb.map((x) => x.post_id));
    }
    // 픽셀 블러업: 표지(로컬 /uploads/blueprints/*.webp)의 16px 플레이스홀더 동봉(항목당 수백 B).
    const blurs = await getBlurPlaceholders(rows.map((r) => r.cover_path));
    return { success: true as const, posts: rows.map((r, i) => ({ ...toCard(r), bookmarked: bm.has(r.id), blurDataURL: blurs[i] })), total, take, skip };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e), posts: [], total: 0 };
  }
}

/** 게시물 상세. hidden(자동숨김) 은 작성자/스태프만 열람 가능. removed 는 비공개. */
export async function getGalleryPost(id: string) {
  try {
    const me = await viewer();
    const post = await prisma.blueprintPost.findUnique({
      where: { id },
      select: {
        ...cardSelect,
        description: true,
        file_bytes: true,
        status: true,
        report_count: true,
        author_id: true,
      },
    });
    if (!post || post.status === "removed") return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    const isOwner = post.author_id === me.id;
    const isStaff = me.role === "admin" || me.role === "manager";
    if (post.status === "hidden" && !isOwner && !isStaff) {
      return { success: false as const, error: "신고 검토 중인 게시물입니다." };
    }
    const [downloaded, reported, bookmarked, purchase] = await Promise.all([
      prisma.blueprintDownload.findUnique({ where: { post_id_profile_id: { post_id: id, profile_id: me.id } }, select: { id: true } }),
      prisma.blueprintReport.findUnique({ where: { post_id_reporter_id: { post_id: id, reporter_id: me.id } }, select: { id: true } }),
      prisma.blueprintBookmark.findUnique({ where: { post_id_profile_id: { post_id: id, profile_id: me.id } }, select: { id: true } }),
      post.price > 0
        ? prisma.blueprintPurchase.findUnique({ where: { post_id_buyer_id: { post_id: id, buyer_id: me.id } }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    const purchased = !!purchase;
    // 파일 접근 가능 여부 — 무료 또는 (유료의 경우) 작성자·스태프·구매자.
    const canDownload = post.price <= 0 || isOwner || isStaff || purchased;
    // 유료글이면 구매수수료율을 함께 전달 → 상세에서 실제 지불 총액(판매가+수수료)을 정확히 표시.
    const buyerFeePercent = post.price > 0 ? (await getEconomyConfig()).blueprintBuyerFeePercent : 0;
    return {
      success: true as const,
      post: {
        ...toCard(post),
        description: post.description,
        fileBytes: post.file_bytes,
        status: post.status,
        buyerFeePercent,
      },
      isOwner,
      isStaff,
      hasMinecraft: !!me.minecraft_uuid,
      alreadyDownloaded: !!downloaded,
      alreadyReported: !!reported,
      bookmarked: !!bookmarked,
      purchased,
      canDownload,
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 조회수 +1 (상세 진입 시 1회). 실패는 무시. */
export async function recordGalleryView(id: string) {
  try {
    await viewer();
    await prisma.blueprintPost.update({ where: { id }, data: { view_count: { increment: 1 } } });
  } catch {
    /* best-effort */
  }
  return { success: true as const };
}

// ---------------------------------------------------------------------------
//  다운로드 → 내 스키매틱 클라우드에 추가
// ---------------------------------------------------------------------------

/** 갤러리 게시물 파일을 내 개인 스키매틱 클라우드(FAWE 폴더)의 '갤러리' 폴더에 복사. 쿼터/개수 검사 + 고유 다운로드 기록. */
export async function addBlueprintToCloudAction(id: string) {
  try {
    const me = await viewer();
    if (!me.minecraft_uuid) return { success: false as const, error: "먼저 마인크래프트 계정을 연동해주세요." };
    const post = await prisma.blueprintPost.findUnique({
      where: { id },
      select: { id: true, ext: true, title: true, status: true, price: true, author_id: true },
    });
    if (!post) return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    // 공개(published)가 아닌 게시물(hidden=신고 검토 중 / removed)은 작성자·스태프만 접근(격리 콘텐츠 유출 방지).
    const isStaff = me.role === "admin" || me.role === "manager";
    if (post.status !== "published" && post.author_id !== me.id && !isStaff) {
      return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    }
    // 유료 블루프린트는 구매(또는 작성자/스태프)여야 파일에 접근 가능.
    if (!(await canAccessBlueprint(post, me))) {
      return { success: false as const, error: "유료 블루프린트입니다. 먼저 구매해주세요." };
    }

    const abs = galleryFileAbs(post.id, post.ext);
    if (!abs) return { success: false as const, error: "잘못된 경로입니다." };
    let buf: Buffer;
    try {
      buf = await fs.readFile(/* turbopackIgnore: true */ abs);
    } catch {
      return { success: false as const, error: "원본 파일을 찾을 수 없습니다." };
    }
    if (buf.length > GALLERY_MAX_FILE_BYTES) return { success: false as const, error: "파일이 너무 큽니다." };

    // 대상 파일명(제목 기반) — '갤러리' 폴더에 저장. 충돌 시 -2, -3 … 으로 회피.
    const base = (post.title || "blueprint").replace(/[^\w가-힣 .()\-]/g, "_").slice(0, 60).trim() || "blueprint";
    let candidate = safeSchemName(`${base}${post.ext}`) || `blueprint${post.ext}`;
    let rel = `갤러리/${candidate}`;
    let n = 2;
    while (await schemPathExists(me.minecraft_uuid, rel)) {
      candidate = safeSchemName(`${base}-${n}${post.ext}`) || `blueprint-${n}${post.ext}`;
      rel = `갤러리/${candidate}`;
      n++;
      if (n > 50) break;
    }
    // 매직바이트 재확인(스토리지 무결성).
    if (!hasValidMagic(candidate, buf)) return { success: false as const, error: "파일 형식이 올바르지 않습니다." };

    // 개수 제한.
    const all = await walkSchematics(me.minecraft_uuid);
    if (all.length >= MAX_FILES) {
      return { success: false as const, error: `스키매틱 개수 한도(${MAX_FILES})를 초과했습니다. 정리 후 다시 시도해주세요.` };
    }
    // 공동 쿼터(월드+스키매틱).
    const quota = await getQuotaUsage(me.id);
    if (quota.totalBytes !== null && quota.usedBytes + buf.length > quota.totalBytes) {
      return {
        success: false as const,
        error: `클라우드 용량이 부족합니다 (${formatBytes(quota.usedBytes)} / ${formatBytes(quota.totalBytes)} 사용 중). 정리 후 다시 시도해주세요.`,
      };
    }

    await savePlayerSchematic(me.minecraft_uuid, rel, buf);
    await prisma.profile.update({ where: { id: me.id }, data: { last_seen_at: new Date() } }).catch(() => {});
    try {
      await evaluateQuota(me.id);
    } catch {
      /* best-effort */
    }
    // 고유 다운로드 기록(+ 작성자 마일스톤 보상) — 무료글만. 유료글은 판매수익이 보상이라 마일스톤 미지급(판매수는 구매 시 집계).
    if (post.price <= 0) {
      try {
        await recordDownloadAndReward(post.id, me.id);
      } catch {
        /* ignore */
      }
    }
    return { success: true as const, message: `'${path.basename(rel)}' 을(를) 내 스키매틱 클라우드(갤러리 폴더)에 추가했습니다.` };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
//  유료 블루프린트 구매(고정가)
// ---------------------------------------------------------------------------

/**
 * 유료 블루프린트 구매 — 인증 회원. 구매 성공 시 다운로드/내 클라우드 추가가 열린다.
 * 구매자는 판매가 + 구매수수료를 지불하고 판매자는 판매가 − 판매수수료를 받으며, 수수료 합은 소각된다.
 */
export async function purchaseBlueprintAction(id: string) {
  try {
    const me = await viewer();
    return await purchaseBlueprintForProfile(
      { id: me.id, creator_name: me.creator_name, minecraft_uuid: me.minecraft_uuid },
      id
    );
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
//  내 게시물 / 삭제
// ---------------------------------------------------------------------------

/** 내가 공유한 게시물 목록(모든 상태). */
export async function getMyBlueprintPosts() {
  try {
    const me = await viewer();
    const rows = await prisma.blueprintPost.findMany({
      where: { author_id: me.id },
      orderBy: { created_at: "desc" },
      select: { ...cardSelect, status: true, report_count: true },
    });
    const blurs = await getBlurPlaceholders(rows.map((r) => r.cover_path));
    return {
      success: true as const,
      posts: rows.map((r, i) => ({ ...toCard(r), status: r.status, reportCount: r.report_count, blurDataURL: blurs[i] })),
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e), posts: [] };
  }
}

// ---------------------------------------------------------------------------
//  북마크(즐겨찾기)
// ---------------------------------------------------------------------------

/** 북마크 토글 — 회원 전용. 켜짐/꺼짐 상태 반환. bookmark_count 동기화. */
export async function toggleBookmarkAction(id: string) {
  try {
    const me = await viewer();
    const post = await prisma.blueprintPost.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!post || post.status === "removed") return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    const existing = await prisma.blueprintBookmark.findUnique({
      where: { post_id_profile_id: { post_id: id, profile_id: me.id } },
      select: { id: true },
    });
    if (existing) {
      await prisma.blueprintBookmark.delete({ where: { id: existing.id } });
      await prisma.blueprintPost.updateMany({ where: { id, bookmark_count: { gt: 0 } }, data: { bookmark_count: { decrement: 1 } } });
      return { success: true as const, bookmarked: false, message: "북마크를 해제했습니다." };
    }
    await prisma.blueprintBookmark.create({ data: { post_id: id, profile_id: me.id } });
    await prisma.blueprintPost.update({ where: { id }, data: { bookmark_count: { increment: 1 } } });
    return { success: true as const, bookmarked: true, message: "북마크에 저장했습니다." };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 내가 북마크한 게시물 목록(최신순). 제거된 게시물 제외. */
export async function getMyBookmarks() {
  try {
    const me = await viewer();
    const rows = await prisma.blueprintBookmark.findMany({
      where: { profile_id: me.id, post: { status: { not: "removed" } } },
      orderBy: { created_at: "desc" },
      take: 100,
      select: { post: { select: { ...cardSelect, status: true } } },
    });
    const blurs = await getBlurPlaceholders(rows.map((b) => b.post.cover_path));
    return {
      success: true as const,
      posts: rows.map((b, i) => ({ ...toCard(b.post), status: b.post.status, bookmarked: true, blurDataURL: blurs[i] })),
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e), posts: [] };
  }
}

/** 내 스키매틱 클라우드의 .bp/.schem 파일 평면 목록 — 업로드 모달 '내 클라우드에서 선택' 탭용. */
export async function listMyCloudBlueprints() {
  try {
    const me = await viewer();
    if (!me.minecraft_uuid) return { success: false as const, error: "먼저 마인크래프트 계정을 연동해주세요.", files: [] };
    const all = await walkSchematics(me.minecraft_uuid);
    const files = all
      .filter((f) => {
        const l = f.name.toLowerCase();
        return l.endsWith(".bp") || l.endsWith(".schem");
      })
      .map((f) => ({ path: f.path, name: f.name, bytes: f.bytes, ext: f.name.toLowerCase().endsWith(".bp") ? ".bp" : ".schem" }));
    return { success: true as const, files };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e), files: [] };
  }
}

/** 게시물 삭제 — 작성자 본인 또는 스태프. 파일/표지/행 제거. */
export async function deleteMyBlueprintAction(id: string) {
  try {
    const me = await viewer();
    const post = await prisma.blueprintPost.findUnique({ where: { id }, select: { author_id: true, discord_message_id: true } });
    if (!post) return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    const isStaff = me.role === "admin" || me.role === "manager";
    if (post.author_id !== me.id && !isStaff) return { success: false as const, error: "삭제 권한이 없습니다." };
    await prisma.blueprintPost.delete({ where: { id } }); // 하드 삭제(신고·다운로드·반응·북마크 FK cascade)
    await deleteGalleryFiles(id);
    await deleteBlueprintDiscordMessage(post.discord_message_id).catch(() => {}); // Discord 포럼 게시물(스레드)도 삭제
    await prisma.creatorLog
      .create({ data: { creator_name: me.creator_name, action: "blueprint_delete", target_id: id, details: isStaff && post.author_id !== me.id ? "staff" : "" } })
      .catch(() => {});
    return { success: true as const, message: "게시물을 삭제했습니다." };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
//  신고
// ---------------------------------------------------------------------------

/** 이용약관 위반 게시물 신고(1인 1게시물 1회). 임계 도달 시 자동 숨김. */
export async function reportBlueprintAction(id: string, reason: string, detail?: string) {
  try {
    const me = await viewer();
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      return { success: false as const, error: "잘못된 신고 사유입니다." };
    }
    const post = await prisma.blueprintPost.findUnique({ where: { id }, select: { id: true, author_id: true, status: true } });
    if (!post || post.status === "removed") return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    if (post.author_id === me.id) return { success: false as const, error: "본인 게시물은 신고할 수 없습니다." };

    try {
      await prisma.blueprintReport.create({
        data: { post_id: id, reporter_id: me.id, reason, detail: (detail || "").trim().slice(0, 1000) || null },
      });
    } catch {
      return { success: false as const, error: "이미 신고한 게시물입니다." };
    }

    // 미해결 신고 수 갱신 + 임계 자동 숨김.
    const pending = await prisma.blueprintReport.count({ where: { post_id: id, status: "pending" } });
    const cfg = await getGalleryConfig();
    const willHide = post.status === "published" && pending >= cfg.autohideThreshold;
    await prisma.blueprintPost.update({
      where: { id },
      data: { report_count: pending, ...(willHide ? { status: "hidden", removal_reason: "신고 누적 자동 숨김(검토 대기)" } : {}) },
    });
    await prisma.creatorLog
      .create({ data: { creator_name: me.creator_name, action: "blueprint_report", target_id: id, details: reason } })
      .catch(() => {});
    return {
      success: true as const,
      message: willHide
        ? "신고가 접수되었습니다. 신고가 누적되어 게시물이 검토 대기로 전환되었습니다."
        : "신고가 접수되었습니다. 관리자가 검토합니다.",
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
//  관리자/스태프 — 신고함 + 처리
// ---------------------------------------------------------------------------

/** 신고함 목록(기본 pending). 게시물 요약 + 신고자 포함. */
export async function adminListBlueprintReports(opts?: { status?: "pending" | "resolved" }) {
  try {
    await requireStaff();
    const status = opts?.status === "resolved" ? { in: ["resolved_removed", "resolved_dismissed"] } : "pending";
    const rows = await prisma.blueprintReport.findMany({
      where: { status },
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true,
        reason: true,
        detail: true,
        status: true,
        created_at: true,
        resolved_by: true,
        resolved_at: true,
        reporter: { select: { creator_name: true, display_name: true, minecraft_username: true } },
        post: {
          select: {
            id: true,
            title: true,
            ext: true,
            cover_path: true,
            status: true,
            download_count: true,
            report_count: true,
            author: { select: { creator_name: true, display_name: true, minecraft_username: true, minecraft_uuid: true } },
          },
        },
      },
    });
    return {
      success: true as const,
      reports: rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.created_at.getTime(),
        resolvedBy: r.resolved_by,
        resolvedAt: r.resolved_at ? r.resolved_at.getTime() : null,
        reporter: r.reporter.minecraft_username || r.reporter.display_name || r.reporter.creator_name,
        post: r.post
          ? {
              id: r.post.id,
              title: r.post.title,
              ext: r.post.ext,
              coverUrl: r.post.cover_path,
              status: r.post.status,
              downloads: r.post.download_count,
              reportCount: r.post.report_count,
              authorName: r.post.author.minecraft_username || r.post.author.display_name || r.post.author.creator_name,
              authorHandle: r.post.author.creator_name,
            }
          : null,
      })),
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e), reports: [] };
  }
}

/**
 * 신고 처리 — remove(게시물 제거: 파일삭제·전체 pending 신고 처리·게시 코인 회수·작성자 알림) 또는
 * dismiss(이 신고 기각: 남은 신고 미만이면 숨김 해제).
 */
export async function resolveBlueprintReportAction(reportId: string, action: "remove" | "dismiss", note?: string) {
  try {
    const staff = await requireStaff();
    const report = await prisma.blueprintReport.findUnique({
      where: { id: reportId },
      select: { id: true, post_id: true, status: true },
    });
    if (!report) return { success: false as const, error: "신고를 찾을 수 없습니다." };
    const post = await prisma.blueprintPost.findUnique({
      where: { id: report.post_id },
      select: { id: true, title: true, status: true, author_id: true, discord_message_id: true },
    });
    if (!post) return { success: false as const, error: "게시물을 찾을 수 없습니다." };
    const now = new Date();
    const reason = (note || "").trim().slice(0, 500) || null;

    if (action === "remove") {
      // 하드 삭제 — 게시물 row + 파일을 DB/스토리지에서 완전 제거. 연관(신고·다운로드·반응·북마크)은 FK cascade 로 함께 삭제.
      // ⚠ 코인 회수는 하지 않는다(게시 보상 없음 + 이미 지급된 다운로드/반응 마일스톤도 회수하지 않음).
      await prisma.blueprintPost.delete({ where: { id: post.id } });
      await deleteGalleryFiles(post.id);
      await deleteBlueprintDiscordMessage(post.discord_message_id).catch(() => {}); // Discord 포럼 게시물(스레드) 삭제

      // 작성자 알림 (post 는 삭제 전 캡처됨).
      await prisma.notification
        .create({
          data: {
            recipient_id: post.author_id,
            sender_name: staff,
            category: "moderation",
            title: "블루프린트 게시물 제거",
            body: `공유한 블루프린트 '${post.title}' 이(가) 이용약관 위반으로 제거되었습니다. 사유: ${reason || "관리자 문의"}`,
          },
        })
        .catch(() => {});
      await prisma.auditLog
        .create({ data: { admin_name: staff, action: "BLUEPRINT_REMOVE", target_id: post.id, details: reason || "" } })
        .catch(() => {});
      return { success: true as const, message: "게시물을 제거했습니다." };
    }

    // dismiss — 이 신고만 기각.
    await prisma.blueprintReport.update({
      where: { id: report.id },
      data: { status: "resolved_dismissed", resolved_by: staff, resolved_at: now },
    });
    const pending = await prisma.blueprintReport.count({ where: { post_id: post.id, status: "pending" } });
    const cfg = await getGalleryConfig();
    const restore = post.status === "hidden" && pending < cfg.autohideThreshold;
    await prisma.blueprintPost.update({
      where: { id: post.id },
      data: { report_count: pending, ...(restore ? { status: "published", removal_reason: null } : {}) },
    });
    await prisma.auditLog
      .create({ data: { admin_name: staff, action: "BLUEPRINT_REPORT_DISMISS", target_id: post.id, details: reason || "" } })
      .catch(() => {});
    return { success: true as const, message: restore ? "신고를 기각하고 게시물을 다시 공개했습니다." : "신고를 기각했습니다." };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

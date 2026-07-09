import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { hasFullVerification } from "@/lib/roles";
import { getModerationState } from "@/lib/moderation";
import { MC_SERVER_DIR } from "@/lib/mcServerDir";

/**
 * 블루프린트 갤러리 — 스토리지 경로 + 공유 권한 게이트 + 설정값.
 *
 * 파일 저장 정책:
 *  - 원본 .bp/.schem 은 갤러리 전용 스토리지(<GALLERY_ROOT>/<postId>/blueprint.<ext>)에 "불변 스냅샷"으로 저장.
 *    개인 스키매틱 클라우드(FAWE per-player 폴더)와 분리 → 작성자가 클라우드에서 지워도 게시물은 유지, 쿼터와도 무관.
 *    다운로드는 로그인 게이트 라우트(/api/gallery/download)로만 — 갤러리 dir 은 public 이 아님.
 *  - 표지(webp)는 public/uploads/blueprints/<postId>.webp 에 저장 → 기존 /uploads 라우트로 서빙 +
 *    Cloudflare 터널로 공개 URL 노출(Discord 임베드 썸네일에 필요).
 */

const GALLERY_ROOT =
  process.env.BLUEPRINT_GALLERY_DIR ||
  path.join(MC_SERVER_DIR, "blueprint-gallery");

const COVER_PUBLIC_DIR = path.join(process.cwd(), "public", "uploads", "blueprints");

export const GALLERY_ALLOWED_EXT = [".bp", ".schem"] as const; // 갤러리는 .schematic 제외(.bp/.schem 만)
export const GALLERY_MAX_FILE_BYTES = 25 * 1024 * 1024; // 파일당 25MB(스키매틱 클라우드와 동일)

export type GalleryExt = (typeof GALLERY_ALLOWED_EXT)[number];

/** 확장자 정규화 — 허용(.bp/.schem)만 통과, 그 외 null. */
export function normalizeGalleryExt(name: string): GalleryExt | null {
  const ext = path.extname(name).toLowerCase();
  return (GALLERY_ALLOWED_EXT as readonly string[]).includes(ext) ? (ext as GalleryExt) : null;
}

// ---- 경로 헬퍼 (postId 는 uuid 라 경로 트래버설 위험 없음, 그래도 영숫자/대시만 허용) ----

function safePostId(postId: string): string | null {
  return /^[0-9a-f-]{8,}$/i.test(postId) ? postId : null;
}

export function galleryPostDir(postId: string): string | null {
  const id = safePostId(postId);
  return id ? path.join(GALLERY_ROOT, id) : null;
}

export function galleryFileAbs(postId: string, ext: string): string | null {
  const dir = galleryPostDir(postId);
  const e = normalizeGalleryExt(`x${ext.startsWith(".") ? ext : "." + ext}`);
  return dir && e ? path.join(dir, `blueprint${e}`) : null;
}

export function coverFileAbs(postId: string): string | null {
  const id = safePostId(postId);
  return id ? path.join(COVER_PUBLIC_DIR, `${id}.webp`) : null;
}

/** 표지 public URL(있을 때). /uploads 라우트로 서빙. */
export function coverPublicUrl(postId: string): string {
  return `/uploads/blueprints/${postId}.webp`;
}

// ---- 파일 I/O ----

/** 원본 .bp/.schem 을 갤러리 스토리지에 저장. */
export async function saveGalleryFile(postId: string, ext: string, data: Buffer): Promise<void> {
  const abs = galleryFileAbs(postId, ext);
  if (!abs) throw new Error("Invalid gallery file path");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
}

/** 표지 webp 를 public 에 저장. */
export async function saveGalleryCover(postId: string, webp: Buffer): Promise<void> {
  const abs = coverFileAbs(postId);
  if (!abs) throw new Error("Invalid cover path");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, webp);
}

/** 게시물 파일(원본 + 표지) 일괄 삭제(제거 처리/작성자 삭제 시). best-effort. */
export async function deleteGalleryFiles(postId: string): Promise<void> {
  const dir = galleryPostDir(postId);
  const cover = coverFileAbs(postId);
  if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  if (cover) await fs.rm(cover, { force: true }).catch(() => {});
}

// ---- 공유 권한 게이트 ----

interface ShareGateProfile {
  role?: string | null;
  discord_id?: string | null;
  discord_in_guild: boolean | null; // hasFullVerification 필수 필드 — 호출부가 반드시 select 하도록 강제
  minecraft_uuid?: string | null;
  email?: string | null;
  password?: string | null;
  status?: string | null;
  suspended_until?: Date | null;
  muted_until?: Date | null;
  moderation_reason?: string | null;
}

/**
 * 갤러리 공유 가능 여부 — "모든 인증 완료" 유저 + 제재 미상태.
 *  - 3종 인증(디스코드+마크+웹가입) 완료(hasFullVerification)
 *  - 정지/차단(isBlocked)·뮤트(isMuted) 아님
 * 통과면 null, 아니면 사용자 안내 메시지(문자열) 반환.
 */
export function shareGateError(p: ShareGateProfile): string | null {
  if (!hasFullVerification(p)) {
    return "공유하려면 디스코드 · 마인크래프트(정품) · 웹 회원가입 3종 인증을 모두 완료해야 합니다.";
  }
  const st = getModerationState(p);
  if (st.isBlocked) return "현재 계정이 이용정지/차단 상태로 공유할 수 없습니다.";
  if (st.isMuted) return "현재 뮤트 상태로 공유가 제한됩니다.";
  return null;
}

/**
 * 오늘(한국 표준시 자정 기준) 이 유저의 블루프린트 공유(게시) 횟수 — 하루 공유 상한 판정용.
 * CreatorLog(action="blueprint_share") 원장을 세므로 게시물을 삭제해도 카운트가 유지된다
 * → "공유→삭제→재공유"로 상한을 우회할 수 없다(갤러리·디스코드 웹훅 스팸 방지).
 * 롤링 24h 가 아니라 매일 KST 자정(00:00)에 리셋되는 달력일 기준. KST=UTC+9 고정(서머타임 없음)이라
 * 서버 프로세스 타임존과 무관하게 항상 한국 자정에 초기화된다.
 */
export async function countTodayShares(creatorName: string): Promise<number> {
  const KST_OFFSET_MS = 9 * 3600 * 1000;
  const kst = new Date(Date.now() + KST_OFFSET_MS); // KST 벽시계를 UTC 필드로 읽기 위해 +9h 시프트
  const startOfDayKst = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
  return prisma.creatorLog.count({
    where: { creator_name: creatorName, action: "blueprint_share", created_at: { gte: startOfDayKst } },
  });
}

// ---- 설정값 (SiteSetting 으로 관리자 조정, 미설정 시 기본값) ----

// 게시 자체 적립(shareCoin)은 파밍 방지를 위해 폐지. 보상은 '남의' 고유 다운로드 + 고유 👍 반응 마일스톤에서만.
// 2트랙 보상(2026-07-03): 기본(개당) + 보너스(N개 누적 마일스톤)를 동시 지급한다.
//  - 반응: 기본 1개당 10코인 + 보너스 10개당 100코인 → 20개면 200+200=400.
//  - 다운로드: 기본 1회당 5코인 + 보너스 10회당 30코인 → 20회면 100+60=160.
export interface GalleryConfig {
  milestoneStep: number; // (기본) 고유 다운로드 N회마다 지급 — 개당은 step=1
  milestoneCoin: number; // (기본) 다운로드 코인
  reactionStep: number; // (기본) 고유 👍 반응 N회마다 지급 — 개당은 step=1
  reactionCoin: number; // (기본) 반응 코인
  downloadBonusStep: number; // (보너스) 고유 다운로드 N회 누적마다 추가 지급
  downloadBonusCoin: number; // (보너스) 다운로드 보너스 코인
  reactionBonusStep: number; // (보너스) 고유 반응 N개 누적마다 추가 지급
  reactionBonusCoin: number; // (보너스) 반응 보너스 코인
  autohideThreshold: number; // 미해결 신고 N건 시 자동 숨김
  dailyShareLimit: number; // 유저 1인당 하루(KST 자정 리셋) 공유 상한. 0 = 무제한(삭제·재공유로 우회 불가, CreatorLog 기준).
}

// 기본값(2026-07-03 정책): 다운로드 기본 1회당 5 + 보너스 10회당 30, 반응 기본 1개당 10 + 보너스 10개당 100, 신고 3건 자동숨김, 하루 공유 10개.
const DEFAULTS: GalleryConfig = { milestoneStep: 1, milestoneCoin: 5, reactionStep: 1, reactionCoin: 10, downloadBonusStep: 10, downloadBonusCoin: 30, reactionBonusStep: 10, reactionBonusCoin: 100, autohideThreshold: 3, dailyShareLimit: 10 };

const SETTING_KEYS: Record<keyof GalleryConfig, string> = {
  milestoneStep: "blueprint_milestone_step",
  milestoneCoin: "blueprint_milestone_coin",
  reactionStep: "blueprint_reaction_step",
  reactionCoin: "blueprint_reaction_coin",
  downloadBonusStep: "blueprint_download_bonus_step",
  downloadBonusCoin: "blueprint_download_bonus_coin",
  reactionBonusStep: "blueprint_reaction_bonus_step",
  reactionBonusCoin: "blueprint_reaction_bonus_coin",
  autohideThreshold: "blueprint_report_autohide",
  dailyShareLimit: "blueprint_daily_share_limit",
};

/** 갤러리 설정값 로드(SiteSetting). 누락/파싱 실패는 기본값으로 폴백. */
export async function getGalleryConfig(): Promise<GalleryConfig> {
  const keys = Object.values(SETTING_KEYS);
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: keyof GalleryConfig): number => {
    const raw = map.get(SETTING_KEYS[k]);
    const n = raw != null ? parseInt(String(raw).replace(/[^0-9-]/g, ""), 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : DEFAULTS[k];
  };
  return {
    milestoneStep: Math.max(1, num("milestoneStep")),
    milestoneCoin: num("milestoneCoin"),
    reactionStep: Math.max(1, num("reactionStep")),
    reactionCoin: num("reactionCoin"),
    downloadBonusStep: Math.max(1, num("downloadBonusStep")),
    downloadBonusCoin: num("downloadBonusCoin"),
    reactionBonusStep: Math.max(1, num("reactionBonusStep")),
    reactionBonusCoin: num("reactionBonusCoin"),
    autohideThreshold: Math.max(1, num("autohideThreshold")),
    dailyShareLimit: num("dailyShareLimit"), // 0 허용(무제한) — min 1 강제 안 함
  };
}

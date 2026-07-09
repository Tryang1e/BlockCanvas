// ── 픽셀 블러업 플레이스홀더(서버 전용) ─────────────────────────────────────
// 로컬 업로드 이미지(/uploads/**)의 ~16px 초소형 썸네일을 요청 시점에 sharp 로 생성해
// data URI 로 반환한다. 클라이언트(BlockImage)는 이 조각을 imageRendering:'pixelated' 로
// 늘려 그려 "마인크래프트 청크 로딩" 감성의 모자이크 → 원본 페이드인을 연출한다.
//
//  • Prisma 스키마/업로드 액션 무변경 — 기존 콘텐츠 전부에 자동 적용.
//  • 프로세스 내 Map 캐시(절대경로+mtimeMs 키, FIFO 상한) — 같은 파일은 1회만 생성.
//  • 원격 URL(http…, 아바타 CDN 등)·비이미지·경로탈출 후보는 전부 null(플레이스홀더 생략).
//  ⚠ 서버 전용(fs/sharp) — 클라이언트 컴포넌트에서 import 금지.

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const URL_PREFIX = "/uploads/";
// sharp 로 안전하게 축소 가능한 래스터 포맷만(svg 는 벡터라 플레이스홀더 불필요).
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
// 병리적 초대형 파일 디코드 방지(썸네일용이므로 과감히 스킵).
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
// 캐시 상한 — 초과 시 가장 오래된 항목부터 제거(FIFO). 항목당 수백 바이트라 총량 수백 KB 수준.
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, { mtimeMs: number; dataUri: string }>();

/** /uploads/** URL 을 디스크 절대경로로 매핑. uploads 루트 밖·숨김 세그먼트·비이미지는 null. */
function resolveLocalUploadPath(url: string): string | null {
  // 쿼리/해시 제거 후 로컬 업로드 경로만 취급(원격 URL·data URI 등은 전부 제외).
  const clean = url.split(/[?#]/)[0];
  if (!clean.startsWith(URL_PREFIX)) return null;
  const rel = clean.slice(URL_PREFIX.length);
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null;
  }
  // 빈 세그먼트·점 시작 세그먼트(.env 류)·백슬래시 꼼수 차단 — uploads 라우트와 동일 정신.
  if (!decoded || decoded.includes("\\")) return null;
  if (decoded.split("/").some((seg) => !seg || seg.startsWith("."))) return null;
  const abs = path.resolve(UPLOADS_ROOT, decoded);
  // 경로 탐색(Path Traversal) 방지: 반드시 uploads 루트 하위여야 한다.
  if (!abs.startsWith(UPLOADS_ROOT + path.sep)) return null;
  if (!ALLOWED_EXT.has(path.extname(abs).toLowerCase())) return null;
  return abs;
}

/**
 * 이미지 URL → 16px 픽셀 플레이스홀더 data URI. 로컬 /uploads 파일이 아니거나
 * 생성에 실패하면 null(호출부는 스켈레톤으로 폴백).
 */
export async function getBlurPlaceholder(url: string | null | undefined): Promise<string | null> {
  try {
    if (!url || typeof url !== "string") return null;
    const abs = resolveLocalUploadPath(url);
    if (!abs) return null;

    const stat = await fs.stat(abs);
    if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES) return null;

    const hit = cache.get(abs);
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.dataUri;

    // 16×16 내부에 맞춰 축소(비율 유지 → 16:9 원본은 16×9). webp 저품질이면 200~500B 수준.
    const buf = await sharp(abs, { animated: false })
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 30, alphaQuality: 40 })
      .toBuffer();
    const dataUri = `data:image/webp;base64,${buf.toString("base64")}`;

    cache.delete(abs); // 재삽입으로 갱신 항목을 뒤로 보냄
    cache.set(abs, { mtimeMs: stat.mtimeMs, dataUri });
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return dataUri;
  } catch {
    // sharp 디코드 실패·파일 소실 등 — 플레이스홀더는 장식이므로 조용히 생략.
    return null;
  }
}

/** 목록용 배치 헬퍼 — 항목별 실패 격리(하나 깨져도 나머지는 정상). */
export async function getBlurPlaceholders(
  urls: (string | null | undefined)[]
): Promise<(string | null)[]> {
  return Promise.all(urls.map((u) => getBlurPlaceholder(u).catch(() => null)));
}

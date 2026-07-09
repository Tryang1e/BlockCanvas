// ── 동적 OG 이미지 공용 헬퍼(서버 전용) ─────────────────────────────────────
// opengraph-image.tsx 4종(브랜드/크리에이터/블루프린트/프로젝트)이 공유하는
// 폰트 로딩·로컬 업로드 이미지 임베드·브랜드 카드 베이스를 모아둔다.
//
//  • satori 는 woff2 미지원 → Pretendard OTF 스태틱(node_modules/pretendard/dist/public/static).
//    없으면 레포 픽셀폰트(fonts/NeoDunggeunmo.ttf)로 폴백. 숫자/영문 악센트는 fonts/Minecraft.ttf.
//  • 로컬 /uploads/** 이미지는 sharp 로 축소(기본 800px) 후 JPEG data URI 로 임베드
//    (원격 URL 은 mixed-content/실패 리스크 때문에 임베드하지 않음 — 호출부가 폴백 처리).
//  • OG 라우트는 절대 500 을 내면 안 됨 → ogResponse() 가 브랜드 카드 → 도형-온리 카드 순으로 폴백.
//  ⚠ 서버 전용(fs/sharp) — 클라이언트 컴포넌트에서 import 금지.

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

// ── 크기·팔레트(사이트 디자인 언어와 동일) ──────────────────────────────
export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  cream: "#FAF9F5",
  ink: "#1E2022",
  red: "#FF424D",
  grid: "rgba(30,32,34,0.06)",
  inkSoft: "rgba(30,32,34,0.72)",
  inkFaint: "rgba(30,32,34,0.55)",
} as const;

// CAD 그리드 배경(48px 1px 라인) — 루트 컨테이너에 spread 해서 사용.
export const gridBackground = {
  backgroundColor: OG.cream,
  backgroundImage: `linear-gradient(to right, ${OG.grid} 1px, transparent 1px), linear-gradient(to bottom, ${OG.grid} 1px, transparent 1px)`,
  backgroundSize: "48px 48px",
} as const;

// 모노(픽셀) 라벨용 패밀리 — Minecraft.ttf 는 영/숫자 전용, 없는 글리프는 Pretendard 로 글리프 폴백.
export const PIXEL_FAMILY = "BC Pixel, Pretendard";

// ── 폰트 로딩(모듈 캐시) ────────────────────────────────────────────────
type OgFonts = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]
>;

async function readFirst(paths: string[]): Promise<Buffer | null> {
  for (const p of paths) {
    try {
      return await fs.readFile(p);
    } catch {
      // 다음 후보 시도
    }
  }
  return null;
}

let fontsPromise: Promise<OgFonts> | null = null;

/** satori 용 폰트 배열(Pretendard 700/900 + BC Pixel 400). 실패한 항목은 조용히 생략. */
export function loadOgFonts(): Promise<OgFonts> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const cwd = process.cwd();
      const pretendardStatic = path.join(
        cwd, "node_modules", "pretendard", "dist", "public", "static"
      );
      const neoDunggeunmo = path.join(cwd, "fonts", "NeoDunggeunmo.ttf");
      const [bold, black, pixel, uniSans] = await Promise.all([
        readFirst([path.join(pretendardStatic, "Pretendard-Bold.otf"), neoDunggeunmo]),
        readFirst([path.join(pretendardStatic, "Pretendard-Black.otf"), neoDunggeunmo]),
        readFirst([path.join(cwd, "fonts", "Minecraft.ttf")]),
        // 사이트 브랜드 마크 서체(luxury-text-heavy) — OG 워드마크가 사이트와 같은 얼굴이 되도록.
        // ⚠CAPS 전용 서체이므로 반드시 대문자로만 사용
        readFirst([path.join(cwd, "fonts", "Uni Sans Heavy.otf")]),
      ]);
      const fonts: OgFonts = [];
      if (bold) fonts.push({ name: "Pretendard", data: bold, weight: 700, style: "normal" });
      if (black) fonts.push({ name: "Pretendard", data: black, weight: 900, style: "normal" });
      if (pixel) fonts.push({ name: "BC Pixel", data: pixel, weight: 400, style: "normal" });
      if (uniSans) fonts.push({ name: "Uni Sans Heavy", data: uniSans, weight: 900, style: "normal" });
      return fonts;
    })().catch(() => {
      fontsPromise = null; // 다음 요청에서 재시도 가능하게
      return [] as OgFonts;
    });
  }
  return fontsPromise;
}

// ── 로컬 업로드 이미지 → data URI (blurPlaceholder.ts 와 동일한 경로 격리) ──
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const URL_PREFIX = "/uploads/";
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;

function resolveLocalUploadPath(url: string): string | null {
  const clean = url.split(/[?#]/)[0];
  if (!clean.startsWith(URL_PREFIX)) return null;
  const rel = clean.slice(URL_PREFIX.length);
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null;
  }
  if (!decoded || decoded.includes("\\")) return null;
  if (decoded.split("/").some((seg) => !seg || seg.startsWith("."))) return null;
  const abs = path.resolve(UPLOADS_ROOT, decoded);
  if (!abs.startsWith(UPLOADS_ROOT + path.sep)) return null;
  if (!ALLOWED_EXT.has(path.extname(abs).toLowerCase())) return null;
  return abs;
}

/**
 * /uploads/** URL 을 지정 폭으로 축소한 JPEG data URI 로 반환.
 * 원격 URL·경로탈출·디코드 실패는 전부 null(호출부가 폴백 디자인 사용).
 */
export async function loadUploadImage(
  url: string | null | undefined,
  width = 800
): Promise<string | null> {
  try {
    if (!url || typeof url !== "string") return null;
    const abs = resolveLocalUploadPath(url);
    if (!abs) return null;
    const stat = await fs.stat(abs);
    if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES) return null;
    // 투명 픽셀은 크림 배경에 합성(JPEG 는 알파 미지원) — 카드 배경과 자연스럽게 이어짐.
    const buf = await sharp(abs, { animated: false })
      .resize({ width, withoutEnlargement: true })
      .flatten({ background: OG.cream })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ── 텍스트 유틸 ─────────────────────────────────────────────────────────
/** OG 카드용 문자열 클램프(satori lineClamp 대신 결정적 JS 절단). */
export function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, Math.max(1, max - 1)).trimEnd() + "…" : t;
}

// ── 공용 조각(모두 satori 호환: 명시적 display:flex) ─────────────────────
/** 4-모서리 크롭마크(.bc-cropmark 모티프). */
export function CropMarks({
  color = OG.ink,
  inset = 26,
  len = 30,
  thick = 3,
}: {
  color?: string;
  inset?: number;
  len?: number;
  thick?: number;
} = {}): ReactElement {
  const b = `${thick}px solid ${color}`;
  const base = { position: "absolute" as const, width: len, height: len, display: "flex" as const };
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
      <div style={{ ...base, top: inset, left: inset, borderTop: b, borderLeft: b }} />
      <div style={{ ...base, top: inset, right: inset, borderTop: b, borderRight: b }} />
      <div style={{ ...base, bottom: inset, left: inset, borderBottom: b, borderLeft: b }} />
      <div style={{ ...base, bottom: inset, right: inset, borderBottom: b, borderRight: b }} />
    </div>
  );
}

/** 모노스페이스 텔레메트리 라벨( [ LABEL ] 스타일 ). */
export function MonoLabel({
  text,
  size = 17,
  color = OG.inkFaint,
}: {
  text: string;
  size?: number;
  color?: string;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: PIXEL_FAMILY,
        fontSize: size,
        letterSpacing: 3,
        color,
      }}
    >
      {text}
    </div>
  );
}

/** 시그니처 레드 닷. */
export function RedDot({ size = 22, mb = 0 }: { size?: number; mb?: number } = {}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: OG.red,
        marginBottom: mb,
      }}
    />
  );
}

/** 그리드 오버레이(배너/썸네일 이미지 위에 얹는 CAD 라인). */
export function GridOverlay(): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundImage: gridBackground.backgroundImage,
        backgroundSize: gridBackground.backgroundSize,
      }}
    />
  );
}

// ── 브랜드 카드(사이트 전역 + 모든 라우트의 폴백) ───────────────────────
export function BrandCard({
  label = "[ BLOCKCANVAS // PORTFOLIO PLATFORM ]",
}: { label?: string } = {}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "Pretendard",
        ...gridBackground,
      }}
    >
      <CropMarks />
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <MonoLabel text={label} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div
          style={{
            display: "flex",
            // 사이트 워드마크와 동일한 서체·표기(Uni Sans Heavy 대문자, luxury-text-heavy와 일치)
            fontFamily: "'Uni Sans Heavy', Pretendard",
            fontWeight: 900,
            fontSize: 110,
            color: OG.ink,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          BLOCKCANVAS
        </div>
        <RedDot size={26} mb={10} />
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 30,
          fontWeight: 700,
          fontSize: 36,
          color: OG.inkSoft,
        }}
      >
        블록을 쌓아 만드는 나만의 포트폴리오
      </div>
      <div style={{ position: "absolute", bottom: 54, left: 64, display: "flex" }}>
        <MonoLabel text="CRAFTOPIA.WORK" />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 56,
          right: 64,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", width: 12, height: 12, backgroundColor: OG.red, marginRight: 8 }} />
        <div style={{ display: "flex", width: 12, height: 12, backgroundColor: OG.ink, marginRight: 8 }} />
        <div style={{ display: "flex", width: 12, height: 12, backgroundColor: OG.grid }} />
      </div>
    </div>
  );
}

// 최후 폴백 — 텍스트가 전혀 없어 폰트 없이도 렌더 가능(도형만).
function ShapesCard(): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        ...gridBackground,
      }}
    >
      <CropMarks />
      <div style={{ display: "flex", width: 56, height: 56, borderRadius: 56, backgroundColor: OG.red }} />
    </div>
  );
}

// ── 안전 렌더 래퍼 ──────────────────────────────────────────────────────
/**
 * OG 라우트 공용 진입점 — 데이터 조회/카드 빌드가 어떤 이유로 실패해도
 * 브랜드 카드 → (폰트까지 없으면) 도형-온리 카드로 폴백해 절대 500 을 내지 않는다.
 */
export async function ogResponse(
  build: () => Promise<ReactElement> | ReactElement
): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  if (fonts.length > 0) {
    try {
      return new ImageResponse(await build(), { ...OG_SIZE, fonts });
    } catch {
      try {
        return new ImageResponse(<BrandCard />, { ...OG_SIZE, fonts });
      } catch {
        // 아래 도형-온리 폴백으로
      }
    }
  }
  return new ImageResponse(<ShapesCard />, { ...OG_SIZE });
}

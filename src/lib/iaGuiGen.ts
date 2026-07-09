// ItemsAdder 폰트-이미지 GUI 빌드타임 제너레이터 (Desktop 가이드 §4·§7·§8 기반).
//   디자인 1장(PNG 버퍼) → ≤256·짝수 타일 그리드 분할 → 픽셀 퍼펙트 scale_ratio 산출
//   → font_images YAML(행별 y_position 스택) + 메뉴 타이틀 문자열(행간 가로 복귀) 자동 생성.
//
// 가이드 핵심:
//   · ItemsAdder엔 x/y 배치가 없다 — GUI는 타이틀 텍스트에 이미지를 글리프처럼 끼우고 :offset_N: 으로 민다.
//   · scale_ratio = 글리프 렌더 높이(GUI 단위). y_position ≤ scale_ratio (넘으면 흰 네모).
//   · 픽셀 퍼펙트: scale_ratio = 타일높이 ÷ guiScale → 텍스처 1px = 화면 1px(다운스케일 0).
//   · 폰트 이미지 한 변 ≤ 256px, 짝수. 높이 ≤256 이면 단일 행(권장). 초과 시 행 그리드 + y_position 스택(§8).
//   · 행 그리드: 행별 y_position = topY − row×scale_ratio. 타이틀은 행마다 가로 복귀 offset = −(행 표시폭 + 1).

import sharp from "sharp";

const NAME_RE = /^[a-z0-9_]+$/;

export interface GuiDesignSpec {
  namespace: string; // 소문자/숫자/_
  id: string; // 타일 이름 prefix
  targetGuiScale: number; // 픽셀 퍼펙트 기준 guiScale (소스 = 표시 × 이 값)
  tileSize?: number; // 타일 최대 한 변 (≤256, 짝수). 기본 256
  anchorOffset?: number; // 인벤토리 앵커 보정. 기본 -8
  yPosition?: number; // 최상단 행 y_position. 기본 = scale_ratio
  seamCorrection?: number; // 타일간 가로 이음새. 기본 -1
  rowReturnCorrection?: number; // 행간 가로복귀 반올림 보정(인게임 확정). 기본 0
}

export interface Tile {
  name: string;
  fileName: string;
  row: number;
  col: number;
  width: number; // 원본 px
  height: number; // 원본 px
}

export interface FontImageEntry {
  path: string;
  scale_ratio: number;
  y_position: number;
}

export interface GuiBuildResult {
  tiles: Tile[];
  yaml: string;
  titleString: string;
  scaleRatio: number;
  topYPosition: number;
  rows: number;
  cols: number;
  displayWidth: number; // 한 행 표시폭(GUI)
}

// 타일 높이 H, 타깃 guiScale 기준 픽셀 퍼펙트 렌더 높이(=scale_ratio).
export function pixelPerfectScaleRatio(tileHeight: number, guiScale: number): number {
  const v = Math.round(tileHeight / guiScale);
  if (v > 256) throw new Error(`scale_ratio(${v}) > 256 — 타일 높이(${tileHeight})를 줄이거나 guiScale을 올리세요.`);
  return v;
}

// 한 타일이 표시되는 폭(GUI 단위) = 폭 × (scale_ratio / 높이).
export function renderedWidth(tile: Tile, scaleRatio: number): number {
  return Math.round(tile.width * (scaleRatio / tile.height));
}

export function validateSpec(spec: GuiDesignSpec, scaleRatio: number, topY: number): void {
  const errs: string[] = [];
  if (!NAME_RE.test(spec.namespace)) errs.push("namespace는 소문자/숫자/_ 만 허용됩니다.");
  if (!NAME_RE.test(spec.id)) errs.push("id는 소문자/숫자/_ 만 허용됩니다.");
  if (topY > scaleRatio) errs.push(`최상단 y_position(${topY}) > scale_ratio(${scaleRatio}) → 흰 네모.`);
  const ts = spec.tileSize ?? 256;
  if (ts > 256 || ts % 2 !== 0) errs.push("tileSize는 256 이하의 짝수여야 합니다.");
  if (errs.length) throw new Error("[GUI 검증 실패]\n- " + errs.join("\n- "));
}

// 타일 그리드 배치 계산(순수) — 위치/이름만. 추출(파일/버퍼)은 호출부가 담당.
interface TilePlan { tile: Tile; left: number; top: number; }
function planTilesGrid(W: number, H: number, spec: GuiDesignSpec): TilePlan[] {
  if (W % 2 !== 0 || H % 2 !== 0) throw new Error(`원본(${W}×${H})은 가로·세로 모두 짝수여야 합니다.`);
  const tileSize = spec.tileSize ?? 256;
  const cols = Math.ceil(W / tileSize);
  const rows = Math.ceil(H / tileSize);
  const plans: TilePlan[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * tileSize, top = row * tileSize;
      let width = Math.min(tileSize, W - left);
      let height = Math.min(tileSize, H - top);
      width -= width % 2;
      height -= height % 2;
      const name = `${spec.id}_${row}_${col}`;
      plans.push({ tile: { name, fileName: `${name}.png`, row, col, width, height }, left, top });
    }
  }
  return plans;
}

// ≤256·짝수 타일 그리드로 잘라 outDir 에 PNG 저장(정적 베이크 — 스크립트용).
export async function sliceImageGrid(src: Buffer, spec: GuiDesignSpec, outDir: string): Promise<Tile[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const meta = await sharp(src).metadata();
  const plans = planTilesGrid(meta.width!, meta.height!, spec);
  await fs.mkdir(outDir, { recursive: true });
  for (const p of plans) {
    await sharp(src).extract({ left: p.left, top: p.top, width: p.tile.width, height: p.tile.height })
      .png().toFile(path.join(outDir, p.tile.fileName));
  }
  return plans.map((p) => p.tile);
}

// 동일하게 자르되 파일 대신 버퍼 반환(웹 라우트 — 개인 팩 zip 생성용).
export async function sliceImageGridBuffers(
  src: Buffer, spec: GuiDesignSpec,
): Promise<Array<{ tile: Tile; buffer: Buffer }>> {
  const meta = await sharp(src).metadata();
  const plans = planTilesGrid(meta.width!, meta.height!, spec);
  return Promise.all(plans.map(async (p) => ({
    tile: p.tile,
    buffer: await sharp(src).extract({ left: p.left, top: p.top, width: p.tile.width, height: p.tile.height }).png().toBuffer(),
  })));
}

// 행별 y_position 스택: y_position(row) = topY − row × scale_ratio (행 높이 = scale_ratio 가정).
export function buildFontImagesGrid(
  tiles: Tile[], scaleRatio: number, topY: number, pathPrefix = "font",
): Record<string, FontImageEntry> {
  const out: Record<string, FontImageEntry> = {};
  for (const t of tiles) {
    out[t.name] = { path: `${pathPrefix}/${t.fileName}`, scale_ratio: scaleRatio, y_position: topY - t.row * scaleRatio };
  }
  return out;
}

export function serializeFontImages(namespace: string, fontImages: Record<string, FontImageEntry>): string {
  const lines = [`info:`, `  namespace: ${namespace}`, ``, `font_images:`];
  for (const [name, e] of Object.entries(fontImages)) {
    lines.push(`  ${name}:`, `    path: ${e.path}`, `    scale_ratio: ${e.scale_ratio}`, `    y_position: ${e.y_position}`);
  }
  return lines.join("\n") + "\n";
}

// 타이틀: anchor + (행0 타일+이음새) + 복귀offset + (행1 …). 행간 복귀 = −(행 표시폭 + 1).
export function buildTitleGrid(spec: GuiDesignSpec, tiles: Tile[], scaleRatio: number): string {
  const anchor = spec.anchorOffset ?? -8;
  const seam = spec.seamCorrection ?? -1;
  const off = (px: number) => `:offset_${px}:`;
  const rowNums = [...new Set(tiles.map((t) => t.row))].sort((a, b) => a - b);
  let s = off(anchor);
  rowNums.forEach((row, ri) => {
    const rowTiles = tiles.filter((t) => t.row === row).sort((a, b) => a.col - b.col);
    rowTiles.forEach((t, ci) => {
      s += `:${t.name}:`;
      if (ci < rowTiles.length - 1) s += off(seam);
    });
    if (ri < rowNums.length - 1) {
      const rowW = rowTiles.reduce((sum, t) => sum + renderedWidth(t, scaleRatio), 0);
      s += off(-(rowW + 1) + (spec.rowReturnCorrection ?? 0)); // 가로 복귀(+ 반올림 보정). 인게임서 ±1.
    }
  });
  return s;
}

export async function buildGui(src: Buffer, spec: GuiDesignSpec, outDir: string): Promise<GuiBuildResult> {
  const tiles = await sliceImageGrid(src, spec, outDir);
  const tileH = tiles[0].height; // 균일 행 높이 가정
  const scaleRatio = pixelPerfectScaleRatio(tileH, spec.targetGuiScale);
  const topY = spec.yPosition ?? scaleRatio;
  validateSpec(spec, scaleRatio, topY);

  const fontImages = buildFontImagesGrid(tiles, scaleRatio, topY);
  const yaml = serializeFontImages(spec.namespace, fontImages);
  const titleString = buildTitleGrid(spec, tiles, scaleRatio);
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const cols = Math.max(...tiles.map((t) => t.col)) + 1;
  const displayWidth = tiles.filter((t) => t.row === 0).reduce((sum, t) => sum + renderedWidth(t, scaleRatio), 0);

  return { tiles, yaml, titleString, scaleRatio, topYPosition: topY, rows, cols, displayWidth };
}

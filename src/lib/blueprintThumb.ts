import sharp from "sharp";

// .bp(Axiom 블루프린트)에 내장된 표지 썸네일(PNG) 추출 — Axiom "표지 이미지" 기능 그대로 재현.
//
// .bp 구조: 4바이트 magic(0a e5 bb 36) + 버전 int(big-endian) 뒤에 "비압축 NBT" 컴파운드가 오고,
// 그 안의 Thumbnail 태그가 PNG 바이트배열이다(블록 데이터는 파일 뒤쪽의 별도 gzip 블록 — 여기선 무시).
// Axiom 에디터에서 블루프린트를 회전시켜 만든 96×96 PNG 가 그대로 박혀 있으므로, NBT 파서 없이도
// PNG 시그니처~IEND 청크만 잘라내면 원본 썸네일을 그대로 얻을 수 있다(추가 도구·외부 프로세스 불필요).

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44]); // IEND 청크 타입(뒤에 4바이트 CRC)

/** .bp 버퍼에서 내장 PNG 썸네일 바이트를 잘라낸다(없거나 손상 시 null). 순수 바이트 스캔. */
export function carveBpThumbnailPng(bp: Buffer): Buffer | null {
  const start = bp.indexOf(PNG_SIG);
  if (start < 0) return null;
  const iend = bp.indexOf(IEND, start);
  if (iend < 0) return null;
  const end = iend + 4 + 4; // IEND 타입(4) + CRC(4)
  if (end > bp.length || end <= start) return null;
  return bp.subarray(start, end);
}

export interface BpCover {
  /** webp 로 인코딩된 표지 이미지(저장/서빙용). */
  webp: Buffer;
  /** 내장 원본 썸네일 픽셀 크기(보통 96×96). */
  srcWidth: number;
  srcHeight: number;
}

/**
 * .bp 버퍼 → 표지 webp 생성. 내장 썸네일을 잘라 sharp 로 검증 후 size 픽셀로 확대해 webp 로 인코딩한다.
 * 작은 렌더(96px)를 nearest(픽셀 선명) 보간으로 키워 마인크래프트 톤에 맞는 또렷한 표지를 만든다.
 * 썸네일이 없거나(구버전 .bp) PNG 가 깨졌으면 null → 호출부에서 사용자 업로드/플레이스홀더로 폴백.
 */
export async function extractBpCover(bp: Buffer, size = 384): Promise<BpCover | null> {
  const png = carveBpThumbnailPng(bp);
  if (!png) return null;
  try {
    const meta = await sharp(png, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return null;
    const webp = await sharp(png, { failOn: "none" })
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: false, kernel: "nearest" })
      .webp({ quality: 90 })
      .toBuffer();
    return { webp, srcWidth: meta.width, srcHeight: meta.height };
  } catch {
    return null;
  }
}

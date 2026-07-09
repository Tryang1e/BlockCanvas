import sharp from 'sharp'

// 업로드 이미지 자동 최적화 설정
const MAX_DIM = 2048 // 긴 변 최대 px (포트폴리오 표시에 충분)
const WEBP_QUALITY = 82

// 최적화 대상 이미지 MIME. (gif=애니메이션 보존 위해 제외, svg=벡터 보존, 영상/오디오는 호출부에서 제외)
const OPTIMIZABLE = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export interface OptimizeResult {
  buffer: Buffer
  optimized: boolean
}

/**
 * 업로드된 이미지를 긴 변 2048px 이내로 리사이즈하고 WebP(품질 82)로 변환한다.
 * - 비대상(영상/gif/svg 등)·애니메이션·변환 후 더 커지는 경우·실패 시 → 원본 그대로 반환.
 * - 절대 throw 하지 않아 업로드 자체를 막지 않는다.
 */
export async function optimizeImage(input: Buffer, mimeType?: string): Promise<OptimizeResult> {
  if (!mimeType || !OPTIMIZABLE.has(mimeType.toLowerCase())) {
    return { buffer: input, optimized: false }
  }
  try {
    const meta = await sharp(input, { failOn: 'none' }).metadata()

    // 다중 프레임(애니메이션 webp 등)은 변환하지 않고 원본 보존
    if ((meta.pages ?? 1) > 1) {
      return { buffer: input, optimized: false }
    }

    let pipeline = sharp(input, { failOn: 'none' }).rotate() // EXIF 방향 자동 보정
    if ((meta.width ?? 0) > MAX_DIM || (meta.height ?? 0) > MAX_DIM) {
      pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    }

    const out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()

    // 이미 잘 압축된 작은 파일이라 오히려 커지면 원본 유지
    if (out.length >= input.length) {
      return { buffer: input, optimized: false }
    }
    return { buffer: out, optimized: true }
  } catch (e) {
    console.warn('[image-optimize] 최적화 실패, 원본 사용:', (e as any)?.message || e)
    return { buffer: input, optimized: false }
  }
}

/** 최적화로 webp 변환된 경우 파일명 확장자를 .webp 로 교체한다. */
export function toWebpName(safeName: string): string {
  return (/\.[A-Za-z0-9]+$/.test(safeName) ? safeName.replace(/\.[A-Za-z0-9]+$/, '') : safeName) + '.webp'
}

export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png'
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg'
  }

  // GIF: GIF87a / GIF89a (47 49 46 38 37/39 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif'
  }

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  // MP4: check for 'ftyp' at index 4 (0x66 0x74 0x79 0x70)
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return 'video/mp4'
  }

  return null
}

export async function validateUploadedFile(file: File): Promise<{ success: boolean; error?: string; correctedExtension?: string }> {
  if (!file) {
    return { success: false, error: '업로드할 파일이 비어있습니다.' }
  }

  // 1. MIME Sniffing via Buffer Magic Bytes (Anti-Spoofing) - Blazing Fast 12-byte Slice Sniffing!
  let mimeType: string | null = null
  try {
    // We only need the first 12 bytes to identify PNG, JPG, GIF, WEBP, or MP4 headers.
    // Reading a slice prevents loading multi-gigabyte or multi-megabyte files into memory during validation!
    let sliceBuffer = Buffer.from(await file.slice(0, 12).arrayBuffer())

    // Next.js server-side File polyfill stream slice bug fallback:
    // If sliceBuffer is empty or incomplete, fall back to safe arrayBuffer read for reasonable file sizes.
    if (sliceBuffer.length < 12 && file.size < 50 * 1024 * 1024) {
      const fullBuffer = Buffer.from(await file.arrayBuffer())
      sliceBuffer = fullBuffer.subarray(0, 12)
    }

    mimeType = sniffMimeType(sliceBuffer)
  } catch (error) {
    console.error('[Upload Validator] Sniffing failed:', error)
    return { success: false, error: '파일 바이너리 검증 중 내부 서버 오류가 발생했습니다.' }
  }

  const name = file.name.toLowerCase()
  let extension = name.split('.').pop() || ''

  const mimeToExtensionMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4'
  }

  // 2. Extension Normalization for Clipboard Paste & Blobs
  // If the file extension is generic/missing (like 'blob', 'image') but magic bytes identify it,
  // we dynamically correct the extension to allow robust rich-text copy pasting!
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4']
  if (!allowedExtensions.includes(extension) && mimeType && mimeToExtensionMap[mimeType]) {
    extension = mimeToExtensionMap[mimeType]
  }

  // 3. Final Extension Whitelist Check
  if (!allowedExtensions.includes(extension)) {
    return { success: false, error: '허용되지 않는 파일 형식입니다. (PNG, JPG, JPEG, GIF, WEBP 이미지 및 MP4 동영상만 허용)' }
  }

  // 4. File size limits
  const isVideo = extension === 'mp4'
  const sizeLimit = isVideo ? 1024 * 1024 * 1024 : 50 * 1024 * 1024 // 1GB for video, 50MB for image
  if (file.size > sizeLimit) {
    return { success: false, error: isVideo ? '동영상 파일은 최대 1GB까지 업로드 가능합니다.' : '이미지 파일은 최대 50MB까지 업로드 가능합니다.' }
  }

  // 5. MIME Sniffing Verification
  if (!mimeType) {
    return { success: false, error: '알 수 없는 파일 포맷이거나 파일이 손상되었습니다. 파일 헤더가 올바르지 않습니다.' }
  }

  if (isVideo && mimeType !== 'video/mp4') {
    return { success: false, error: '동영상 파일 유형 검증에 실패했습니다. (MP4 코덱 동영상이 아닙니다)' }
  }

  if (!isVideo && !mimeType.startsWith('image/')) {
    return { success: false, error: '이미지 파일 유형 검증에 실패했습니다. 올바른 이미지 파일이 아닙니다.' }
  }

  return { success: true, correctedExtension: mimeToExtensionMap[mimeType] }
}

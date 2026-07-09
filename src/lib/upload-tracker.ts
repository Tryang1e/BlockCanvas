// 에디터 한 편집 세션 동안 /api/upload 로 올라온 이미지 URL을 모아둔다(클라이언트 전용 모듈 싱글톤).
// 발행 시 이 목록을 서버로 보내, 최종 본문에 포함되지 않은(중간에 올렸다 지운) 잉여 이미지를
// 서버가 안전하게 정리하는 데 사용한다.
const sessionUploads = new Set<string>()

export function trackSessionUpload(url?: string | null) {
  if (typeof url === 'string' && url.startsWith('/uploads/')) {
    sessionUploads.add(url)
  }
}

export function getSessionUploads(): string[] {
  return Array.from(sessionUploads)
}

export function clearSessionUploads() {
  sessionUploads.clear()
}

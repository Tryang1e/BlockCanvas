import DOMPurify from 'isomorphic-dompurify'

// iframe 임베드를 허용할 신뢰 호스트 (정상 영상/오디오 임베드만 통과).
// 그 외 도메인의 iframe은 정화 시 제거되어, 크리에이터가 임의 사이트를
// 방문자에게 프레이밍(피싱/클릭재킹/드라이브바이)하는 것을 차단한다.
const ALLOWED_IFRAME_HOSTS = new Set<string>([
  'youtube.com', 'www.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
  'vimeo.com', 'player.vimeo.com',
  'twitch.tv', 'www.twitch.tv', 'player.twitch.tv', 'clips.twitch.tv',
  'open.spotify.com',
  'w.soundcloud.com',
])

function isAllowedIframeSrc(src: string): boolean {
  if (!src) return false
  try {
    const u = new URL(src, 'https://placeholder.invalid')
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    return ALLOWED_IFRAME_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

// isomorphic-dompurify 싱글톤에 훅을 1회만 등록한다 (HMR/다중 import 안전).
const hookFlag = globalThis as unknown as { __bcIframeHook?: boolean }
if (!hookFlag.__bcIframeHook) {
  ;(DOMPurify as any).addHook('uponSanitizeElement', (node: any, data: any) => {
    if (data && data.tagName === 'iframe') {
      const src = (node.getAttribute && node.getAttribute('src')) || ''
      if (!isAllowedIframeSrc(src)) {
        if (typeof node.remove === 'function') node.remove()
        else if (node.parentNode) node.parentNode.removeChild(node)
      }
    }
  })
  hookFlag.__bcIframeHook = true
}

/**
 * 리치 텍스트/임베드 HTML을 정화한다. iframe은 허용 호스트만 통과한다.
 * @param html 원본 HTML 문자열
 * @param extraAttrs 추가로 허용할 속성 (예: HTMLRenderer의 data-* 커스텀 속성)
 */
export function sanitizeRichHtml(html: string, extraAttrs: string[] = []): string {
  return (DOMPurify as any).sanitize(html || '', {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', ...extraAttrs],
  }) as string
}

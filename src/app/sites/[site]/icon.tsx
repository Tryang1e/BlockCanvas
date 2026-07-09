// ── 크리에이터 사이트 파비콘(브라우저 탭 아이콘, 32×32) ────────────────────
// 마크 계정이 연동된 크리에이터는 McAvatar(src/components/dashboard/McAvatar.tsx)와
// 동일한 공급원 순서(minotar → crafatar → mc-heads)로 머리 이미지를 서버에서
// 짧은 타임아웃으로 받아 임베드한다. 실패하면 테마색 블록 타일 + 이니셜로 폴백.
// ⚠ 파비콘 라우트는 절대 500 금지 — 최종 폴백은 브랜드 레드(#FF424D) 단색 사각형.
import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { loadOgFonts } from '@/lib/ogCard'

export const runtime = 'nodejs'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const RED = '#FF424D'

// McAvatar 와 동일한 3단 폴백 공급원. 파비콘은 32px 고정이라 원본 32px 를 그대로 요청.
function headSources(uuid: string): string[] {
  return [
    `https://minotar.net/helm/${uuid}/32.png`,
    `https://crafatar.com/avatars/${uuid}?size=32&overlay`,
    `https://mc-heads.net/avatar/${uuid}/32`,
  ]
}

// 머리 이미지를 data URI 로 임베드(공급원별 1.2s 타임아웃, 실패 시 다음 공급원 → 최종 null)
async function fetchHeadDataUri(rawUuid: string): Promise<string | null> {
  const uuid = rawUuid.replace(/-/g, '')
  if (!/^[0-9a-fA-F]{32}$/.test(uuid)) return null // UUID 형식 검증(URL 주입 차단)
  for (const url of headSources(uuid)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1200) })
      if (!res.ok) continue
      const type = (res.headers.get('content-type') || 'image/png').split(';')[0]
      if (!type.startsWith('image/')) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length === 0 || buf.length > 256 * 1024) continue
      return `data:${type};base64,${buf.toString('base64')}`
    } catch {
      // 타임아웃/네트워크 실패 → 다음 공급원 시도
    }
  }
  return null
}

// #RGB/#RRGGBB → 상대 휘도(0~1). 밝은 타일에서 이니셜을 잉크로 뒤집는 판정용.
function hexLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// 테마색 블록 타일(마크 큐브 베벨: 상단 하이라이트 + 하단 셰이드) + 볼드 이니셜.
// 배경이 밝으면(흰/크림 테마가 흔함) 이니셜을 잉크로 플립 — 16px 탭에서 흰 글자가 묻히지 않게.
// 한글 이니셜은 자모 밀도가 높아 라틴 기준 19px 로는 획이 뭉개짐 → 풀블리드에 가깝게 확대.
function blockTile(bg: string, initial: string) {
  const bright = hexLuminance(bg) > 0.6
  const isHangul = /[가-힣]/.test(initial)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: bg,
        borderRadius: 4,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3, display: 'flex', backgroundColor: 'rgba(255,255,255,0.28)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 4, display: 'flex', backgroundColor: 'rgba(0,0,0,0.30)' }} />
      <div
        style={{
          display: 'flex',
          fontFamily: 'Pretendard',
          fontSize: isHangul ? 23 : 19,
          fontWeight: 900,
          color: bright ? '#1E2022' : '#FFFFFF',
          lineHeight: 1,
          textShadow: bright ? 'none' : '0 1px 2px rgba(0,0,0,0.45)',
        }}
      >
        {initial}
      </div>
    </div>
  )
}

export default async function Icon({
  params,
}: {
  params: Promise<{ site: string }>
}) {
  try {
    const { site } = await params
    let creatorName = site
    try {
      creatorName = decodeURIComponent(site)
    } catch {
      // 디코드 실패 시 원본 그대로 조회
    }
    creatorName = creatorName.toLowerCase()

    const profile = await prisma.profile.findUnique({
      where: { creator_name: creatorName },
      select: {
        display_name: true,
        creator_name: true,
        minecraft_uuid: true,
        role: true,
        portfolios: { select: { theme_bg_color: true, is_published: true } },
      },
    })

    // 페이지/OG 와 동일한 공개 게이트 — 비공개 대상은 브랜드 타일로 차단(이니셜도 노출 금지)
    const isPublished = profile?.portfolios ? (profile.portfolios.is_published ?? true) : false
    const fonts = await loadOgFonts().catch(() => [])
    const fontOpt = fonts.length ? { fonts } : {}
    if (!profile || profile.role === 'user' || profile.creator_name === 'root' || !isPublished) {
      return new ImageResponse(blockTile(RED, 'B'), { ...size, ...fontOpt })
    }

    // 1순위: 연동된 마크 계정 머리
    if (profile.minecraft_uuid) {
      const head = await fetchHeadDataUri(profile.minecraft_uuid)
      if (head) {
        return new ImageResponse(
          (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={head} width={32} height={32} style={{ width: 32, height: 32, borderRadius: 4 }} />
          ),
          { ...size }
        )
      }
    }

    // 2순위: 테마색 블록 타일 + 크리에이터 이니셜 (theme_bg_color 는 hex 형식 검증 후에만 사용)
    const rawTheme = profile.portfolios?.theme_bg_color || ''
    const theme = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rawTheme) ? rawTheme : '#222222'
    const initial = (
      Array.from((profile.display_name || profile.creator_name || 'B').trim())[0] || 'B'
    ).toUpperCase()
    return new ImageResponse(blockTile(theme, initial), { ...size, ...fontOpt })
  } catch {
    // 최종 폴백: 어떤 경우에도 500 금지 — 브랜드 레드 단색 사각형
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: RED }} />,
      { ...size }
    )
  }
}

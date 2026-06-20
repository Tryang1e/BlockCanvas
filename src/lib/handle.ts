import { prisma } from '@/lib/prisma'

// 서브도메인({handle}.craftopia.work)·세션 키로 쓰이는 creator_name(핸들) 생성 유틸.
// 핸들은 ASCII 소문자/숫자만 허용(서브도메인 제약) — 한글/특수문자는 제거된다.

// 라우팅상 예약된 서브도메인/경로(proxy.ts 제외 목록 + 시스템 경로). 핸들로 쓰면 사이트가 안 뜨므로 회피.
const RESERVED = new Set([
  'www', 'api', 'admin', 'dashboard', 'auth', 'login', 'explore', 'creators', 'feed',
  'adminpage', 'uploads', 'dynmap-proxy', 'sites', 'project', 'editor', 'settings',
  'minecraft', 'discord', 'craftopia', 'mail', 'support', 'help', 'about', 'privacy',
])

/** ASCII 소문자/숫자만 남긴 url-safe 슬러그(최대 20자). 비면 빈 문자열. */
function slugify(base: string): string {
  return (base || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
}

function isUsable(candidate: string): boolean {
  return candidate.length >= 3 && !RESERVED.has(candidate)
}

/**
 * 고유한 creator_name(핸들)을 생성한다.
 *  - base(닉네임 등)를 슬러그화. 사용 불가(한글-only·예약어·너무 짧음)면 fallbackBase(이메일 앞부분 등)를 시도.
 *  - 둘 다 사용 불가면 'user' 루트로 보정.
 *  - Profile.creator_name @unique 와 충돌하지 않을 때까지 난수 접미사로 재시도.
 */
export async function generateUniqueHandle(base: string, fallbackBase = ''): Promise<string> {
  const primary = slugify(base)
  const secondary = slugify(fallbackBase)
  const root = isUsable(primary) ? primary : isUsable(secondary) ? secondary : 'user'

  for (let i = 0; i < 16; i++) {
    // 첫 시도는 root 그대로(예약어가 아니고 충분히 길 때만), 이후엔 4자리 난수 접미사.
    const candidate = i === 0 && isUsable(root) ? root : `${root}${Math.floor(1000 + Math.random() * 9000)}`
    if (RESERVED.has(candidate)) continue
    const clash = await prisma.profile.findUnique({ where: { creator_name: candidate } })
    if (!clash) return candidate
  }
  // 최후의 보루: 충돌이 사실상 불가능한 시간기반 핸들
  return `user${Date.now().toString(36)}`
}

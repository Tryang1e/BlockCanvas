'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'
import { cookies, headers } from 'next/headers'
import { signSession } from '@/lib/session'

function parseThemeDesignConfig(themeBgEffect: string | null | undefined) {
  let effect = 'none'
  let cardRound = false
  let sectionRound = false
  let imageRound = false
  let gridGap = 24

  if (themeBgEffect) {
    const parts = themeBgEffect.split('|')
    effect = parts[0] || 'none'
    parts.forEach(part => {
      if (part.startsWith('card:')) {
        cardRound = part.replace('card:', '') === 'round'
      }
      if (part.startsWith('section:')) {
        sectionRound = part.replace('section:', '') === 'round'
      }
      if (part.startsWith('image:')) {
        imageRound = part.replace('image:', '') === 'round'
      }
      if (part.startsWith('gap:')) {
        const val = parseInt(part.replace('gap:', ''), 10)
        if (!isNaN(val)) gridGap = val
      }
    })
  }

  return { effect, cardRound, sectionRound, imageRound, gridGap }
}

function serializeThemeDesignConfig(
  effect: string,
  cardRound: boolean,
  sectionRound: boolean,
  imageRound: boolean,
  gridGap: number
) {
  return `${effect}|card:${cardRound ? 'round' : 'sharp'}|section:${sectionRound ? 'round' : 'sharp'}|image:${imageRound ? 'round' : 'sharp'}|gap:${gridGap}`
}

async function getDynamicConfig() {
  const host = (await headers()).get('host') || 'craftopia.work'
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  const isDev = process.env.NODE_ENV !== 'production'
  
  const protoHeader = (await headers()).get('x-forwarded-proto')
  const protocol = protoHeader === 'https' ? 'https' : 'http'
  
  return {
    isLocal,
    isDev,
    protocol,
    baseDomain: isLocal ? 'localhost:3000' : 'craftopia.work',
    // 터널 개발 환경(craftopia.work)에서는 서브도메인 간 세션 공유를 위해 쿠키 도메인을 '.craftopia.work'로 설정하고, 순수 localhost인 경우에만 도메인을 생략합니다.
    cookieDomain: isLocal ? undefined : '.craftopia.work'
  }
}

export async function updateProfileAction(formData: FormData) {
  const creatorName = formData.get('creator_name') as string
  const authCreatorId = await requireAuth(creatorName)

  const displayName = formData.get('display_name') as string
  const discordId = formData.get('discord_id') as string
  const headline = formData.get('headline') as string
  const aboutText = formData.get('about_text') as string
  const contactEmail = formData.get('contact_email') as string
  const youtubeUrl = formData.get('youtube_url') as string
  const twitterUrl = formData.get('twitter_url') as string
  const instagramUrl = formData.get('instagram_url') as string
  const patreonUrl = formData.get('patreon_url') as string
  const footerTitle = formData.get('footer_title') as string
  const footerSubtitle = formData.get('footer_subtitle') as string
  
  const themeBgColorInput = formData.get('theme_bg_color')
  const themeBgEffectInput = formData.get('theme_bg_effect')
  
  const snsSettingsRaw = formData.get('sns_settings') as string
  
  // Update profiles table
  await prisma.profile.update({
    where: { id: authCreatorId },
    data: {
      display_name: displayName,
      discord_id: discordId
    }
  })

  // Fetch existing portfolio to preserve the serialized design configurations (e.g. card:round, gap:24)
  const existing = await prisma.portfolio.findUnique({
    where: { creator_id: authCreatorId }
  })

  // 1. theme_bg_color 결정 (폼 데이터에 없으면 기존 값 보존)
  let finalThemeBgColor = '#222222'
  if (themeBgColorInput !== null) {
    finalThemeBgColor = (themeBgColorInput as string) || '#222222'
  } else if (existing) {
    finalThemeBgColor = existing.theme_bg_color || '#222222'
  }

  // 2. theme_bg_effect 결정 (기존 모서리 곡률 및 갭 설정을 보존하면서 효과명 교환)
  let finalThemeBgEffect = 'none|card:sharp|section:sharp|image:sharp|gap:24'
  if (themeBgEffectInput !== null) {
    const newEffect = (themeBgEffectInput as string) || 'none'
    const existingConfig = parseThemeDesignConfig(existing?.theme_bg_effect)
    finalThemeBgEffect = serializeThemeDesignConfig(
      newEffect,
      existingConfig.cardRound,
      existingConfig.sectionRound,
      existingConfig.imageRound,
      existingConfig.gridGap
    )
  } else if (existing) {
    finalThemeBgEffect = existing.theme_bg_effect || 'none|card:sharp|section:sharp|image:sharp|gap:24'
  }

  const portfolioData = {
    headline: headline,
    about_text: aboutText,
    contact_email: contactEmail,
    youtube_url: youtubeUrl,
    twitter_url: twitterUrl,
    instagram_url: instagramUrl,
    patreon_url: patreonUrl,
    footer_title: footerTitle,
    footer_subtitle: footerSubtitle,
    theme_bg_color: finalThemeBgColor,
    theme_bg_effect: finalThemeBgEffect,
    sns_settings: snsSettingsRaw || '{}'
  }

  await prisma.portfolio.upsert({
    where: { creator_id: authCreatorId },
    update: portfolioData,
    create: { creator_id: authCreatorId, ...portfolioData }
  })

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}

export async function updateThemeBgColorAction(creatorName: string, themeBgColor: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.update({
    where: { creator_id: authCreatorId },
    data: { theme_bg_color: themeBgColor }
  })

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}

export async function updateThemeBgEffectAction(creatorName: string, themeBgEffect: string) {
  const authCreatorId = await requireAuth(creatorName)

  const existing = await prisma.portfolio.findUnique({
    where: { creator_id: authCreatorId }
  })

  const existingConfig = parseThemeDesignConfig(existing?.theme_bg_effect)
  const newEffect = themeBgEffect || 'none'

  const finalThemeBgEffect = serializeThemeDesignConfig(
    newEffect,
    existingConfig.cardRound,
    existingConfig.sectionRound,
    existingConfig.imageRound,
    existingConfig.gridGap
  )

  await prisma.portfolio.update({
    where: { creator_id: authCreatorId },
    data: { theme_bg_effect: finalThemeBgEffect }
  })

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}

export async function updatePortfolioDesignAction(creatorName: string, themeBgEffectCombined: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.update({
    where: { creator_id: authCreatorId },
    data: { theme_bg_effect: themeBgEffectCombined }
  })

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}

export async function updateSubdomainAction(currentSubdomain: string, newSubdomain: string) {
  // 1. Verify user session
  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(currentSubdomain)
  } catch (error) {
    return { error: '권한이 없거나 만료되었습니다. 다시 로그인해 주세요.' }
  }

  // 2. Normalize and check new subdomain format
  const normalizedSubdomain = newSubdomain.trim().toLowerCase()
  
  // Format check: only english lowercase letters, numbers, and hyphens. Length between 3 and 20.
  const regex = /^[a-z0-9-]+$/
  if (!regex.test(normalizedSubdomain)) {
    return { error: '하위 도메인은 영문 소문자, 숫자, 하이픈(-)만 포함할 수 있습니다.' }
  }

  if (normalizedSubdomain.length < 3 || normalizedSubdomain.length > 20) {
    return { error: '하위 도메인은 3자 이상 20자 이하여야 합니다.' }
  }

  // 3. Prevent reserved/excluded subdomains
  const excludedSubdomains = ['www', 'api', 'admin', 'dashboard', 'login', 'signup', 'main']
  if (excludedSubdomains.includes(normalizedSubdomain)) {
    return { error: '사용할 수 없는 도메인 이름입니다. 다른 이름을 입력해 주세요.' }
  }

  // 4. Check uniqueness in the database
  const existingProfile = await prisma.profile.findUnique({
    where: { creator_name: normalizedSubdomain }
  })
  
  if (existingProfile && existingProfile.id !== authCreatorId) {
    return { error: '이미 사용 중인 도메인 주소입니다. 다른 주소를 입력해 주세요.' }
  }

  // 5. Perform the update
  try {
    await prisma.profile.update({
      where: { id: authCreatorId },
      data: { creator_name: normalizedSubdomain }
    })
  } catch (dbError) {
    console.error('Failed to update subdomain:', dbError)
    return { error: '데이터베이스 업데이트 중 오류가 발생했습니다.' }
  }

  // 6. Update session cookie
  const { protocol, baseDomain, cookieDomain, isDev } = await getDynamicConfig()
  const cookieStore = await cookies()
  const signedToken = signSession(normalizedSubdomain)
  cookieStore.set('session', signedToken, { 
    httpOnly: true, 
    secure: isDev ? false : (protocol === 'https'),
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain,
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  // 7. Revalidate paths
  revalidatePath(`/sites/${currentSubdomain}`)
  revalidatePath(`/sites/${normalizedSubdomain}`)

  return { 
    success: true, 
    newSubdomain: normalizedSubdomain,
    redirectUrl: `${protocol}://${normalizedSubdomain}.${baseDomain}/dashboard/portfolio`
  }
}

export async function getProfileForPreviewAction(creatorName: string) {
  const normalized = creatorName.toLowerCase()
  const profile = await prisma.profile.findFirst({
    where: { creator_name: normalized },
    include: {
      portfolios: true
    }
  })
  return profile
}



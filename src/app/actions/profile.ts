'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

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
  const themeBgColor = formData.get('theme_bg_color') as string
  const themeBgEffect = formData.get('theme_bg_effect') as string
  
  const snsSettingsRaw = formData.get('sns_settings') as string
  
  // Update profiles table
  await prisma.profile.update({
    where: { id: authCreatorId },
    data: {
      display_name: displayName,
      discord_id: discordId
    }
  })

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
    theme_bg_color: themeBgColor || '#222222',
    theme_bg_effect: themeBgEffect || 'none',
    sns_settings: snsSettingsRaw || '{}'
  }

  await prisma.portfolio.upsert({
    where: { creator_id: authCreatorId },
    update: portfolioData,
    create: { creator_id: authCreatorId, ...portfolioData }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateThemeBgColorAction(creatorName: string, themeBgColor: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.update({
    where: { creator_id: authCreatorId },
    data: { theme_bg_color: themeBgColor }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateThemeBgEffectAction(creatorName: string, themeBgEffect: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.update({
    where: { creator_id: authCreatorId },
    data: { theme_bg_effect: themeBgEffect }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updatePortfolioDesignAction(creatorName: string, themeBgEffectCombined: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.update({
    where: { creator_id: authCreatorId },
    data: { theme_bg_effect: themeBgEffectCombined }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

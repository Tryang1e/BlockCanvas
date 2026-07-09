import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import ProjectDetailsViewer from '@/components/creator/ProjectDetailsViewer'
import { verifySession } from '@/lib/session'
import { cache } from 'react'
import type { Metadata } from 'next'

// 게시물이 공개적으로 열람 가능한지: 발행 상태 + 숨긴 섹션이 아님
function isPubliclyViewable(project: { is_published?: boolean; section?: { is_visible: boolean } | null }) {
  return project.is_published === true && project.section?.is_visible !== false
}

const getProject = cache(async (project_id: string) => {
  return prisma.project.findUnique({
    where: { id: project_id },
    include: {
      creator: {
        select: { 
          creator_name: true, 
          display_name: true,
          avatar_url: true,
          discord_id: true,
          email: true,
          role: true,
          portfolios: {
            select: {
              headline: true,
              about_text: true,
              contact_email: true,
              youtube_url: true,
              twitter_url: true,
              instagram_url: true,
              patreon_url: true,
              sns_settings: true,
              banner_url: true,
              theme_bg_color: true
            }
          }
        }
      },
      section: { select: { is_visible: true } },
      widgets: {
        orderBy: { sort_order: 'asc' }
      }
    }
  })
})

export async function generateViewport() {
  return {
    themeColor: '#ff8b8b'
  }
}

export async function generateMetadata({ params }: { params: Promise<{ site: string, project_id: string }> }): Promise<Metadata> {
  const { site, project_id } = await params
  const creator_name = site
  const normalizedName = decodeURIComponent(creator_name)

  const project = await getProject(project_id)

  if (!project) return {}
  if (project.creator.role === 'user') return {}
  if (project.creator.creator_name.toLowerCase() !== normalizedName.toLowerCase()) return {}

  // 비공개 글/숨긴 섹션 글은 소유자에게만 메타 노출(외부 미리보기·임베드 차단)
  const metaIsOwner = verifySession((await cookies()).get('session')?.value) === project.creator.creator_name.toLowerCase()
  if (!metaIsOwner && !isPubliclyViewable(project)) return {}

  const creator = project.creator
  const displayName = creator.display_name || creator.creator_name
  const handle = creator.discord_id ? `@${creator.discord_id}` : `@${creator.creator_name}`
  const embedTitle = `${displayName} (${handle})`

  // Filter out [SIZE:...] tags from title and description
  const sizeRegex = /\s*\[SIZE:\s*\d+x\d+\s*\]/gi;
  const projectTitle = project.title.replace(sizeRegex, '').trim()
  const projectDesc = (project.description || '').replace(sizeRegex, '').trim()
  const embedDescription = `${projectTitle}\n\n${projectDesc}`.trim()

  // Base image fallback path
  let imageUrl = project.thumbnail_url || creator.portfolios?.banner_url || creator.avatar_url || ''
  if (imageUrl && imageUrl.startsWith('/')) {
    imageUrl = `https://${site}.craftopia.work${imageUrl}`
  }

  return {
    title: embedTitle,
    description: embedDescription,
    openGraph: {
      title: embedTitle,
      description: embedDescription,
      url: `https://${site}.craftopia.work/project/${project_id}`,
      siteName: 'BlockCanvas',
      images: imageUrl ? [{ url: imageUrl, alt: projectTitle }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: embedTitle,
      description: embedDescription,
      images: imageUrl ? [imageUrl] : [],
    }
  }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ site: string, project_id: string }> }) {
  const { site, project_id } = await params
  const creator_name = site
  const normalizedName = decodeURIComponent(creator_name)

  const project = await getProject(project_id)

  if (!project) return notFound()
  if (project.creator.role === 'user') return notFound()
  if (project.creator.creator_name.toLowerCase() !== normalizedName.toLowerCase()) return notFound()

  // 비공개 글/숨긴 섹션 글은 소유자만 직접 URL로 열람 가능
  const isOwner = verifySession((await cookies()).get('session')?.value) === project.creator.creator_name.toLowerCase()
  if (!isOwner && !isPubliclyViewable(project)) return notFound()

  const widgets = project.widgets.map(w => {
    let parsedContent = {}
    if (w.content) {
      try { parsedContent = JSON.parse(w.content) } catch(e) {}
    }
    return { ...w, widget_type: w.type, content: parsedContent }
  })

  // Apply SNS visibility settings
  const portfolios = project.creator.portfolios
  if (portfolios) {
    let snsSettings = { discord: true, youtube: true, twitter: true, instagram: true, patreon: false }
    if (portfolios.sns_settings) {
      try {
        snsSettings = typeof portfolios.sns_settings === 'string' ? JSON.parse(portfolios.sns_settings) : portfolios.sns_settings
      } catch (e) {}
    }
    if (snsSettings.youtube === false) portfolios.youtube_url = null
    if (snsSettings.twitter === false) portfolios.twitter_url = null
    if (snsSettings.instagram === false) portfolios.instagram_url = null
    if (snsSettings.patreon === false) portfolios.patreon_url = null
  }

  let otherProjects: any[] = []
  let relatedType = 'creator'

  // 섹션 우선 그룹화: 같은 섹션에 속한 게시물만 "이 섹션의 다른 게시물"로 보여준다.
  // 섹션에 속하지 않은(미배정) 게시물만 카테고리로 폴백한다.
  if (project.section_id) {
    otherProjects = await prisma.project.findMany({
      where: {
        creator_id: project.creator_id,
        section_id: project.section_id,
        id: { not: project.id },
        is_published: true,
        section: { section_type: { not: 'video_slider' }, is_visible: true }
      },
      orderBy: { sort_order: 'asc' }
    })
    if (otherProjects.length > 0) relatedType = 'section'
  } else if (project.category_id) {
    otherProjects = await prisma.project.findMany({
      where: {
        creator_id: project.creator_id,
        category_id: project.category_id,
        id: { not: project.id },
        is_published: true,
        OR: [
          { section_id: null },
          { section: { section_type: { not: 'video_slider' }, is_visible: true } }
        ]
      },
      orderBy: { created_at: 'desc' }
    })
    if (otherProjects.length > 0) relatedType = 'category'
  }

  const profileData = {
    creator_name: project.creator.creator_name,
    display_name: project.creator.display_name,
    discord_id: project.creator.discord_id || '',
    headline: portfolios?.headline || '',
    about_text: portfolios?.about_text || '',
    contact_email: portfolios?.contact_email || project.creator.email || '',
    youtube_url: portfolios?.youtube_url || '',
    twitter_url: portfolios?.twitter_url || '',
    instagram_url: portfolios?.instagram_url || '',
    patreon_url: portfolios?.patreon_url || '',
    sns_settings: portfolios?.sns_settings ? (typeof portfolios.sns_settings === 'string' ? JSON.parse(portfolios.sns_settings) : portfolios.sns_settings) : { discord: true, twitter: true, youtube: true, instagram: true, patreon: false },
    banner_url: portfolios?.banner_url || '',
    theme_bg_color: portfolios?.theme_bg_color || '#222222'
  }

  return (
    <ProjectDetailsViewer 
      project={project} 
      widgets={widgets} 
      creatorName={creator_name}
      otherProjects={otherProjects}
      relatedType={relatedType}
      profileData={profileData}
    />
  )
}

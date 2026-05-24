import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ProjectDetailsViewer from '@/components/creator/ProjectDetailsViewer'

export default async function ProjectDetailPage({ params }: { params: Promise<{ creator_name: string, project_id: string }> }) {
  const { creator_name, project_id } = await params
  const normalizedName = decodeURIComponent(creator_name)

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      creator: {
        select: { 
          creator_name: true, 
          display_name: true,
          avatar_url: true,
          discord_id: true,
          email: true,
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
      widgets: {
        orderBy: { sort_order: 'asc' }
      }
    }
  })

  if (!project) return notFound()
  if (project.creator.creator_name.toLowerCase() !== normalizedName.toLowerCase()) return notFound()

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

  if (project.category_id) {
    otherProjects = await prisma.project.findMany({
      where: { 
        creator_id: project.creator_id,
        category_id: project.category_id,
        id: { not: project.id },
        is_published: true,
        OR: [
          { section_id: null },
          { section: { section_type: { not: 'video_slider' } } }
        ]
      },
      orderBy: { created_at: 'desc' }
    })
    if (otherProjects.length > 0) relatedType = 'category'
  }

  if (otherProjects.length === 0 && project.section_id) {
    otherProjects = await prisma.project.findMany({
      where: { 
        creator_id: project.creator_id,
        section_id: project.section_id,
        id: { not: project.id },
        is_published: true,
        OR: [
          { section_id: null },
          { section: { section_type: { not: 'video_slider' } } }
        ]
      },
      orderBy: { sort_order: 'asc' }
    })
    if (otherProjects.length > 0) relatedType = 'section'
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

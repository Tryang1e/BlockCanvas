import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import ProjectDetailsViewer from '@/components/creator/ProjectDetailsViewer'
import ProjectModal from '@/components/creator/ProjectModal'
import { verifySession } from '@/lib/session'
import { logger } from '@/lib/logger'

export default async function InterceptedProjectDetailPage({ params }: { params: Promise<{ site: string, project_id: string }> }) {
  const { site, project_id } = await params
  const creator_name = site
  const normalizedName = decodeURIComponent(creator_name)
  logger.debug(`Intercepted Route Hit! site: ${site}, project_id: ${project_id}`)

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      creator: {
        select: { 
          creator_name: true, 
          display_name: true,
          avatar_url: true,
          role: true,
          portfolios: {
            select: {
              youtube_url: true,
              twitter_url: true,
              instagram_url: true,
              patreon_url: true,
              sns_settings: true
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

  if (!project) {
    logger.debug(`Project not found! project_id: ${project_id}`)
    return notFound()
  }
  if (project.creator.role === 'user') {
    return notFound()
  }
  if (project.creator.creator_name.toLowerCase() !== normalizedName.toLowerCase()) {
    logger.debug(`Creator mismatch! project.creator: ${project.creator.creator_name}, params: ${normalizedName}`)
    return notFound()
  }
  // 비공개 글/숨긴 섹션 글은 소유자만 열람 가능
  const isOwner = verifySession((await cookies()).get('session')?.value) === project.creator.creator_name.toLowerCase()
  if (!isOwner && (!project.is_published || project.section?.is_visible === false)) {
    return notFound()
  }

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

  return (
    <ProjectModal 
      title={project.title} 
      description={project.description || undefined}
      createdAt={project.created_at}
    >
      <ProjectDetailsViewer 
        project={project} 
        widgets={widgets} 
        creatorName={creator_name} 
        isModal={true} 
        otherProjects={otherProjects}
        relatedType={relatedType}
      />
    </ProjectModal>
  )
}

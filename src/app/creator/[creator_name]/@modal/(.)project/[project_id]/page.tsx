import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ProjectDetailsViewer from '@/components/creator/ProjectDetailsViewer'
import ProjectModal from '@/components/creator/ProjectModal'

export default async function InterceptedProjectDetailPage({ params }: { params: Promise<{ creator_name: string, project_id: string }> }) {
  const { creator_name, project_id } = await params
  const normalizedName = decodeURIComponent(creator_name)
  console.log(`Intercepted Route Hit! creator_name: ${creator_name}, project_id: ${project_id}`)

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      creator: {
        select: { 
          creator_name: true, 
          display_name: true,
          avatar_url: true,
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
      widgets: {
        orderBy: { sort_order: 'asc' }
      }
    }
  })

  if (!project) {
    console.log(`Project not found! project_id: ${project_id}`)
    return notFound()
  }
  if (project.creator.creator_name.toLowerCase() !== normalizedName.toLowerCase()) {
    console.log(`Creator mismatch! project.creator: ${project.creator.creator_name}, params: ${normalizedName}`)
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

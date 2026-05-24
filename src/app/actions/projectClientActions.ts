'use server'

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function fetchProjectDetails(projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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

    if (!project) return { success: false, error: 'Project not found' }

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

    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value
    const isOwner = session === project.creator.creator_name

    let otherProjects: any[] = []
    let relatedType = 'creator'

    const sectionFilter = isOwner 
      ? { section_type: { not: 'video_slider' } }
      : { section_type: { not: 'video_slider' }, is_visible: true }

    if (project.category_id) {
      otherProjects = await prisma.project.findMany({
        where: { 
          creator_id: project.creator_id,
          category_id: project.category_id,
          id: { not: project.id },
          is_published: true,
          OR: [
            { section_id: null },
            { section: sectionFilter }
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
            { section: sectionFilter }
          ]
        },
        orderBy: { sort_order: 'asc' }
      })
      if (otherProjects.length > 0) relatedType = 'section'
    }

    return { success: true, project, widgets, otherProjects, relatedType }
  } catch (error) {
    console.error('Error fetching project details:', error)
    return { success: false, error: 'Failed to fetch project details' }
  }
}

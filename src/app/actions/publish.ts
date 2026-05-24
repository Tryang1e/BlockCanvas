'use server'

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/server-auth'

export async function publishProjectAction(formData: FormData) {
  const creatorName = formData.get('creator_name') as string
  
  let normalizedName = creatorName
  try {
     normalizedName = decodeURIComponent(creatorName)
  } catch (e) {}

  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(normalizedName)
  } catch (e) {
    return redirect('/login')
  }

  // Parse Form Data
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const widgetsStr = formData.get('widgets_json') as string
  const youtubeUrl = formData.get('youtube_url') as string
  const sectionId = formData.get('section_id') as string | null
  const projectId = formData.get('project_id') as string | null
  const categoryId = formData.get('category_id') as string | null
  const customDateStr = formData.get('created_at') as string | null
  const createdAtDate = customDateStr ? new Date(customDateStr) : undefined
  
  // URL to dummy thumbnail for MVP (typically acquired via storage bucket upload)
  const thumbnailUrl = formData.get('thumbnail_url')?.toString() || "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&q=80&w=1000"
  
  const widgets = JSON.parse(widgetsStr || '[]')

  // 2. Transact Project 
  let targetProjectId = ''

  if (projectId) {
    // Check ownership first
    const existingCheck = await prisma.project.findFirst({
      where: { id: projectId, creator_id: authCreatorId }
    })
    
    if (!existingCheck) {
      throw new Error('Project not found or access denied')
    }

    // Update existing project
    const existingProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        title: title || '제목 없는 작품',
        description: description || '',
        thumbnail_url: thumbnailUrl,
        youtube_url: youtubeUrl || null,
        section_id: sectionId || null,
        category_id: categoryId || null,
        created_at: createdAtDate || undefined
      }
    })
    targetProjectId = existingProject.id

    // Log the edit
    await prisma.creatorLog.create({
      data: {
        creator_name: normalizedName,
        action: 'EDIT_PROJECT',
        target_id: targetProjectId,
        details: `Edited project: ${existingProject.title}`
      }
    })

    // Delete existing widgets to replace them cleanly
    await prisma.projectWidget.deleteMany({
      where: { project_id: targetProjectId }
    })
  } else {
    // Create new project
    const newProject = await prisma.project.create({
      data: {
        creator_id: authCreatorId,
        title: title || '제목 없는 작품',
        description: description || '',
        category_id: categoryId || null,
        is_published: true,
        thumbnail_url: thumbnailUrl,
        youtube_url: youtubeUrl || null,
        section_id: sectionId || null,
        created_at: createdAtDate || undefined
      }
    })
    targetProjectId = newProject.id
    
    // Log the creation
    await prisma.creatorLog.create({
      data: {
        creator_name: normalizedName,
        action: 'CREATE_PROJECT',
        target_id: targetProjectId,
        details: `Created project: ${newProject.title}`
      }
    })
  }

  // 3. Transact Project Widgets
  if (widgets.length > 0) {
    const widgetInserts = widgets.map((w: any, index: number) => ({
      project_id: targetProjectId,
      type: w.type === 'image_grid' ? 'image' : w.type, // Map 'image_grid' -> 'image', 'video' -> 'video', 'embed' -> 'embed'
      content: JSON.stringify(w.type === 'text' || w.type === 'embed' ? { html: w.content } : w.type === 'image_grid' ? { urls: w.content } : w.type === 'video' ? { url: w.content } : { payload: w.content }),
      sort_order: index
    }))

    await prisma.projectWidget.createMany({
      data: widgetInserts
    })
  }

  // 4. Return to Portfolio main view
  return redirect(`/creator/${creatorName}`)
}

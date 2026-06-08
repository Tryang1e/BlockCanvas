import EditorCanvas from '@/components/editor/EditorCanvas'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'

export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>
  searchParams: Promise<{ section_id?: string, project_id?: string }>
}) {
  const { site } = await params
  const { section_id, project_id } = await searchParams
  const creator_name = site.toLowerCase()

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)
  
  if (session !== site.toLowerCase()) {
    redirect(`/`)
  }

  const profile = await prisma.profile.findUnique({
    where: { creator_name }
  })

  if (!profile || profile.role === 'user') {
    notFound()
  }

  let initialProject = null
  let initialWidgets = null

  if (project_id) {
    const normalizedProjectId = project_id.trim().toLowerCase()
    
    // findUnique may fail if ID was saved with different casing or has whitespace
    // Trying findFirst as a safer alternative for ID matching in SQLite
    const project = await prisma.project.findFirst({
      where: { 
        OR: [
          { id: normalizedProjectId },
          { id: project_id.trim() }
        ]
      },
      include: {
        widgets: {
          orderBy: { sort_order: 'asc' }
        }
      }
    })

    if (project) {
      initialProject = project
      
      initialWidgets = project.widgets.map((w) => {
        let content: any = ''
        const rawContent = w.content
        
        try {
          if (!rawContent) {
            content = ''
          } else if (typeof rawContent === 'string') {
            // Try to parse if it looks like JSON, otherwise use as-is
            if (rawContent.trim().startsWith('{') || rawContent.trim().startsWith('[')) {
              const parsed = JSON.parse(rawContent)
              
              // Handle specific widget types based on parsed object structure
              if (w.type === 'image' || w.type === 'image_grid') {
                content = parsed.urls || (Array.isArray(parsed) ? parsed : [parsed])
              } else if (w.type === 'video') {
                content = parsed.url || parsed
              } else if (w.type === 'text' || w.type === 'embed') {
                content = parsed.html || parsed
              } else {
                content = parsed.payload || parsed || rawContent
              }
            } else {
              // Not JSON, use raw string (Legacy support)
              content = rawContent
            }
          } else {
            // Already an object or other type
            content = rawContent
          }
        } catch (e) {
          console.error(`[Editor] Parsing failed for widget ${w.id}:`, e)
          content = rawContent || ''
        }
        
        // Final normalization to ensure content is in the format EditorCanvas expects
        if ((w.type === 'image' || w.type === 'image_grid') && !Array.isArray(content)) {
          content = content ? [content] : []
        }
        
        return {
          id: w.id,
          type: w.type === 'image' ? 'image_grid' : w.type as any,
          content
        }
      })
      console.log(`[Editor] Mapped ${initialWidgets.length} Widgets successfully.`)
    }
 else {
      console.log(`[Editor] Project NOT FOUND: ID=${project_id}`)
    }
  }

  const categories = await prisma.category.findMany({
    orderBy: { sort_order: 'asc' }
  })

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans overflow-hidden">
      {/* Editor Client Component includes global Header overlay to maintain single truth state */}
      <EditorCanvas 
        creatorName={creator_name} 
        sectionId={section_id} 
        initialProject={initialProject}
        initialWidgets={initialWidgets}
        categories={categories}
      />
    </div>
  )
}

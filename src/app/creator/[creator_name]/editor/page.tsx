import EditorCanvas from '@/components/editor/EditorCanvas'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ creator_name: string }>
  searchParams: Promise<{ section_id?: string, project_id?: string }>
}) {
  const { creator_name } = await params
  const { section_id, project_id } = await searchParams

  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  
  if (session !== creator_name) {
    redirect(`/creator/${creator_name}`)
  }

  let initialProject = null
  let initialWidgets = null

  if (project_id) {
    const project = await prisma.project.findUnique({
      where: { id: project_id },
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
        try {
          const parsed = JSON.parse(w.content || '{}')
          if (w.type === 'image') content = parsed.urls || []
          else if (w.type === 'video') content = parsed.url || ''
          else if (w.type === 'text' || w.type === 'embed') content = parsed.html || ''
          else content = parsed.payload || ''
        } catch (e) {}
        
        return {
          id: w.id,
          type: w.type === 'image' ? 'image_grid' : w.type,
          content
        }
      })
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

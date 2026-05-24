import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ProjectManagementList from '@/components/dashboard/ProjectManagementList'

export default async function DashboardProjectsPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params

  const profile = await prisma.profile.findUnique({
    where: { creator_name }
  })

  if (!profile) return null

  const sections = await prisma.portfolioSection.findMany({
    where: { creator_id: profile.id },
    orderBy: { sort_order: 'asc' }
  })

  const projects = await prisma.project.findMany({
    where: { creator_id: profile.id },
    include: {
      section: true
    },
    orderBy: [
      { sort_order: 'asc' },
      { created_at: 'desc' }
    ]
  })

  const projectsBySection = sections.map(section => ({
    section,
    projects: projects.filter(p => p.section_id === section.id)
  }))

  const unassignedProjects = projects.filter(p => !p.section_id || !sections.find(s => s.id === p.section_id))
  if (unassignedProjects.length > 0) {
    projectsBySection.push({
      section: { id: 'unassigned', name: '미배정 (Unassigned)', is_visible: true } as any,
      projects: unassignedProjects
    })
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">게시물 관리</h1>
          <p className="text-neutral-500 font-medium">내 포트폴리오에 업로드된 모든 작품과 게시물을 한눈에 관리하세요.</p>
        </div>
        <Link 
          href={`/creator/${creator_name}`}
          className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow hover:bg-neutral-800 transition-colors"
        >
          + 새 게시물 작성하러 가기
        </Link>
      </div>

      <ProjectManagementList 
        initialProjects={projects} 
        sections={sections} 
        creatorName={creator_name} 
      />
    </div>
  )
}

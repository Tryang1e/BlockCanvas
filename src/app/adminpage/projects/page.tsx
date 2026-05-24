import { prisma } from '@/lib/prisma'
import AdminProjectTable from './AdminProjectTable'

export const dynamic = 'force-dynamic'

export default async function AdminProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = typeof params.search === 'string' ? params.search : ''
  const status = typeof params.status === 'string' ? params.status : 'all'

  const limit = 20
  const skip = (page - 1) * limit

  // Build where clause
  const where: any = {}
  
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { creator: { creator_name: { contains: search } } }
    ]
  }

  if (status === 'published') {
    where.is_published = true
  } else if (status === 'hidden') {
    where.is_published = false
  }

  const [totalCount, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip,
      include: {
        creator: true
      }
    })
  ])

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 tracking-tight">전체 게시물 관리</h2>
      
      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden shadow-sm">
        <AdminProjectTable 
          projects={projects} 
          currentPage={page} 
          totalPages={totalPages} 
          totalCount={totalCount}
          currentSearch={search}
          currentStatus={status}
        />
      </div>
    </div>
  )
}

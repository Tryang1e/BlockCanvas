import { prisma } from '@/lib/prisma'
import AdminCategoryForm from './AdminCategoryForm'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { created_at: 'asc' }
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 tracking-tight">공식 카테고리 마스터</h2>
      <p className="text-neutral-500 text-sm mb-6">
        크리에이터들이 포트폴리오를 업로드할 때 선택할 수 있는 공식 카테고리를 관리합니다.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-md border border-neutral-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left align-middle border-collapse">
              <thead className="bg-neutral-50/80 text-neutral-500 border-b border-neutral-200 text-[11px] tracking-wider uppercase">
                <tr>
                  <th className="px-6 py-4 font-bold">카테고리 이름</th>
                  <th className="px-6 py-4 font-bold">슬러그 (Slug)</th>
                  <th className="px-6 py-4 font-bold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-neutral-400 font-medium">생성된 카테고리가 없습니다.</td>
                  </tr>
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-neutral-800">{cat.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-neutral-500">{cat.slug}</td>
                      <td className="px-6 py-4 text-right">
                        <AdminCategoryForm categoryId={cat.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-md border border-neutral-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">새 카테고리 추가</h3>
            <AdminCategoryForm isCreate />
          </div>
        </div>
      </div>
    </div>
  )
}

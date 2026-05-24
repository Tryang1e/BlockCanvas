'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategoryAction, deleteCategoryAction } from '@/app/actions/admin'

export default function AdminCategoryForm({ 
  isCreate = false,
  categoryId
}: { 
  isCreate?: boolean,
  categoryId?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // For Create
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      alert('이름과 슬러그를 모두 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      const res = await createCategoryAction(name, slug)
      if (res?.error) {
        alert(res.error)
      } else {
        setName('')
        setSlug('')
        router.refresh()
      }
    } catch (err: any) {
      alert('생성 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!categoryId) return
    if (!confirm('정말로 이 카테고리를 삭제하시겠습니까? 관련 데이터가 영향을 받을 수 있습니다.')) return

    try {
      setLoading(true)
      const res = await deleteCategoryAction(categoryId)
      if (res?.error) alert(res.error)
      else router.refresh()
    } catch (err: any) {
      alert('삭제 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (isCreate) {
    return (
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">표시 이름 (Name)</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 3D Animation"
            className="w-full text-sm border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">고유 주소 (Slug)</label>
          <input 
            type="text" 
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="예: 3d-animation"
            className="w-full text-sm font-mono border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-neutral-400 mt-1">URL에 사용될 영문/숫자/하이픈(-) 조합</p>
        </div>
        <button 
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-neutral-900 hover:bg-black text-white font-bold text-sm rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? '추가 중...' : '+ 추가하기'}
        </button>
      </form>
    )
  }

  // Delete Button Mode
  return (
    <button 
      onClick={handleDelete}
      disabled={loading}
      className="text-red-500 hover:text-red-700 hover:underline font-bold text-[11px] uppercase disabled:opacity-50"
    >
      삭제
    </button>
  )
}

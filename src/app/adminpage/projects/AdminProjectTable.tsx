'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProjectAdminAction, toggleProjectPublishAdminAction } from '@/app/actions/admin'
import Image from 'next/image'

export default function AdminProjectTable({ 
  projects,
  currentPage,
  totalPages,
  totalCount,
  currentSearch,
  currentStatus
}: { 
  projects: any[],
  currentPage: number,
  totalPages: number,
  totalCount: number,
  currentSearch: string,
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  
  // Local state for search to avoid excessive routing on every keystroke
  const [searchValue, setSearchValue] = useState(currentSearch)

  useEffect(() => {
    setSearchValue(currentSearch)
  }, [currentSearch])

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'publish' | 'delete' | null;
    targetId: string | null;
    targetTitle: string | null;
    targetPublished: boolean | null;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
    targetTitle: null,
    targetPublished: null
  })

  // -------------------------
  // Search & Filter Actions
  // -------------------------
  const applyFilters = (newSearch: string, newStatus: string, newPage: number = 1) => {
    const params = new URLSearchParams()
    if (newSearch) params.set('search', newSearch)
    if (newStatus && newStatus !== 'all') params.set('status', newStatus)
    if (newPage > 1) params.set('page', newPage.toString())
    
    router.push(`/adminpage/projects?${params.toString()}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters(searchValue, currentStatus, 1)
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    applyFilters(searchValue, e.target.value, 1)
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      applyFilters(searchValue, currentStatus, page)
    }
  }

  // -------------------------
  // Modal Actions
  // -------------------------
  const openPublishModal = (id: string, title: string, isPublished: boolean) => {
    setModalConfig({ isOpen: true, type: 'publish', targetId: id, targetTitle: title, targetPublished: isPublished })
  }

  const openDeleteModal = (id: string, title: string) => {
    setModalConfig({ isOpen: true, type: 'delete', targetId: id, targetTitle: title, targetPublished: null })
  }

  const closeModal = () => {
    setModalConfig({ isOpen: false, type: null, targetId: null, targetTitle: null, targetPublished: null })
  }

  const confirmAction = async () => {
    if (!modalConfig.targetId) return
    const id = modalConfig.targetId

    try {
      setLoading(id)
      if (modalConfig.type === 'delete') {
        const res = await deleteProjectAdminAction(id)
        if (res?.error) alert(`오류: ${res.error}`)
      } else if (modalConfig.type === 'publish') {
        const res = await toggleProjectPublishAdminAction(id, !modalConfig.targetPublished)
        if (res?.error) alert(`오류: ${res.error}`)
      }
    } catch (err: any) {
      alert(`오류: ${err.message || '서버 통신 실패'}`)
    } finally {
      setLoading(null)
      closeModal()
      router.refresh()
    }
  }

  return (
    <>
      {/* Search and Filter Top Bar */}
      <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50/80">
        <h3 className="text-sm font-bold text-neutral-800">전체 데이터: {totalCount}건</h3>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={currentStatus}
            onChange={handleStatusChange}
            className="text-sm border border-neutral-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 상태</option>
            <option value="published">공개 (Published)</option>
            <option value="hidden">비공개 (Hidden)</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="flex flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder="제목 또는 닉네임 검색..." 
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full text-sm border border-neutral-300 border-r-0 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit"
              className="bg-neutral-800 hover:bg-neutral-900 text-white px-4 py-2 text-sm font-bold rounded-r-md transition-colors"
            >
              검색
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm text-left align-middle border-collapse">
          <thead className="bg-neutral-50/80 text-neutral-500 border-b border-neutral-200 text-[11px] tracking-wider uppercase">
            <tr>
              <th className="px-6 py-4 font-bold">작품 정보</th>
              <th className="px-6 py-4 font-bold">크리에이터</th>
              <th className="px-6 py-4 font-bold">상태</th>
              <th className="px-6 py-4 font-bold">조회수</th>
              <th className="px-6 py-4 font-bold text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {projects && projects.map((project: any) => (
              <tr key={project.id} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-16 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-neutral-200/60 group-hover:shadow-md transition-shadow">
                        {project.thumbnail_url ? (
                          <Image 
                            src={project.thumbnail_url} 
                            alt="Thumbnail" 
                            fill 
                            className="object-cover" 
                            sizes="96px"
                          />
                        ) : (
                          <span className="text-[10px] text-neutral-400 font-bold uppercase w-full text-center">No Img</span>
                        )}
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="font-black text-neutral-900 text-sm line-clamp-1 mb-1">{project.title}</div>
                        <div className="text-[11px] text-neutral-400 font-medium tracking-wide">
                          {(() => {
                            const d = new Date(project.created_at)
                            const yyyy = d.getFullYear()
                            const mm = String(d.getMonth() + 1).padStart(2, '0')
                            const dd = String(d.getDate()).padStart(2, '0')
                            const hh = String(d.getHours()).padStart(2, '0')
                            const min = String(d.getMinutes()).padStart(2, '0')
                            return `${yyyy}-${mm}-${dd} ${hh}:${min}`
                          })()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {project.creator?.creator_name ? (
                      <button 
                        onClick={() => applyFilters(project.creator.creator_name, 'all', 1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 hover:bg-blue-50 rounded-md text-xs font-bold text-neutral-700 hover:text-blue-700 transition-colors text-left border border-neutral-100 hover:border-blue-200"
                      >
                        <span className="text-neutral-400 font-normal">@</span>{project.creator.creator_name}
                      </button>
                    ) : (
                      <div className="inline-flex items-center px-3 py-1.5 bg-neutral-50 rounded-md text-xs font-bold text-neutral-400 border border-neutral-100">
                        알수없음
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${project.is_published ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-neutral-50 text-neutral-500 ring-1 ring-neutral-500/20'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${project.is_published ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                      {project.is_published ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td className="px-6 py-5 tabular-nums text-sm font-black text-neutral-700">
                    {project.view_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-5 text-right space-x-2">
                    <button 
                      onClick={() => openPublishModal(project.id, project.title, project.is_published)}
                      disabled={loading === project.id}
                      className="px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors disabled:opacity-50"
                    >
                      상태변경
                    </button>
                    <button 
                      onClick={() => openDeleteModal(project.id, project.title)}
                      disabled={loading === project.id}
                      className="px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] transition-colors disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {(!projects || projects.length === 0) && (
          <div className="p-10 text-center text-neutral-400 font-medium flex flex-col items-center gap-2">
            <div>데이터가 없습니다.</div>
            {(currentSearch || currentStatus !== 'all') && (
              <button 
                onClick={() => applyFilters('', 'all', 1)}
                className="text-xs text-blue-500 hover:underline font-bold"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Bottom Bar */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-neutral-100 flex items-center justify-between bg-white text-sm">
          <span className="text-neutral-500 font-medium hidden sm:inline-block">
            페이지 {currentPage} / {totalPages}
          </span>
          <div className="flex items-center gap-1 mx-auto sm:mx-0">
            <button 
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 font-bold transition-colors"
            >
              이전
            </button>
            
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              // Simple pagination logic: show first, last, and +-2 around current
              if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
                return (
                  <button 
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md font-bold transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100 text-neutral-600'}`}
                  >
                    {p}
                  </button>
                )
              } else if (p === currentPage - 3 || p === currentPage + 3) {
                return <span key={p} className="text-neutral-400 px-1">...</span>
              }
              return null;
            })}

            <button 
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 font-bold transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 border-b ${modalConfig.type === 'delete' ? 'border-red-100 bg-red-50' : 'border-blue-100 bg-blue-50'}`}>
              <h3 className={`text-lg font-black tracking-tight ${modalConfig.type === 'delete' ? 'text-red-600' : 'text-blue-600'}`}>
                {modalConfig.type === 'delete' ? '작품 영구 삭제' : '공개 상태 변경'}
              </h3>
            </div>
            <div className="p-6 text-neutral-700 font-medium text-sm leading-relaxed">
              {modalConfig.type === 'delete' ? (
                <>정말로 <span className="font-bold text-black">{modalConfig.targetTitle}</span> 작품을 삭제하시겠습니까?<br/><span className="text-red-500 mt-2 block text-xs font-bold">크리에이터의 동의 없이 강제로 삭제되며, 복구할 수 없습니다.</span></>
              ) : (
                <><span className="font-bold text-black">{modalConfig.targetTitle}</span> 작품을 <br/><span className={`font-black px-2 py-0.5 rounded uppercase mt-1 inline-block ${!modalConfig.targetPublished ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>{!modalConfig.targetPublished ? '공개 (Published)' : '비공개 (Hidden)'}</span> (으)로 변경하시겠습니까?<br/><br/><span className="text-xs text-neutral-500">부적절한 게시물인 경우 강제로 비공개 처리할 수 있습니다.</span></>
              )}
            </div>
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
              <button 
                onClick={closeModal}
                disabled={loading !== null}
                className="px-4 py-2 text-sm font-bold text-neutral-500 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button 
                onClick={confirmAction}
                disabled={loading !== null}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${modalConfig.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading === modalConfig.targetId ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block"></span> 처리중...
                  </>
                ) : (
                  modalConfig.type === 'delete' ? '삭제하기' : '변경하기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

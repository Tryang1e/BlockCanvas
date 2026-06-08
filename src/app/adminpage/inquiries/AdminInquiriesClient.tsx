'use client'

import React, { useState } from 'react'
import { markMessageAsRead, deleteContactMessage, replyToContactMessage, deleteContactMessageReply } from '@/app/actions/contact'
import { Check, Trash2, Search, Eye, Loader2 } from 'lucide-react'

interface Inquiry {
  id: string
  name: string
  email: string
  message: string
  is_read: boolean
  reply: string | null
  replied_at: string | null
  created_at: string
  typeLabel: string
  typeCode: 'support' | 'feedback'
}

export default function AdminInquiriesClient({ initialInquiries }: { initialInquiries: Inquiry[] }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries)
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'support' | 'feedback'>('all')
  const [selectedReadFilter, setSelectedReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Replying states
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // 1. Handlers
  const handleMarkAsRead = async (id: string) => {
    setActionLoading(id + '-read')
    try {
      const res = await markMessageAsRead(id)
      if (res.success) {
        setInquiries(prev => 
          prev.map(item => item.id === id ? { ...item, is_read: true } : item)
        )
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry(prev => prev ? { ...prev, is_read: true } : null)
        }
      } else {
        alert('읽음 처리 중 실패했습니다.')
      }
    } catch (err: any) {
      alert('오류: ' + (err?.message || '처리 중 에러가 발생했습니다.'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 문의 내역을 영구히 삭제하시겠습니까?')) return
    setActionLoading(id + '-delete')
    try {
      const res = await deleteContactMessage(id)
      if (res.success) {
        setInquiries(prev => prev.filter(item => item.id !== id))
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry(null)
        }
      } else {
        alert(res.error || '삭제 중 실패했습니다.')
      }
    } catch (err: any) {
      alert('오류: ' + (err?.message || '처리 중 에러가 발생했습니다.'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInquiry || !replyText.trim()) return
    setSubmittingReply(true)
    try {
      const res = await replyToContactMessage(selectedInquiry.id, replyText)
      if (res.success) {
        const nowIso = new Date().toISOString()
        setInquiries(prev => 
          prev.map(item => item.id === selectedInquiry.id 
            ? { ...item, reply: replyText, replied_at: nowIso, is_read: true } 
            : item
          )
        )
        setSelectedInquiry(prev => prev ? { ...prev, reply: replyText, replied_at: nowIso, is_read: true } : null)

        // Open mailto link pre-populated
        const subject = encodeURIComponent(`[BlockCanvas 고객지원] 문의주신 내용에 대한 답변입니다.`)
        const body = encodeURIComponent(
          `안녕하세요, ${selectedInquiry.name}님.\n` +
          `BlockCanvas 고객지원 센터입니다.\n\n` +
          `문의하신 내용:\n` +
          `"${selectedInquiry.message}"\n\n` +
          `----------------------------------------\n\n` +
          `답변 내용:\n` +
          `${replyText}\n\n` +
          `감사합니다.\n` +
          `BlockCanvas 운영팀 드림`
        )
        window.open(`mailto:${selectedInquiry.email}?subject=${subject}&body=${body}`, '_blank')

        setReplyText('')
        setIsReplying(false)
      } else {
        alert(res.error || '답변 등록 중 실패했습니다.')
      }
    } catch (err: any) {
      alert('오류: ' + (err?.message || '처리 중 에러가 발생했습니다.'))
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleDeleteReply = async (id: string) => {
    if (!confirm('이 답변 등록 사항을 삭제하시겠습니까? 답변 삭제 시 사용자에게 답변 대기 상태로 재노출됩니다.')) return
    setActionLoading(id + '-deletereply')
    try {
      const res = await deleteContactMessageReply(id)
      if (res.success) {
        setInquiries(prev => 
          prev.map(item => item.id === id ? { ...item, reply: null, replied_at: null } : item)
        )
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry(prev => prev ? { ...prev, reply: null, replied_at: null } : null)
        }
      } else {
        alert(res.error || '답변 삭제 중 에러가 발생했습니다.')
      }
    } catch (err: any) {
      alert('오류: ' + (err?.message || '처리 중 에러가 발생했습니다.'))
    } finally {
      setActionLoading(null)
    }
  }

  // 2. Filter & Search logic
  const filteredInquiries = inquiries.filter(inquiry => {
    // Type Filter
    if (selectedTypeFilter !== 'all' && inquiry.typeCode !== selectedTypeFilter) return false
    // Read Filter
    if (selectedReadFilter === 'unread' && inquiry.is_read) return false
    if (selectedReadFilter === 'read' && !inquiry.is_read) return false
    // Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchName = inquiry.name.toLowerCase().includes(query)
      const matchEmail = inquiry.email.toLowerCase().includes(query)
      const matchMessage = inquiry.message.toLowerCase().includes(query)
      if (!matchName && !matchEmail && !matchMessage) return false
    }
    return true
  })

  // 3. Stats
  const totalCount = inquiries.length
  const unreadCount = inquiries.filter(i => !i.is_read).length
  const supportCount = inquiries.filter(i => i.typeCode === 'support').length
  const feedbackCount = inquiries.filter(i => i.typeCode === 'feedback').length

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">총 수신 메시지</h3>
          <p className="text-2xl font-black text-neutral-800">{totalCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">미확인(읽지않음)</h3>
          <p className="text-2xl font-black text-blue-600">{unreadCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">1:1 문의 건수</h3>
          <p className="text-2xl font-black text-neutral-800">{supportCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">의견 제안 건수</h3>
          <p className="text-2xl font-black text-violet-600">{feedbackCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Control panel (Filter & Search) */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter Tabs */}
          <div className="flex bg-neutral-100 p-1 rounded-md border border-neutral-200">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedTypeFilter === 'all' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedTypeFilter('support')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedTypeFilter === 'support' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              1:1 문의
            </button>
            <button
              onClick={() => setSelectedTypeFilter('feedback')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedTypeFilter === 'feedback' ? 'bg-violet-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              서비스 의견
            </button>
          </div>

          {/* Read Status Filter */}
          <div className="flex bg-neutral-100 p-1 rounded-md border border-neutral-200">
            <button
              onClick={() => setSelectedReadFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedReadFilter === 'all' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              상태 전체
            </button>
            <button
              onClick={() => setSelectedReadFilter('unread')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedReadFilter === 'unread' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              안읽음
            </button>
            <button
              onClick={() => setSelectedReadFilter('read')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedReadFilter === 'read' ? 'bg-neutral-200 text-neutral-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              읽음
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일, 내용 검색..."
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-md bg-white text-sm text-neutral-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder-neutral-400"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left align-middle border-collapse">
            <thead className="bg-neutral-50/80 text-neutral-500 border-b border-neutral-200 text-[11px] tracking-wider uppercase font-bold">
              <tr>
                <th className="px-6 py-4 w-12 text-center">상태</th>
                <th className="px-6 py-4 w-32">유형</th>
                <th className="px-6 py-4 w-40">이름</th>
                <th className="px-6 py-4">답변 이메일</th>
                <th className="px-6 py-4 w-1/3">문의 내용</th>
                <th className="px-6 py-4 w-44">접수 일시</th>
                <th className="px-6 py-4 text-right w-32">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-neutral-400 font-medium bg-white">
                    조건에 해당하는 문의가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredInquiries.map(inquiry => (
                  <tr 
                    key={inquiry.id} 
                    className={`hover:bg-neutral-50/40 transition-colors ${!inquiry.is_read ? 'bg-blue-50/10 font-medium' : ''}`}
                  >
                    <td className="px-6 py-4 text-center">
                      {!inquiry.is_read ? (
                        <span className="inline-block w-2.5 h-2.5 bg-blue-600 rounded-full" title="미확인" />
                      ) : (
                        <span className="inline-block w-2.5 h-2.5 bg-neutral-200 rounded-full" title="읽음" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {inquiry.typeCode === 'support' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 whitespace-nowrap">
                            {inquiry.typeLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-violet-50 text-violet-700 ring-1 ring-violet-600/20 whitespace-nowrap">
                            {inquiry.typeLabel}
                          </span>
                        )}
                        {inquiry.reply && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-extrabold ring-1 ring-emerald-600/10 whitespace-nowrap">
                            답변완료
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-neutral-800 max-w-[120px] truncate" title={inquiry.name}>
                      {inquiry.name}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-xs">
                      {inquiry.email}
                    </td>
                    <td className="px-6 py-4 text-neutral-600 max-w-[250px] truncate" title={inquiry.message}>
                      {inquiry.message}
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-400 font-medium">
                      {new Date(inquiry.created_at).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedInquiry(inquiry)
                            setReplyText('')
                            setIsReplying(false)
                          }}
                          className="p-1.5 hover:bg-neutral-100 text-neutral-600 hover:text-neutral-800 rounded-md transition-colors"
                          title="상세 내용 보기"
                        >
                          <Eye size={15} />
                        </button>
                        {!inquiry.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(inquiry.id)}
                            disabled={actionLoading === inquiry.id + '-read'}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-md transition-colors disabled:opacity-40"
                            title="읽음 처리"
                          >
                            <Check size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inquiry.id)}
                          disabled={actionLoading === inquiry.id + '-delete'}
                          className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-md transition-colors disabled:opacity-40"
                          title="영구 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details View Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl text-neutral-800 w-full max-w-lg p-6 flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                {selectedInquiry.typeCode === 'support' ? (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20">
                    {selectedInquiry.typeLabel}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-violet-50 text-violet-700 ring-1 ring-violet-600/20">
                    {selectedInquiry.typeLabel}
                  </span>
                )}
                <h3 className="font-bold text-lg text-neutral-900">문의 상세 내역</h3>
              </div>
              <button 
                onClick={() => setSelectedInquiry(null)}
                className="text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 p-1.5 rounded-md transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex flex-col gap-4 text-sm mb-4 max-h-[60vh] overflow-y-auto pr-1 text-left">
              <div className="grid grid-cols-3 border-b border-neutral-100 pb-2.5">
                <span className="text-neutral-400 font-bold">작성자 (이름)</span>
                <span className="col-span-2 text-neutral-800 font-bold">{selectedInquiry.name}</span>
              </div>
              <div className="grid grid-cols-3 border-b border-neutral-100 pb-2.5">
                <span className="text-neutral-400 font-bold">회신 이메일</span>
                <span className="col-span-2 text-neutral-800 font-mono font-bold select-all text-xs">{selectedInquiry.email}</span>
              </div>
              <div className="grid grid-cols-3 border-b border-neutral-100 pb-2.5">
                <span className="text-neutral-400 font-bold">접수 시간</span>
                <span className="col-span-2 text-neutral-500 font-medium">
                  {new Date(selectedInquiry.created_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-2 bg-neutral-50 p-4 rounded-md border border-neutral-100">
                <span className="text-neutral-400 font-bold text-xs">문의 및 의견 본문</span>
                <div className="text-neutral-700 font-medium whitespace-pre-wrap leading-relaxed">
                  {selectedInquiry.message}
                </div>
              </div>

              {/* Reply Section */}
              {selectedInquiry.reply ? (
                <div className="flex flex-col gap-2 bg-emerald-50/50 p-4 rounded-md border border-emerald-100">
                  <div className="flex items-center justify-between text-emerald-700 font-bold text-xs">
                    <span>관리자 답변 등록됨</span>
                    <span>
                      {selectedInquiry.replied_at && new Date(selectedInquiry.replied_at).toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="text-neutral-700 font-medium whitespace-pre-wrap leading-relaxed">
                    {selectedInquiry.reply}
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteReply(selectedInquiry.id)}
                      disabled={actionLoading === selectedInquiry.id + '-deletereply'}
                      className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50/50 hover:bg-red-50 border border-red-200/50 px-2.5 py-1.5 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                      답변 삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const subject = encodeURIComponent(`[BlockCanvas 고객지원] 문의주신 내용에 대한 답변입니다.`)
                        const body = encodeURIComponent(
                          `안녕하세요, ${selectedInquiry.name}님.\n` +
                          `BlockCanvas 고객지원 센터입니다.\n\n` +
                          `문의하신 내용:\n` +
                          `"${selectedInquiry.message}"\n\n` +
                          `----------------------------------------\n\n` +
                          `답변 내용:\n` +
                          `${selectedInquiry.reply}\n\n` +
                          `감사합니다.\n` +
                          `BlockCanvas 운영팀 드림`
                        )
                        window.open(`mailto:${selectedInquiry.email}?subject=${subject}&body=${body}`, '_blank')
                      }}
                      className="text-xs text-blue-600 hover:text-blue-500 font-bold underline"
                    >
                      이메일 다시 작성하기
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!isReplying ? (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setIsReplying(true)}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-md transition-colors border border-blue-200"
                      >
                        답장 작성하기
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendReply} className="flex flex-col gap-2 border-t border-neutral-100 pt-3 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-neutral-400 font-bold text-xs">답변 내용 작성</span>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="이곳에 유저에게 전송할 답변 내용을 구체적으로 적어주세요. 전송 완료 시 이메일 클라이언트가 열립니다."
                        rows={4}
                        required
                        disabled={submittingReply}
                        className="w-full border border-neutral-200 rounded-md p-2.5 text-sm text-neutral-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium placeholder-neutral-400 resize-none"
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setIsReplying(false)}
                          disabled={submittingReply}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold text-xs rounded-md transition-colors"
                        >
                          취소
                        </button>
                        <button
                          type="submit"
                          disabled={submittingReply}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 text-white font-bold text-xs rounded-md transition-colors flex items-center gap-1.5"
                        >
                          {submittingReply ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>전송 중...</span>
                            </>
                          ) : (
                            <span>답장 등록 & 메일 열기</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              {!selectedInquiry.is_read && (
                <button
                  onClick={() => handleMarkAsRead(selectedInquiry.id)}
                  disabled={actionLoading === selectedInquiry.id + '-read'}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 text-white font-bold text-xs rounded-md transition-colors flex items-center gap-1"
                >
                  <Check size={14} />
                  <span>읽음 처리</span>
                </button>
              )}
              <button
                onClick={() => handleDelete(selectedInquiry.id)}
                disabled={actionLoading === selectedInquiry.id + '-delete'}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/40 text-white font-bold text-xs rounded-md transition-colors flex items-center gap-1"
              >
                <Trash2 size={14} />
                <span>삭제</span>
              </button>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold text-xs rounded-md transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

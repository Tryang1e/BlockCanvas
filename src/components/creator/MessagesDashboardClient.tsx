'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NotificationList, NotificationMessage } from '@/components/ui/notification-list'
import { markMessageAsRead, markReplyAsRead, deleteContactMessage } from '@/app/actions/contact'
import { CheckCircle, Mail, Clock, MessageSquare, HelpCircle, ChevronDown, ChevronUp, AlertCircle, Trash2 } from 'lucide-react'

interface SupportInquiry {
  id: string
  name: string
  email: string
  message: string
  typeLabel: string
  is_read: boolean
  reply: string | null
  replied_at: string | null
  reply_read: boolean
  created_at: string
  time: string
}

interface Props {
  initialMessages: NotificationMessage[];
  initialSupportInquiries: SupportInquiry[];
  creatorName: string;
  userRole?: string;
}

export default function MessagesDashboardClient({ 
  initialMessages, 
  initialSupportInquiries,
  creatorName, 
  userRole = 'creator' 
}: Props) {
  const isNormalUser = userRole === 'user'
  const [activeTab, setActiveTab] = useState<'received' | 'support'>(isNormalUser ? 'support' : 'received')
  const [messages, setMessages] = useState(initialMessages)
  const [supportInquiries, setSupportInquiries] = useState<SupportInquiry[]>(initialSupportInquiries)
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null)
  const router = useRouter()

  const handleMarkAsRead = async (id: string) => {
    const res = await markMessageAsRead(id)
    if (res.success) {
      setMessages(messages.map(m => m.id === id ? { ...m, is_read: true } : m))
      router.refresh()
    }
  }

  const handleToggleInquiry = async (id: string) => {
    if (expandedInquiryId === id) {
      setExpandedInquiryId(null)
    } else {
      setExpandedInquiryId(id)
      
      // Mark reply as read if expanding a new replied inquiry
      const target = supportInquiries.find(inq => inq.id === id)
      if (target && target.reply !== null && !target.reply_read) {
        const res = await markReplyAsRead(id)
        if (res.success) {
          setSupportInquiries(prev => 
            prev.map(inq => inq.id === id ? { ...inq, reply_read: true } : inq)
          )
          router.refresh()
        }
      }
    }
  }

  const handleDeleteMessage = async (id: string, isSupport: boolean) => {
    if (!confirm('이 메시지 내역을 영구히 삭제하시겠습니까?')) return
    const res = await deleteContactMessage(id)
    if (res.success) {
      if (isSupport) {
        setSupportInquiries(prev => prev.filter(inq => inq.id !== id))
        if (expandedInquiryId === id) setExpandedInquiryId(null)
      } else {
        setMessages(prev => prev.filter(m => m.id !== id))
      }
      router.refresh()
    } else {
      alert(res.error || '삭제 중 실패했습니다.')
    }
  }

  // Stats for Support Inquiries
  const pendingReplyCount = supportInquiries.filter(i => i.reply === null).length
  const unreadRepliesCount = supportInquiries.filter(i => i.reply !== null && !i.reply_read).length

  return (
    <div className="flex flex-col gap-6">
      {/* Tab Selector */}
      {!isNormalUser && (
        <div className="flex border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'received'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Mail className="size-4" />
            <span>받은 메시지함</span>
            {messages.filter(m => !m.is_read).length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {messages.filter(m => !m.is_read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'support'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <HelpCircle className="size-4" />
            <span>내 문의 및 피드백 내역</span>
            {unreadRepliesCount > 0 && (
              <span className="bg-red-100 text-red-600 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                {unreadRepliesCount}
              </span>
            )}
          </button>
        </div>
      )}

      {activeTab === 'received' ? (
        <div className="flex flex-col gap-8">
          {/* Overview Section */}
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Animated Stack */}
            <div className="flex-shrink-0 relative group">
              <NotificationList 
                notifications={messages} 
                onViewAll={() => {
                  setTimeout(() => {
                    document.getElementById('all-messages-list')?.scrollIntoView({ behavior: 'smooth' })
                  }, 100)
                }} 
              />
            </div>

            {/* Quick Stats */}
            <div className="flex-grow flex gap-4 w-full">
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex-1 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 mb-1">안 읽은 메시지</p>
                  <h3 className="text-3xl font-black text-blue-600">{messages.filter(m => !m.is_read).length}</h3>
                </div>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                  <Mail className="size-6" />
                </div>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex-1 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 mb-1">전체 메시지</p>
                  <h3 className="text-3xl font-black text-neutral-800">{messages.length}</h3>
                </div>
                <div className="w-12 h-12 bg-neutral-200 text-neutral-600 rounded-full flex items-center justify-center">
                  <Clock className="size-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Detail List Section */}
          <div id="all-messages-list" className="bg-white border border-neutral-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-neutral-900">받은 메시지 목록</h2>
            </div>
            
            <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 font-medium bg-white">
                  아직 받은 메시지가 없습니다.
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`p-6 transition-colors ${msg.is_read ? 'bg-white' : 'bg-blue-50/50'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-neutral-900 text-lg">{msg.title}</h4>
                          {!msg.is_read && (
                            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">New</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">{msg.subtitle}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs font-medium text-neutral-400">{msg.time}</span>
                        <div className="flex items-center gap-2">
                          {!msg.is_read && (
                            <button 
                              onClick={() => handleMarkAsRead(msg.id)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                              <CheckCircle className="size-3" />
                              읽음 처리
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteMessage(msg.id, false)}
                            className="text-xs font-bold text-red-600 hover:text-red-850 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="size-3" />
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                      {(msg as any).content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Support Quick Stats */}
          <div className="flex gap-4 w-full">
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex-1 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">신규 답변 완료</p>
                <h3 className="text-3xl font-black text-red-600">{unreadRepliesCount}</h3>
              </div>
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <AlertCircle className="size-6" />
              </div>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex-1 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">답변 대기 중</p>
                <h3 className="text-3xl font-black text-amber-600">{pendingReplyCount}</h3>
              </div>
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                <Clock className="size-6" />
              </div>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex-1 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">전체 문의</p>
                <h3 className="text-3xl font-black text-neutral-800">{supportInquiries.length}</h3>
              </div>
              <div className="w-12 h-12 bg-neutral-200 text-neutral-600 rounded-full flex items-center justify-center">
                <MessageSquare className="size-6" />
              </div>
            </div>
          </div>

          {/* Inquiries Accordion List */}
          <div className="bg-white border border-neutral-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900">내 1:1 문의 및 제안 목록</h2>
            </div>
            
            <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
              {supportInquiries.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 font-medium bg-white">
                  제출된 문의 내역이 없습니다.
                </div>
              ) : (
                supportInquiries.map(inq => {
                  const isExpanded = expandedInquiryId === inq.id
                  const hasNewReply = inq.reply !== null && !inq.reply_read

                  return (
                    <div 
                      key={inq.id} 
                      className={`transition-colors duration-150 border-l-4 ${
                        hasNewReply 
                          ? 'border-red-500 bg-red-50/10' 
                          : inq.reply !== null 
                            ? 'border-emerald-500 bg-white' 
                            : 'border-amber-400 bg-amber-50/5'
                      }`}
                    >
                      {/* Header Clickable Row */}
                      <button
                        onClick={() => handleToggleInquiry(inq.id)}
                        className="w-full p-6 text-left flex justify-between items-center hover:bg-neutral-50/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {/* Type Badge */}
                            <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide ${
                              inq.typeLabel === '1:1 문의' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {inq.typeLabel}
                            </span>

                            {/* Status Badge */}
                            {inq.reply === null ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                답변 대기
                              </span>
                            ) : hasNewReply ? (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-white rounded-full" />
                                새 답변 도착
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                답변 완료
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-neutral-800 text-base truncate">
                            {inq.message}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-neutral-400 font-medium">{inq.time}</span>
                          {isExpanded ? (
                            <ChevronUp className="size-4 text-neutral-500" />
                          ) : (
                            <ChevronDown className="size-4 text-neutral-500" />
                          )}
                        </div>
                      </button>

                      {/* Detail Body (Accordion Panel) */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-neutral-100 bg-neutral-50/30 animate-in slide-in-from-top-2 duration-150">
                          {/* User Message details */}
                          <div className="flex flex-col gap-1.5 mb-4">
                            <span className="text-xs font-bold text-neutral-400 uppercase">문의 상세 내용</span>
                            <div className="bg-white border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                              {inq.message}
                            </div>
                          </div>

                          {/* Admin Reply detail */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold text-neutral-400 uppercase">관리자 답변</span>
                            {inq.reply ? (
                              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed shadow-sm">
                                <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5 mb-2 text-xs text-emerald-700 font-bold">
                                  <span>👑 BlockCanvas 운영진</span>
                                  <span>
                                    {inq.replied_at && new Date(inq.replied_at).toLocaleString('ko-KR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <div className="text-neutral-800 font-medium">
                                  {inq.reply}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-400 font-medium italic text-center">
                                문의가 성공적으로 접수되어 관리자 검토 대기 중입니다. 답변 등록 시 이곳에 즉시 업데이트됩니다.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={() => handleDeleteMessage(inq.id, true)}
                              className="text-xs font-bold text-red-600 hover:text-white flex items-center gap-1.5 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                            >
                              <Trash2 className="size-3.5" />
                              문의 내역 삭제
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

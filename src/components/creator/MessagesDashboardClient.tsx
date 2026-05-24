'use client'

import React, { useState } from 'react'
import { NotificationList, NotificationMessage } from '@/components/ui/notification-list'
import { markMessageAsRead } from '@/app/actions/contact'
import { CheckCircle, Mail, Clock } from 'lucide-react'

interface Props {
  initialMessages: NotificationMessage[];
  creatorName: string;
}

export default function MessagesDashboardClient({ initialMessages, creatorName }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [viewAll, setViewAll] = useState(false)

  const handleMarkAsRead = async (id: string) => {
    const res = await markMessageAsRead(id)
    if (res.success) {
      setMessages(messages.map(m => m.id === id ? { ...m, is_read: true } : m))
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Section */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Animated Stack */}
        <div className="flex-shrink-0 relative group">
          <NotificationList 
            notifications={messages} 
            onViewAll={() => {
              setViewAll(true)
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
      <div id="all-messages-list" className="mt-8 bg-white border border-neutral-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-neutral-900">받은 메시지 목록</h2>
        </div>
        
        <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 font-medium">
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
                    {!msg.is_read && (
                      <button 
                        onClick={() => handleMarkAsRead(msg.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <CheckCircle className="size-3" />
                        읽음 처리
                      </button>
                    )}
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
  )
}

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/app/actions/notifications'
import { Megaphone, MessageCircle, ShieldAlert, Coins, Info, CheckCheck, CheckCircle, Inbox } from 'lucide-react'

export interface InboxItem {
  id: string
  category: string
  title: string
  body: string
  sender_name: string
  is_read: boolean
  created_at: string // ISO
  time: string // 상대시각 표기
}

const CATEGORY_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  notice: { label: '공지', Icon: Megaphone, cls: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  dm: { label: '관리자 메시지', Icon: MessageCircle, cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  moderation: { label: '제재', Icon: ShieldAlert, cls: 'bg-red-50 text-red-600 border-red-200' },
  coin: { label: '코인', Icon: Coins, cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  system: { label: '시스템', Icon: Info, cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

export default function InboxNotifications({ initial }: { initial: InboxItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [busy, setBusy] = useState(false)

  const unread = items.filter((i) => !i.is_read).length

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)))
    const res = await markNotificationReadAction(id)
    if (res?.error) {
      // 롤백
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: false } : i)))
    } else {
      router.refresh()
    }
  }

  const markAll = async () => {
    if (unread === 0 || busy) return
    setBusy(true)
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })))
    const res = await markAllNotificationsReadAction()
    setBusy(false)
    if (!res?.error) router.refresh()
  }

  return (
    <div className="bg-white border border-neutral-200 shadow-sm rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <Inbox className="size-5 text-neutral-500" /> 알림 · 공지
          </h2>
          {unread > 0 && (
            <span className="bg-red-100 text-red-600 text-[11px] font-extrabold px-2 py-0.5 rounded-full">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            disabled={busy}
            className="text-xs font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" /> 모두 읽음
          </button>
        )}
      </div>

      <div className="divide-y divide-neutral-100 max-h-[480px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 font-medium">받은 알림이 없습니다.</div>
        ) : (
          items.map((n) => {
            const meta = CATEGORY_META[n.category] || CATEGORY_META.system
            const { Icon } = meta
            return (
              <div key={n.id} className={`p-5 transition-colors ${n.is_read ? 'bg-white' : 'bg-blue-50/40'}`}>
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.cls}`}>
                      <Icon className="size-3" /> {meta.label}
                    </span>
                    <h4 className="font-bold text-neutral-900">{n.title}</h4>
                    {!n.is_read && (
                      <span className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest">New</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs text-neutral-400 font-medium">{n.time}</span>
                    {!n.is_read && (
                      <button
                        onClick={() => markOne(n.id)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                      >
                        <CheckCircle className="size-3" /> 읽음
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                  {n.body}
                </div>
                <div className="mt-2 text-[11px] text-neutral-400 font-medium">보낸이: {n.sender_name}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

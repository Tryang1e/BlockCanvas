'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendBroadcastAction } from '@/app/actions/notifications'
import { Megaphone, Loader2 } from 'lucide-react'

const AUDIENCES = [
  { value: 'all', label: '전체 회원' },
  { value: 'user', label: '일반 사용자(user)' },
  { value: 'creator', label: '일반 크리에이터(creator)' },
  { value: 'official', label: '공식 크리에이터(official)' },
  { value: 'manager', label: '중간 관리자(manager)' },
  { value: 'admin', label: '최종 관리자(admin)' },
]

export default function BroadcastComposer() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!title.trim() || !body.trim()) {
      setMsg({ ok: false, text: '제목과 내용을 입력해 주세요.' })
      return
    }
    if (!confirm(`'${AUDIENCES.find((a) => a.value === audience)?.label}' 대상에게 공지를 발송하시겠습니까?`)) return
    setLoading(true)
    setMsg(null)
    const res = await sendBroadcastAction(title, body, audience)
    setLoading(false)
    if (res?.error) {
      setMsg({ ok: false, text: res.error })
    } else {
      setMsg({ ok: true, text: `${res?.count ?? 0}명에게 공지를 발송했습니다.` })
      setTitle('')
      setBody('')
      router.refresh()
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Megaphone className="size-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-neutral-900">전체 공지 작성</h2>
      </div>

      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">발송 대상</label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="공지 제목"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">내용</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="공지 내용을 입력하세요."
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      {msg && (
        <div className={`text-sm font-medium px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <><Loader2 className="size-4 animate-spin" /> 발송 중...</> : <><Megaphone className="size-4" /> 공지 발송</>}
        </button>
      </div>
    </form>
  )
}

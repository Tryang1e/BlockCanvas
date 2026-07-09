'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { roleLabel } from '@/lib/roles'
import {
  applyPunishmentAction,
  liftMuteAction,
  liftSuspensionAction,
  escalateToBanAction,
  unbanAction,
} from '@/app/actions/moderation'
import { grantCoinsAction, sendDirectMessageAction } from '@/app/actions/notifications'
import { grantSubscriptionToUsers, grantPlotSlotsToUsers } from '@/app/actions/adminGrants'
import { updateUserRoleAction, resetUser2FAAction, impersonateUserAction, deleteUserAction } from '@/app/actions/admin'
import { setWorldExploreSuspended } from '@/app/actions/worlds'
import {
  ShieldAlert, Coins, MessageCircle, UserCog, KeyRound, Trash2, Ban, ShieldCheck,
  Boxes, Map as MapIcon, HardDrive, Gamepad2, AlertTriangle, Loader2, Clock, Gift,
} from 'lucide-react'

interface Data {
  id: string; creator_name: string; display_name: string | null; avatar_url: string | null
  email: string | null; role: string; discord_id: string | null; discord_username: string | null
  minecraft_uuid: string | null; minecraft_username: string | null; two_factor_enabled: boolean
  privacy_consent_version: string | null; created_at: string; last_seen_at: string | null
  portfolio_published: boolean; status: string; suspended_until: string | null; muted_until: string | null
  moderation_reason: string | null; isBanned: boolean; isSuspended: boolean; isMuted: boolean
  subscription_until: string | null; plot_slot_bonus: number
}
interface ServerData {
  coinBalance: number | null; playtimeLabel: string; mcOnline: boolean; plotCount: number
  plots: { id: string; alias: string | null; world: string; auction_price: number | null }[]
  worldCount: number; worldActive: number; worlds: { id: string; name: string; status: string; size: number; exploreShared?: boolean; exploreSuspended?: boolean }[]
  schemCount: number; usedBytesLabel: string; quotaLabel: string; quotaPct: number; worldQuotaState: string
}
interface HistoryItem {
  id: string; type: string; severity: string | null; reason: string | null; moderator_name: string
  mute_until: string | null; suspend_until: string | null; permanent: boolean; created_at: string
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR') : '무기한')
const fmtDateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR') : '—')

const HISTORY_LABEL: Record<string, string> = {
  mute: '뮤트', suspend: '이용정지', ban: '영구차단', warn: '경고',
  lift_mute: '뮤트 해제', lift_suspend: '정지 해제', unban: '차단 해제',
}

export default function UserManageClient({
  data, serverData, history, projectCount, canSuper,
}: { data: Data; serverData: ServerData; history: HistoryItem[]; projectCount: number; canSuper: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // 처벌 폼
  const [reason, setReason] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [muteDays, setMuteDays] = useState('')
  const [suspendDays, setSuspendDays] = useState('')
  const [permanent, setPermanent] = useState(false)
  // 코인/구독/플롯/DM
  const [coinAmount, setCoinAmount] = useState('')
  const [coinReason, setCoinReason] = useState('')
  const [subQty, setSubQty] = useState('1')
  const [plotQty, setPlotQty] = useState('1')
  const [dmTitle, setDmTitle] = useState('')
  const [dmBody, setDmBody] = useState('')
  const [selectedRole, setSelectedRole] = useState(data.role)

  async function run(key: string, fn: () => Promise<{ error?: string; success?: boolean } | void>, okMsg?: string) {
    if (busy) return
    setBusy(key)
    try {
      const res = await fn()
      if (res && 'error' in res && res.error) alert(`오류: ${res.error}`)
      else if (okMsg) alert(okMsg)
      router.refresh()
    } catch (e: unknown) {
      alert(`오류: ${e instanceof Error ? e.message : '서버 통신 실패'}`)
    } finally {
      setBusy(null)
    }
  }

  const statusBadge = () => {
    if (data.isBanned) return <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-700">영구 차단</span>
    if (data.isSuspended) return <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-700">이용정지 ({fmtDate(data.suspended_until)})</span>
    if (data.isMuted) return <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-orange-100 text-orange-700">뮤트 ({fmtDate(data.muted_until)})</span>
    return <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700">정상</span>
  }

  const punish = (severity: 'low' | 'medium' | 'high') => {
    const labels = { low: '경미 (뮤트 5일 + 정지 3일)', medium: '중간 (뮤트 30일 + 정지 3주)', high: '심각 (무기한 이용정지)' }
    if (!confirm(`[${data.creator_name}] 에게 '${labels[severity]}' 제재를 적용하시겠습니까?`)) return
    run('punish', () => applyPunishmentAction(data.id, severity, undefined, reason || undefined))
  }

  const punishCustom = () => {
    const md = muteDays ? Number(muteDays) : null
    const sd = suspendDays ? Number(suspendDays) : null
    if (!md && !sd && !permanent) { alert('뮤트/정지 기간 중 하나는 입력하세요.'); return }
    if (!confirm(`커스텀 제재를 적용하시겠습니까?\n뮤트: ${md || 0}일 / 정지: ${permanent ? '무기한' : (sd || 0) + '일'}`)) return
    run('punish', () => applyPunishmentAction(data.id, 'custom', { muteDays: md, suspendDays: sd, permanentSuspend: permanent }, reason || undefined))
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center text-2xl font-black text-blue-600">
          {data.avatar_url ? <img src={data.avatar_url} alt="" className="w-full h-full object-cover" /> : (data.display_name || data.creator_name).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-neutral-900">{data.creator_name}</h1>
            <span className="text-sm text-neutral-400">({data.display_name || '-'})</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">{roleLabel(data.role)}</span>
            {statusBadge()}
          </div>
          <p className="text-xs text-neutral-400 mt-1 font-mono">{data.id}</p>
        </div>
      </div>

      {/* 건축 서버 데이터 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DataCard icon={<Coins className="size-5" />} label="코인 (CMI)" value={serverData.coinBalance != null ? serverData.coinBalance.toLocaleString() : (data.minecraft_uuid ? (serverData.mcOnline ? '0' : '서버 오프라인') : '미연동')} tint="amber" />
        <DataCard icon={<Clock className="size-5" />} label="총 접속 시간" value={serverData.playtimeLabel} tint="rose" />
        <DataCard icon={<MapIcon className="size-5" />} label="플롯 소지" value={`${serverData.plotCount} 개`} tint="blue" />
        <DataCard icon={<Boxes className="size-5" />} label="월드 (활성/전체)" value={`${serverData.worldActive} / ${serverData.worldCount}`} tint="indigo" />
        <DataCard icon={<HardDrive className="size-5" />} label="클라우드 사용량" value={`${serverData.usedBytesLabel} / ${serverData.quotaLabel}`} sub={`${serverData.quotaPct}% · 스키매틱 ${serverData.schemCount}개`} tint="emerald" />
      </div>

      {/* 제재 패널 */}
      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><ShieldAlert className="size-5 text-red-500" /> 제재 관리</h2>
        {data.moderation_reason && <p className="text-xs text-neutral-500">최근 사유: <span className="font-medium text-neutral-700">{data.moderation_reason}</span></p>}

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">제재 사유 (공통)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 채팅 욕설/스팸 등" className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => punish('low')} disabled={busy !== null || data.isBanned} className="px-3 py-2 rounded-lg text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 disabled:opacity-40">경미 · 뮤트5일+정지3일</button>
          <button onClick={() => punish('medium')} disabled={busy !== null || data.isBanned} className="px-3 py-2 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 disabled:opacity-40">중간 · 뮤트30일+정지3주</button>
          <button onClick={() => punish('high')} disabled={busy !== null || data.isBanned} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-40">심각 · 무기한 정지</button>
          <button onClick={() => setShowCustom((v) => !v)} className="px-3 py-2 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 hover:bg-neutral-200">커스텀 ▾</button>
        </div>

        {showCustom && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-neutral-600">뮤트(일)
              <input type="number" min={0} value={muteDays} onChange={(e) => setMuteDays(e.target.value)} className="mt-1 w-24 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-bold text-neutral-600">정지(일)
              <input type="number" min={0} value={suspendDays} onChange={(e) => setSuspendDays(e.target.value)} disabled={permanent} className="mt-1 w-24 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm disabled:opacity-40" />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 pb-2">
              <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} /> 무기한 정지
            </label>
            <button onClick={punishCustom} disabled={busy !== null || data.isBanned} className="px-3 py-2 rounded-lg text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">적용</button>
          </div>
        )}

        {/* 해제/차단 */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
          {data.isMuted && <button onClick={() => run('liftMute', () => liftMuteAction(data.id))} disabled={busy !== null} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40">뮤트 해제</button>}
          {data.isSuspended && <button onClick={() => run('liftSusp', () => liftSuspensionAction(data.id))} disabled={busy !== null} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40">이용정지 해제</button>}
          {canSuper && !data.isBanned && (
            <button onClick={() => { if (confirm(`[${data.creator_name}] 를 영구 차단하시겠습니까?\n(항소 종료 후 회원 영구삭제가 가능해집니다.)`)) run('ban', () => escalateToBanAction(data.id, reason || undefined)) }} disabled={busy !== null} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 flex items-center gap-1"><Ban className="size-3.5" /> 영구 차단</button>
          )}
          {canSuper && data.isBanned && (
            <button onClick={() => run('unban', () => unbanAction(data.id))} disabled={busy !== null} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1"><ShieldCheck className="size-3.5" /> 차단 해제</button>
          )}
        </div>

        {/* DB 파기(영구삭제) — 영구차단 상태에서 최종관리자만 */}
        {canSuper && data.isBanned && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>항소 절차가 끝났다면 회원 데이터를 영구 삭제(파기)할 수 있습니다. 이 작업은 되돌릴 수 없습니다.</span>
            </div>
            <button
              onClick={() => { if (confirm(`정말로 [${data.creator_name}] 회원과 모든 데이터를 영구 삭제(파기)하시겠습니까?\n되돌릴 수 없습니다.`)) run('delete', async () => { const r = await deleteUserAction(data.id); if (!r?.error) window.location.href = '/adminpage'; return r }) }}
              disabled={busy !== null}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-red-700 text-white hover:bg-red-800 disabled:opacity-40 flex items-center gap-1 shrink-0"
            ><Trash2 className="size-3.5" /> DB 영구삭제</button>
          </div>
        )}
      </section>

      {/* 빠른 액션 */}
      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Gamepad2 className="size-5 text-blue-500" /> 운영 액션</h2>

        {/* 💎 무상 가치 지급(코인·구독·플롯)은 최종 관리자(admin) 전용 — 매니저 UI 에서 숨김(C-2, 서버측 requireSuperAdmin 과 일치). */}
        {canSuper && (<>
        {/* 코인 지급 */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-neutral-600">코인 지급
            <input type="number" min={1} value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} placeholder="수량" className="mt-1 block w-28 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <input value={coinReason} onChange={(e) => setCoinReason(e.target.value)} placeholder="사유(선택)" className="flex-1 min-w-[160px] border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => { const a = Number(coinAmount); if (!a || a <= 0) { alert('지급 수량을 입력하세요.'); return } run('coin', async () => { const r = await grantCoinsAction(data.id, a, coinReason || undefined); if (!r?.error) { setCoinAmount(''); setCoinReason('') } return r }) }} disabled={busy !== null || !data.minecraft_uuid} title={!data.minecraft_uuid ? '마크 미연동 — 코인 지급 불가' : ''} className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 flex items-center gap-1"><Coins className="size-3.5" /> 지급</button>
        </div>

        {/* 구독권 선물 */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-neutral-600">구독권 선물(장)
            <input type="number" min={1} value={subQty} onChange={(e) => setSubQty(e.target.value)} className="mt-1 block w-24 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <span className="text-[11px] text-neutral-400 pb-2">
            현재: {data.subscription_until && new Date(data.subscription_until) > new Date() ? `구독중 ~${new Date(data.subscription_until).toLocaleDateString('ko-KR')}` : '구독 없음'}
          </span>
          <button
            onClick={() => { const n = Number(subQty); if (!n || n <= 0) { alert('구독권 수량을 입력하세요.'); return } run('sub', async () => { const r = await grantSubscriptionToUsers([data.id], n, coinReason || undefined); if ('error' in r) return { error: r.error }; if (r.failed > 0) return { error: r.errors[0]?.error || '지급 실패' }; return { success: true } }, '구독권을 선물했습니다.') }}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 flex items-center gap-1"
          ><Gift className="size-3.5" /> 선물</button>
        </div>

        {/* 플롯 최대 확장권 지급 */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-neutral-600">플롯 확장권(개)
            <input type="number" min={1} value={plotQty} onChange={(e) => setPlotQty(e.target.value)} className="mt-1 block w-24 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <span className="text-[11px] text-neutral-400 pb-2">현재 보너스: +{data.plot_slot_bonus}개</span>
          <button
            onClick={() => { const n = Number(plotQty); if (!n || n <= 0) { alert('플롯 확장권 수량을 입력하세요.'); return } run('plot', async () => { const r = await grantPlotSlotsToUsers([data.id], n, coinReason || undefined); if ('error' in r) return { error: r.error }; if (r.failed > 0) return { error: r.errors[0]?.error || '지급 실패' }; return { success: true } }, '플롯 확장권을 지급했습니다.') }}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 flex items-center gap-1"
          ><MapIcon className="size-3.5" /> 지급</button>
        </div>
        </>)}

        {/* DM */}
        <div className="space-y-2">
          <input value={dmTitle} onChange={(e) => setDmTitle(e.target.value)} placeholder="개인 메시지 제목" className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={dmBody} onChange={(e) => setDmBody(e.target.value)} rows={2} placeholder="개인 메시지 내용" className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm resize-y" />
          <div className="flex justify-end">
            <button onClick={() => { if (!dmTitle.trim() || !dmBody.trim()) { alert('제목과 내용을 입력하세요.'); return } run('dm', async () => { const r = await sendDirectMessageAction(data.id, dmTitle, dmBody); if (!r?.error) { setDmTitle(''); setDmBody('') } return r }, 'DM 발송 완료') }} disabled={busy !== null} className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1"><MessageCircle className="size-3.5" /> 메시지 보내기</button>
          </div>
        </div>

        {/* 기타 액션 */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
          <button onClick={() => { if (confirm(`[${data.creator_name}] 계정으로 대행 로그인하시겠습니까?`)) run('imp', async () => { const r = await impersonateUserAction(data.creator_name); if (!r?.error) window.location.href = `https://${data.creator_name}.craftopia.work/dashboard`; return r }) }} disabled={busy !== null} className="px-3 py-2 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1"><UserCog className="size-3.5" /> 대행 로그인</button>
          {data.two_factor_enabled && <button onClick={() => { if (confirm('2FA를 강제 초기화하시겠습니까?')) run('2fa', () => resetUser2FAAction(data.id), '2FA 초기화 완료') }} disabled={busy !== null} className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 flex items-center gap-1"><KeyRound className="size-3.5" /> 2FA 초기화</button>}
          {data.email && <a href={`/adminpage/password-reset?email=${encodeURIComponent(data.email)}`} className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-1"><KeyRound className="size-3.5" /> 비밀번호 리셋</a>}
        </div>

        {/* 역할 변경 — 최종관리자만 */}
        {canSuper && (
          <div className="flex items-end gap-2 pt-2 border-t border-neutral-100">
            <label className="text-xs font-bold text-neutral-600">역할 변경
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="mt-1 block border border-neutral-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="user">일반 사용자 (user)</option>
                <option value="creator">일반 크리에이터 (creator)</option>
                <option value="official">공식 크리에이터 (official)</option>
                <option value="manager">중간 관리자 (manager/staff)</option>
                <option value="admin">최종 관리자 (admin)</option>
              </select>
            </label>
            <button onClick={() => { if (selectedRole !== data.role && confirm(`역할을 ${roleLabel(selectedRole)} 로 변경하시겠습니까?`)) run('role', () => updateUserRoleAction(data.id, selectedRole)) }} disabled={busy !== null || selectedRole === data.role} className="px-3 py-2 rounded-lg text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">변경</button>
          </div>
        )}

        {/* 탐방 공유 관리 — 관리자/스태프가 이 유저의 공유 월드를 정지/해제(어뷰징 차단). 서버에서 canModerate 재검증. */}
        {serverData.worlds.some((w) => w.exploreShared) && (
          <div className="pt-2 border-t border-neutral-100">
            <div className="text-xs font-bold text-neutral-600 mb-2">탐방 공유 월드</div>
            <ul className="space-y-1.5">
              {serverData.worlds.filter((w) => w.exploreShared).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MapIcon className="size-3.5 text-neutral-400 shrink-0" />
                    <span className="font-medium text-neutral-800 truncate">{w.name}</span>
                    {w.exploreSuspended && <span className="text-[9px] font-bold px-1 py-px rounded bg-rose-100 text-rose-600 shrink-0">정지됨</span>}
                  </span>
                  <button
                    onClick={() => run('explore-' + w.id, () => setWorldExploreSuspended(w.id, !w.exploreSuspended))}
                    disabled={busy !== null}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border disabled:opacity-40 ${w.exploreSuspended ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-rose-300 text-rose-600 hover:bg-rose-50'}`}
                  >
                    {w.exploreSuspended ? '정지 해제' : '공유 정지'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 신원/연동 + 웹 콘텐츠 */}
      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">신원 · 연동</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row k="이메일" v={data.email || '—'} />
          <Row k="2FA" v={data.two_factor_enabled ? '✅ 활성화' : '미설정'} />
          <Row k="Discord" v={data.discord_id ? `${data.discord_username || ''} (${data.discord_id})` : '미연동'} />
          <Row k="Minecraft" v={data.minecraft_uuid ? `${data.minecraft_username || ''}` : '미연동'} />
          <Row k="가입일" v={fmtDateOnly(data.created_at)} />
          <Row k="마지막 인게임 접속" v={fmtDateOnly(data.last_seen_at)} />
          <Row k="개인정보 동의 버전" v={data.privacy_consent_version || '레거시/미동의'} />
          <Row k="포트폴리오" v={data.portfolio_published ? '공개' : '비공개/없음'} />
          <Row k="게시물 수" v={`${projectCount} 개`} />
          <Row k="쿼터 상태" v={serverData.worldQuotaState} />
        </dl>
      </section>

      {/* 제재 이력 */}
      <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-100"><h2 className="text-lg font-bold text-neutral-900">제재 이력</h2></div>
        <div className="divide-y divide-neutral-100 max-h-[360px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 font-medium">제재 이력이 없습니다.</div>
          ) : history.map((h) => (
            <div key={h.id} className="p-4 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-bold text-neutral-800">{HISTORY_LABEL[h.type] || h.type}</span>
                {h.severity && <span className="ml-2 text-[11px] text-neutral-400 uppercase">{h.severity}</span>}
                {h.mute_until && <span className="ml-2 text-xs text-orange-600">뮤트~{fmtDate(h.mute_until)}</span>}
                {(h.type === 'suspend' || h.type === 'ban') && <span className="ml-2 text-xs text-amber-600">정지~{h.permanent ? '영구' : fmtDate(h.suspend_until)}</span>}
                {h.reason && <p className="text-xs text-neutral-500 mt-0.5">{h.reason}</p>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-neutral-400">{new Date(h.created_at).toLocaleString('ko-KR')}</div>
                <div className="text-[11px] text-neutral-500 font-medium">{h.moderator_name}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {busy && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="size-4 animate-spin" /> 처리 중...
        </div>
      )}
    </div>
  )
}

function DataCard({ icon, label, value, sub, tint }: { icon: React.ReactNode; label: string; value: string; sub?: string; tint: string }) {
  const tints: Record<string, string> = {
    amber: 'text-amber-600 bg-amber-50', blue: 'text-blue-600 bg-blue-50',
    indigo: 'text-indigo-600 bg-indigo-50', emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
  }
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${tints[tint] || tints.blue}`}>{icon}</div>
      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black text-neutral-800 leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-50 pb-2">
      <dt className="text-neutral-400 shrink-0">{k}</dt>
      <dd className="font-medium text-neutral-800 text-right break-all">{v}</dd>
    </div>
  )
}

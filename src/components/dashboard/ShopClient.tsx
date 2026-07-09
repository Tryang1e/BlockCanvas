'use client'

import { useCallback, useEffect, useState } from 'react'
import { Coins, ShoppingBag, Loader2, Pencil, Clock, ArrowLeftRight, Sparkles, Store, Crown, Check, MapPin } from 'lucide-react'
import {
  getMyShop,
  purchaseItem,
  changeNicknameAction,
  purchaseSubscription,
  purchasePlotSlot,
} from '@/app/actions/shop'
import { formatBytes } from '@/lib/worldQuota'

interface Item { key: string; label: string; description: string; price: number }
interface NickInfo { price: number; minLen: number; maxLen: number }
interface SubInfo { price: number; days: number; quotaBonusBytes: number; active: boolean; until: string | null; daysLeft: number }
interface SlotInfo { price: number; bonus: number; max: number; baseLimit: number | null; limit: number | null; owned: number | null }

export default function ShopClient() {
  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [balance, setBalance] = useState<number | null>(null)
  const [linked, setLinked] = useState(false)
  const [nick, setNick] = useState<NickInfo | null>(null)
  const [sub, setSub] = useState<SubInfo | null>(null)
  const [slot, setSlot] = useState<SlotInfo | null>(null)
  const [nickInput, setNickInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const reload = useCallback(async () => {
    const r = await getMyShop()
    if (r.success) {
      setItems(r.items)
      setOwned(new Set(r.owned))
      setBalance(r.balance)
      setLinked(r.linked)
      setNick(r.nick)
      setSub(r.subscription)
      setSlot(r.plotSlot)
    } else {
      setMsg({ type: 'err', text: r.error || '상점을 불러오지 못했습니다.' })
    }
    setLoaded(true)
  }, [])

  useEffect(() => { reload() }, [reload])

  const buyItem = async (key: string) => {
    setBusy(key); setMsg(null)
    const r = await purchaseItem(key)
    if (r.success) {
      setMsg({ type: 'ok', text: r.message || '구매 완료' })
      if (typeof r.balance === 'number') setBalance(r.balance)
      await reload()
    } else {
      setMsg({ type: 'err', text: r.error || '구매에 실패했습니다.' })
    }
    setBusy(null)
  }

  const changeNick = async () => {
    setBusy('nick'); setMsg(null)
    const r = await changeNicknameAction(nickInput)
    if (r.success) {
      setMsg({ type: 'ok', text: r.message || '닉네임을 변경했어요.' })
      setNickInput('')
      await reload()
    } else {
      setMsg({ type: 'err', text: r.error || '변경에 실패했습니다.' })
    }
    setBusy(null)
  }

  const buySubscription = async () => {
    setBusy('sub'); setMsg(null)
    const r = await purchaseSubscription()
    if (r.success) {
      setMsg({ type: 'ok', text: r.message || '구독을 연장했어요.' })
      await reload()
    } else {
      setMsg({ type: 'err', text: r.error || '구독에 실패했습니다.' })
    }
    setBusy(null)
  }

  const buyPlotSlot = async () => {
    setBusy('slot'); setMsg(null)
    const r = await purchasePlotSlot()
    if (r.success) {
      setMsg({ type: 'ok', text: r.message || '플롯 확장권을 구매했어요.' })
      await reload()
    } else {
      setMsg({ type: 'err', text: r.error || '구매에 실패했습니다.' })
    }
    setBusy(null)
  }

  if (!loaded) return <div className="text-neutral-400 text-sm font-medium">불러오는 중…</div>

  const nickLen = [...nickInput.trim()].length
  const canAffordNick = nick != null && balance !== null && balance >= nick.price
  const nickReady = nick != null && nickLen >= nick.minLen && nickLen <= nick.maxLen

  const canAffordSub = sub != null && balance !== null && balance >= sub.price
  const subUntilLabel = sub?.until ? new Date(sub.until).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  const slotUnlimited = slot != null && slot.limit === 0 // 무제한 그룹(어드민 등)
  const slotAtMax = slot != null && slot.max > 0 && slot.bonus >= slot.max
  const slotBuyable = slot != null && slot.price > 0 && !slotUnlimited && !slotAtMax
  const canAffordSlot = slot != null && balance !== null && slot.price > 0 && balance >= slot.price

  return (
    <div className="space-y-7">
      {/* 잔액 히어로 + 코인 버는 법 */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-amber-600/80">보유 코인</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-4xl font-black tabular-nums text-amber-900">
                {balance !== null ? balance.toLocaleString() : '—'}
              </span>
              <span className="text-sm font-bold text-amber-700">코인</span>
            </div>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/20 ring-1 ring-amber-300/50">
            <Coins size={28} className="text-amber-500" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-amber-200/70 pt-3 text-[11px] font-semibold text-amber-700/90">
          <span className="text-amber-600/70">코인 버는 법</span>
          <span className="inline-flex items-center gap-1"><Clock size={12} className="text-amber-500" /> 인게임 접속 10분당 +20</span>
          <span className="inline-flex items-center gap-1"><ArrowLeftRight size={12} className="text-amber-500" /> 유저 간 송금</span>
        </div>
      </div>

      {!linked && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          코인 잔액 조회·구매는 마인크래프트 연동이 필요합니다. [외부 계정 연동]에서 연동해 주세요.
        </div>
      )}
      {msg && (
        <div className={`p-3 rounded-xl text-xs font-medium border ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
          {msg.text}
        </div>
      )}

      {/* BLOCKCANVAS 구독 */}
      {sub && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50/60 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-300/50">
                <Crown size={20} className="text-indigo-500" />
              </div>
              <div>
                <div className="font-extrabold text-indigo-950">BLOCKCANVAS 구독</div>
                {sub.active && subUntilLabel
                  ? <div className="text-xs font-bold text-indigo-600">구독 중 · {subUntilLabel}까지 (D-{sub.daysLeft})</div>
                  : <div className="text-xs font-medium text-indigo-400">미구독 — {sub.days}일 단위로 구독해요</div>}
              </div>
            </div>
            {sub.active && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500 text-white text-[11px] font-bold">
                <Check size={12} /> 구독 중
              </span>
            )}
          </div>

          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <li className="flex items-center gap-1.5 rounded-lg bg-white/70 border border-indigo-100 px-3 py-2 text-indigo-900 font-semibold">
              <Check size={13} className="text-indigo-500 shrink-0" /> 클라우드 용량 +{formatBytes(sub.quotaBonusBytes)}
            </li>
            <li className="flex items-center gap-1.5 rounded-lg bg-white/70 border border-indigo-100 px-3 py-2 text-indigo-900 font-semibold">
              <Check size={13} className="text-indigo-500 shrink-0" /> 인게임 코인 적립 부스트
            </li>
            <li className="flex items-center gap-1.5 rounded-lg bg-white/70 border border-indigo-100 px-3 py-2 text-indigo-900 font-semibold">
              <Check size={13} className="text-indigo-500 shrink-0" /> 포트폴리오 사이트 제공
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-indigo-400">
            포트폴리오 사이트는 <a href="/terms" className="underline hover:text-indigo-600">이용약관</a> 위반 시 구독이 회수될 수 있어요.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-indigo-800 font-bold text-sm">
              <Coins size={15} className="text-amber-500" /> {sub.price.toLocaleString()} 코인 / {sub.days}일
            </span>
            <button
              onClick={buySubscription}
              disabled={!linked || !!busy || !canAffordSub}
              title={!canAffordSub && linked ? '코인이 부족합니다' : ''}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === 'sub' ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
              {busy === 'sub' ? '처리 중…'
                : !canAffordSub && linked ? '코인 부족'
                : sub.active ? `${sub.days}일 연장` : '구독하기'}
            </button>
          </div>
          {sub.active && (
            <p className="mt-2 text-[11px] text-indigo-400">연장하면 남은 기간에 더해집니다. (추후 Patreon 구독과도 합산)</p>
          )}
        </div>
      )}

      <div>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={16} className="text-amber-500" />
        <h2 className="text-sm font-black text-neutral-900">특별 상품</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 닉네임 변경권 */}
        {nick && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-2">
              <Pencil size={16} className="text-neutral-500" />
              <span className="font-bold text-neutral-900">닉네임 변경권</span>
            </div>
            <p className="text-xs text-neutral-500">
              원하는 닉네임으로 변경해요. 한글·영문·숫자 <b>{nick.minLen}~{nick.maxLen}자</b>, 정치·논란·부적절한 표현은 사용할 수 없어요.
            </p>
            <input
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              maxLength={nick.maxLen}
              placeholder="새 닉네임"
              disabled={!linked || busy === 'nick'}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-amber-700 font-bold">
                <Coins size={14} className="text-amber-500" /> {nick.price.toLocaleString()} 코인
              </span>
              <span className="text-neutral-400">{nickLen}/{nick.maxLen}자</span>
            </div>
            <button
              onClick={changeNick}
              disabled={!linked || !!busy || !nickReady || !canAffordNick}
              title={!canAffordNick && linked ? '코인이 부족합니다' : ''}
              className="w-full py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === 'nick' ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
              {busy === 'nick' ? '변경 중…' : !canAffordNick && linked && nickReady ? '코인 부족' : '닉네임 변경'}
            </button>
          </div>
        )}

        {/* 플롯 확장 구매권 */}
        {slot && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-neutral-500" />
              <span className="font-bold text-neutral-900">플롯 확장 구매권</span>
              {slot.bonus > 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+{slot.bonus}</span>}
            </div>
            <p className="text-xs text-neutral-500">
              최대 플롯 구매(claim) 한도를 <b>+1</b> 늘려요. 구매할수록 가격이 2배씩 올라가요.
            </p>
            <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-[11px] font-semibold text-neutral-600 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>현재 한도 {slot.limit === 0 ? '무제한' : slot.limit ?? '—'}</span>
              <span className="text-neutral-400">기본 {slot.baseLimit === 0 ? '무제한' : slot.baseLimit ?? '—'} · 확장 +{slot.bonus}</span>
              {slot.owned != null && <span className="text-neutral-400">보유 {slot.owned}</span>}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-amber-700 font-bold">
                <Coins size={14} className="text-amber-500" />
                {slotBuyable ? `${slot.price.toLocaleString()} 코인` : slotUnlimited ? '무제한 한도' : slotAtMax ? '최대 확장 도달' : '판매 중 아님'}
              </span>
              {slot.max > 0 && <span className="text-neutral-400">{slot.bonus}/{slot.max}</span>}
            </div>
            <button
              onClick={buyPlotSlot}
              disabled={!linked || !!busy || !slotBuyable || !canAffordSlot}
              title={!canAffordSlot && linked && slotBuyable ? '코인이 부족합니다' : ''}
              className="w-full py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === 'slot' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              {busy === 'slot' ? '구매 중…'
                : slotUnlimited ? '이미 무제한'
                : slotAtMax ? '최대 확장 도달'
                : !slotBuyable ? '판매 중 아님'
                : !canAffordSlot && linked ? '코인 부족'
                : '플롯 한도 +1'}
            </button>
          </div>
        )}
      </div>
      </div>

      {/* 일반 상점(영구 해금형) */}
      <div>
      <div className="mb-3 flex items-center gap-2">
        <Store size={16} className="text-neutral-500" />
        <h2 className="text-sm font-black text-neutral-900">일반 상점</h2>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const own = owned.has(it.key)
            const canAfford = balance !== null && balance >= it.price
            return (
              <div key={it.key} className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900">{it.label}</span>
                  {own && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">보유</span>}
                </div>
                <div className="text-xs text-neutral-500">{it.description}</div>
                <div className="flex items-center gap-1 text-amber-700 font-bold text-sm">
                  <Coins size={14} className="text-amber-500" /> {it.price.toLocaleString()} 코인
                </div>
                <button
                  onClick={() => buyItem(it.key)}
                  disabled={!!busy || own || !linked || !canAfford}
                  title={!canAfford ? '코인이 부족합니다' : ''}
                  className="mt-1 w-full py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {busy === it.key ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
                  {own ? '보유 중' : busy === it.key ? '구매 중…' : !canAfford && linked ? '코인 부족' : '구매'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center">
          <ShoppingBag size={22} className="mx-auto mb-2 text-neutral-300" />
          <p className="text-sm font-bold text-neutral-500">아직 판매 중인 상품이 없어요</p>
          <p className="mt-1 text-xs text-neutral-400">새로운 상품이 곧 추가될 예정이에요.</p>
        </div>
      )}
      </div>
    </div>
  )
}

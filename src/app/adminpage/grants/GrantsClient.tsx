"use client";

import { useState, useMemo } from "react";
import { roleLabel } from "@/lib/roles";
import { grantCoinsToUsers, grantSubscriptionToUsers, grantPlotSlotsToUsers, type GrantSummary } from "@/app/actions/adminGrants";
import { Coins, CalendarClock, Map as MapIcon, Search, Gift, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";

interface UserRow {
  id: string; name: string; display: string | null; role: string;
  mc: boolean; mcName: string | null; discord: string | null;
  subUntil: string | null; plotBonus: number; avatar: string | null;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }); } catch { return null; }
};
const isSubActive = (iso: string | null) => !!iso && new Date(iso).getTime() > Date.now();

export default function GrantsClient({ users, subscriptionDays, plotSlotMax }: { users: UserRow[]; subscriptionDays: number; plotSlotMax: number }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [coinAmt, setCoinAmt] = useState("");
  const [subQty, setSubQty] = useState("1");
  const [plotQty, setPlotQty] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; errors?: { name: string; error: string }[] } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.display, u.discord, u.mcName].some((s) => s && s.toLowerCase().includes(q)));
  }, [users, query]);

  const selCount = selected.size;
  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAllFiltered = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allFilteredSelected) filtered.forEach((u) => n.delete(u.id));
    else filtered.forEach((u) => n.add(u.id));
    return n;
  });

  async function doGrant(key: string, fn: () => Promise<GrantSummary | { error: string }>, confirmMsg: string) {
    if (busy) return;
    if (selCount === 0) { setResult({ ok: false, text: "대상 회원을 먼저 선택해주세요." }); return; }
    if (!confirm(confirmMsg)) return;
    setBusy(key);
    setResult(null);
    try {
      const r = await fn();
      if ("error" in r) setResult({ ok: false, text: r.error });
      else setResult({ ok: r.failed === 0, text: r.message, errors: r.errors });
    } catch (e: unknown) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "서버 통신 실패" });
    } finally {
      setBusy(null);
    }
  }

  const ids = () => [...selected];

  const grantCoin = () => {
    const a = Number(coinAmt);
    if (!a || a <= 0) { setResult({ ok: false, text: "지급할 코인 수량을 입력하세요." }); return; }
    doGrant("coin", () => grantCoinsToUsers(ids(), a, reason || undefined), `${selCount}명에게 ${a.toLocaleString()} 코인을 지급하시겠습니까?\n(마크 미연동 회원은 자동 제외됩니다)`);
  };
  const grantSub = () => {
    const n = Number(subQty);
    if (!n || n <= 0) { setResult({ ok: false, text: "구독권 수량을 입력하세요." }); return; }
    doGrant("sub", () => grantSubscriptionToUsers(ids(), n, reason || undefined), `${selCount}명에게 구독권 ${n}장(${n * subscriptionDays}일)을 선물하시겠습니까?`);
  };
  const grantPlot = () => {
    const n = Number(plotQty);
    if (!n || n <= 0) { setResult({ ok: false, text: "플롯 확장권 수량을 입력하세요." }); return; }
    doGrant("plot", () => grantPlotSlotsToUsers(ids(), n, reason || undefined), `${selCount}명에게 플롯 확장권 ${n}개를 지급하시겠습니까?`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white flex items-center justify-center shadow-sm"><Gift className="size-5" /></div>
        <div>
          <h1 className="text-xl font-black text-neutral-900">지급 · 선물</h1>
          <p className="text-xs text-neutral-500 font-medium">회원을 선택하고 코인 · 구독권 · 플롯 확장권을 지급합니다. (1명 또는 여러 명 동시)</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-5 items-start">
        {/* 좌: 유저 다중선택 */}
        <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-neutral-800">대상 회원</span>
              <span className="text-xs font-bold text-indigo-600">{selCount}명 선택됨{selCount > 0 && <button onClick={() => setSelected(new Set())} className="ml-2 text-neutral-400 hover:text-rose-500 font-medium">전체 해제</button>}</span>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="닉네임 · 디스코드 · 마크 검색" className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 cursor-pointer select-none">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="rounded border-neutral-300" />
              현재 목록 전체 선택 ({filtered.length}명)
            </label>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-neutral-50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-sm font-medium">일치하는 회원이 없습니다.</div>
            ) : filtered.map((u) => {
              const on = selected.has(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${on ? "bg-indigo-50/60" : "hover:bg-neutral-50"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(u.id)} className="rounded border-neutral-300 shrink-0" />
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center text-xs font-black text-indigo-600 shrink-0">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (u.display || u.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-neutral-900 truncate">{u.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-px rounded bg-neutral-100 text-neutral-500 uppercase shrink-0">{roleLabel(u.role)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                      {u.mc ? <span className="text-emerald-600">마크 {u.mcName || "연동"}</span> : <span className="text-rose-400">마크 미연동</span>}
                      {isSubActive(u.subUntil) && <span className="text-indigo-500">구독~{fmtDate(u.subUntil)}</span>}
                      {u.plotBonus > 0 && <span className="text-blue-500">플롯+{u.plotBonus}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* 우: 지급 폼 */}
        <section className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">공통 사유 (선택)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 이벤트 보상, 사과 보상 등" className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          </div>

          {/* 코인 */}
          <GrantCard icon={<Coins className="size-5" />} tint="amber" title="코인 지급" note="마크 연동 회원만 (CMI). 미연동은 자동 제외.">
            <div className="flex items-end gap-2">
              <input type="number" min={1} value={coinAmt} onChange={(e) => setCoinAmt(e.target.value)} placeholder="수량" className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={grantCoin} disabled={busy !== null || selCount === 0} className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 flex items-center gap-1 shrink-0">
                {busy === "coin" ? <Loader2 className="size-3.5 animate-spin" /> : <Coins className="size-3.5" />} 지급
              </button>
            </div>
          </GrantCard>

          {/* 구독권 */}
          <GrantCard icon={<CalendarClock className="size-5" />} tint="indigo" title="구독권 선물" note={`구독권 1장 = ${subscriptionDays}일 · user는 creator로 승격`}>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <input type="number" min={1} value={subQty} onChange={(e) => setSubQty(e.target.value)} placeholder="장수" className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
                <p className="text-[11px] text-neutral-400 mt-1">= {(Number(subQty) || 0) * subscriptionDays}일 연장</p>
              </div>
              <button onClick={grantSub} disabled={busy !== null || selCount === 0} className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 flex items-center gap-1 shrink-0">
                {busy === "sub" ? <Loader2 className="size-3.5 animate-spin" /> : <Gift className="size-3.5" />} 선물
              </button>
            </div>
          </GrantCard>

          {/* 플롯 확장권 */}
          <GrantCard icon={<MapIcon className="size-5" />} tint="blue" title="플롯 최대 확장권" note={plotSlotMax > 0 ? `1인 최대 ${plotSlotMax}개까지 (초과분 clamp)` : "상한 없음 (누적 가산)"}>
            <div className="flex items-end gap-2">
              <input type="number" min={1} value={plotQty} onChange={(e) => setPlotQty(e.target.value)} placeholder="개수" className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={grantPlot} disabled={busy !== null || selCount === 0} className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 flex items-center gap-1 shrink-0">
                {busy === "plot" ? <Loader2 className="size-3.5 animate-spin" /> : <MapIcon className="size-3.5" />} 지급
              </button>
            </div>
          </GrantCard>

          {result && (
            <div className={`p-3.5 rounded-xl text-xs font-medium flex items-start gap-2 ${result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
              {result.ok ? <CheckCircle2 size={15} className="mt-px shrink-0" /> : <ShieldAlert size={15} className="mt-px shrink-0" />}
              <div className="min-w-0">
                <p>{result.text}</p>
                {result.errors && result.errors.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-rose-600">
                    {result.errors.slice(0, 10).map((e, i) => <li key={i}>· {e.name}: {e.error}</li>)}
                    {result.errors.length > 10 && <li>· 외 {result.errors.length - 10}명…</li>}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function GrantCard({ icon, tint, title, note, children }: { icon: React.ReactNode; tint: string; title: string; note: string; children: React.ReactNode }) {
  const tints: Record<string, string> = { amber: "text-amber-600 bg-amber-50", indigo: "text-indigo-600 bg-indigo-50", blue: "text-blue-600 bg-blue-50" };
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tints[tint] || tints.indigo}`}>{icon}</div>
        <div>
          <p className="text-sm font-bold text-neutral-900">{title}</p>
          <p className="text-[11px] text-neutral-400">{note}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

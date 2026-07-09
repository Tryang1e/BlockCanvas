"use client";

import { useState, type ReactNode } from "react";
import {
  Loader2, Save, CheckCircle2, ShieldAlert, Coins, TrendingUp, TrendingDown, Users,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Download,
} from "lucide-react";
import { saveEconomyConfig, exportCoinLedger, type EconomyStats, type EconomySourceRow, type EconomyUserRow } from "@/app/actions/economy";
import type { EconomyConfig } from "@/lib/economyConfig";

const GROUPS: { group: string; note?: string; items: { key: keyof EconomyConfig; label: string; unit: string }[] }[] = [
  {
    group: "코인 보상 (획득)",
    note: "다운로드·반응은 2트랙: 기본(개당, step=1) + 보너스(N개 누적). 예) 반응 20개 = 기본 200 + 보너스 200. 다운로드 20회 = 기본 100 + 보너스 60.",
    items: [
      { key: "downloadStep", label: "다운로드 기본 지급 간격 (1=매 다운로드)", unit: "회" },
      { key: "downloadCoin", label: "다운로드 기본 코인 (개당)", unit: "코인" },
      { key: "downloadBonusStep", label: "다운로드 보너스 간격 (고유 다운로드 N회 누적마다)", unit: "회" },
      { key: "downloadBonusCoin", label: "다운로드 보너스 코인 (추가)", unit: "코인" },
      { key: "reactionStep", label: "이모지 👍 기본 지급 간격 (1=매 반응)", unit: "개" },
      { key: "reactionCoin", label: "이모지 기본 코인 (개당)", unit: "코인" },
      { key: "reactionBonusStep", label: "이모지 보너스 간격 (고유 반응 N개 누적마다)", unit: "개" },
      { key: "reactionBonusCoin", label: "이모지 보너스 코인 (추가)", unit: "코인" },
      { key: "blockStep", label: "블록 순설치 마일스톤 (N개마다) · 플러그인 필요", unit: "개" },
      { key: "blockCoin", label: "블록 보상 코인 · 플러그인 필요", unit: "코인" },
      { key: "playtimeStep", label: "누적접속 마일스톤 (N분마다) · 플러그인 필요", unit: "분" },
      { key: "playtimeCoin", label: "접속 보상 코인 · 플러그인 필요", unit: "코인" },
      { key: "signupBonusCoin", label: "가입 인증 완료 보너스 (디스코드+마크+웹가입 3종 최초 완료 시 1회)", unit: "코인" },
      { key: "forumWeeklyCoin", label: "전시관 주간 최다 반응 게시물 보상 (매주 1개 · 0=비활성)", unit: "코인" },
    ],
  },
  {
    group: "상점 가격 (소비)",
    note: "변경 즉시 웹·인게임 상점 GUI에 함께 반영됩니다. (플롯 크기별 분양가는 플러그인 config.yml)",
    items: [
      { key: "subscriptionPrice", label: "구독 가격", unit: "코인" },
      { key: "subscriptionDays", label: "구독 기간", unit: "일" },
      { key: "nickPrice", label: "닉네임 변경권 가격", unit: "코인" },
      { key: "plotSlotBase", label: "플롯 확장 구매권 첫 가격 (구매마다 2배)", unit: "코인" },
      { key: "plotSlotMax", label: "플롯 확장 구매권 1인당 최대 개수 (0=무제한)", unit: "개" },
    ],
  },
  {
    group: "블루프린트 유료 판매",
    note: "유료 블루프린트 고정가 판매의 수수료(소각). 구매자는 판매가+구매수수료를 내고, 판매자는 판매가−판매수수료를 받으며 수수료 합은 소각됩니다.",
    items: [
      { key: "blueprintBuyerFeePercent", label: "구매 수수료 (구매자가 가격에 더해 지불·소각)", unit: "%" },
      { key: "blueprintSellerFeePercent", label: "판매 수수료 (판매자 수령액에서 차감·소각)", unit: "%" },
      { key: "blueprintPriceMax", label: "판매가 상한", unit: "코인" },
    ],
  },
  {
    group: "인플레이션 통제",
    note: "유입(보상) 과다를 억제하는 조절값. 0 = 무제한.",
    items: [
      { key: "dailyEarnCap", label: "유저 1인당 24시간 유입 상한 (0=무제한) · 초과분 미지급", unit: "코인" },
    ],
  },
  {
    group: "기타",
    items: [{ key: "reportAutohide", label: "갤러리 신고 자동숨김 임계", unit: "건" }],
  },
];

const SOURCE_LABEL: Record<string, string> = {
  // 유입(faucet)
  blueprint_download: "블루프린트 다운로드",
  blueprint_download_bonus: "다운로드 누적 보너스",
  blueprint_reaction: "이모지 반응",
  blueprint_reaction_bonus: "이모지 누적 보너스",
  forum_reaction: "전시관 반응",
  forum_reaction_bonus: "전시관 반응 보너스",
  forum_weekly: "전시관 주간 우수작",
  block_place: "블록 설치",
  playtime: "누적접속",
  admin_grant: "관리자 지급",
  signup_verification: "가입 인증 보너스",
  // 유출(sink)
  shop_subscription: "구독 결제",
  shop_nickname: "닉네임 변경",
  shop_item: "상점 구매",
  shop_plot_slot: "플롯 확장권",
  plot_claim: "플롯 분양",
  blueprint_sale_fee: "블루프린트 판매 수수료(소각)",
  // 이체(transfer)
  auction_buy: "경매 낙찰",
  coin_transfer: "유저 송금",
  blueprint_sale: "블루프린트 판매",
};

function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function signed(n: number, digits = 0): string {
  return (n > 0 ? "+" : "") + fmt(n, digits); // 0 은 부호 없이, 음수는 fmt 가 '-' 부여
}

function StatCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: "emerald" | "rose" | "neutral" }) {
  const valueColor = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-neutral-900";
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-neutral-500">{icon} {label}</div>
      <div className={`text-2xl font-black mt-1 tabular-nums ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SourceBars({ title, rows }: { title: string; rows: EconomySourceRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className="text-[12px] font-bold text-neutral-500 mb-2">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">최근 24시간 내역이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const pct = (r.amount / max) * 100;
            const color = r.direction === "in" ? "bg-emerald-500" : r.direction === "transfer" ? "bg-amber-500" : "bg-rose-500";
            const label = SOURCE_LABEL[r.source] || r.source;
            return (
              <div key={`${r.source}:${r.direction}`} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-neutral-600 truncate" title={label}>{label}</span>
                <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums text-neutral-700">{fmt(r.amount)} · {r.count}건</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserRanks({ title, rows, tone }: { title: string; rows: EconomyUserRow[]; tone: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className="text-[12px] font-bold text-neutral-500 mb-2">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">최근 24시간 내역이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={(r.profileId ?? "x") + i} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center text-[11px] font-bold text-neutral-400 shrink-0">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-neutral-700 truncate">{r.name}</span>
                {r.uuid && <span className="block text-[10px] text-neutral-400 font-mono truncate" title={r.uuid}>{r.uuid}</span>}
              </span>
              <span className={`shrink-0 tabular-nums font-bold ${color}`}>{fmt(r.amount)}코인</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EconomyClient({ config, stats, canEdit }: { config: EconomyConfig; stats: EconomyStats | null; canEdit: boolean }) {
  const [form, setForm] = useState<EconomyConfig>(config);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exportDays, setExportDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  const set = (k: keyof EconomyConfig, v: string) => setForm((f) => ({ ...f, [k]: v === "" ? 0 : Math.max(0, Math.floor(Number(v) || 0)) }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const r = await saveEconomyConfig(form);
    if (r.success) {
      setForm(r.config);
      setMsg({ type: "success", text: "저장했습니다. 웹·인게임에 즉시 반영됩니다." });
    } else {
      setMsg({ type: "error", text: r.error || "저장에 실패했습니다." });
    }
    setSaving(false);
  };

  const exportCsv = async () => {
    setExporting(true);
    setMsg(null);
    try {
      const r = await exportCoinLedger(exportDays);
      if (r.success) {
        const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = r.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0); // 다음 틱에 해제(다운로드 시작 보장)
      } else {
        setMsg({ type: "error", text: r.error || "내보내기에 실패했습니다." });
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">경제 관리</h1>
        <p className="text-sm text-neutral-500 mt-1">코인 유입·유출·순증감을 추적하고, 보상·가격·인플레이션 통제를 한 곳에서 관리합니다.</p>
      </div>

      {/* 경제순환 분석 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-700">경제순환 분석 (최근 24시간)</h2>
        {stats ? (
          <>
            {/* 핵심: 유입 / 유출 / 순증감 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard
                icon={<ArrowDownToLine size={13} className="text-emerald-500" />}
                label="유입 (발행·보상)"
                value={fmt(stats.flow24.in)}
                tone="emerald"
                sub={`7일 ${fmt(stats.flow7d.in)} · 누적 ${fmt(stats.flowAll.in)}`}
              />
              <StatCard
                icon={<ArrowUpFromLine size={13} className="text-rose-500" />}
                label="유출 (소각·상점)"
                value={fmt(stats.flow24.out)}
                tone="rose"
                sub={`7일 ${fmt(stats.flow7d.out)} · 누적 ${fmt(stats.flowAll.out)}`}
              />
              <StatCard
                icon={stats.flow24.net < 0 ? <TrendingDown size={13} className="text-rose-500" /> : <TrendingUp size={13} className={stats.flow24.net > 0 ? "text-emerald-500" : "text-neutral-400"} />}
                label="순통화량 증감 (유입−유출)"
                value={signed(stats.flow24.net)}
                tone={stats.flow24.net > 0 ? "emerald" : stats.flow24.net < 0 ? "rose" : "neutral"}
                sub={`7일 순증감 ${signed(stats.flow7d.net)}`}
              />
            </div>

            {/* 보조 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<TrendingUp size={13} />} label="시간당 유입 (24h)" value={fmt(stats.perHourIn24, 1)} sub={`전체 평균 ${fmt(stats.perHourInAll, 1)}/h`} />
              <StatCard icon={<Users size={13} />} label="유저당 평균 유입" value={fmt(stats.avgPerEarner24, 1)} sub={`${fmt(stats.earners24)}명 · ${fmt(stats.inflowAwards24)}건`} />
              <StatCard icon={<ArrowLeftRight size={13} />} label="유저 간 이체량 (24h)" value={fmt(stats.flow24.transfer)} sub={`회전량 · 순통화량 불변`} />
              <StatCard icon={<Coins size={13} />} label="전체 순통화량" value={signed(stats.flowAll.net)} sub={`누적 유입 ${fmt(stats.flowAll.in)} · 유출 ${fmt(stats.flowAll.out)}`} />
            </div>

            {/* 소스별 유입/유출 */}
            <div className="grid md:grid-cols-2 gap-3">
              <SourceBars title="유입 소스별 (최근 24h)" rows={stats.bySourceIn} />
              <SourceBars title="유출·이체 소스별 (최근 24h)" rows={stats.bySourceOut} />
            </div>

            {/* 유저별 랭킹 */}
            <div className="grid md:grid-cols-2 gap-3">
              <UserRanks title="유입 상위 유저 (24h)" rows={stats.topEarners24} tone="emerald" />
              <UserRanks title="유출·이체 상위 유저 (24h)" rows={stats.topSpenders24} tone="rose" />
            </div>

            {/* 원장 CSV 내보내기 */}
            <div className="flex items-center justify-end gap-2">
              <span className="text-[12px] text-neutral-500">원장 내보내기</span>
              <select
                value={exportDays}
                onChange={(e) => setExportDays(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:border-black focus:outline-none"
              >
                <option value={7}>최근 7일</option>
                <option value={30}>최근 30일</option>
                <option value={90}>최근 90일</option>
                <option value={365}>최근 1년</option>
              </select>
              <button
                onClick={exportCsv}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-sm font-bold text-neutral-800 disabled:opacity-50"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} CSV
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-400 bg-white border border-neutral-200 rounded-2xl p-4">분석 데이터를 불러오지 못했습니다.</p>
        )}
      </section>

      {/* 설정 편집 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-700">보상·가격·통제 설정</h2>
        {!canEdit && (
          <div className="p-3 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
            보기 전용입니다. 값 변경은 최종 관리자만 가능합니다.
          </div>
        )}
        {msg && (
          <div className={`p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
            {msg.type === "success" ? <CheckCircle2 size={15} className="mt-px" /> : <ShieldAlert size={15} className="mt-px" />}
            <span>{msg.text}</span>
          </div>
        )}
        {GROUPS.map((g) => (
          <div key={g.group} className="bg-white rounded-2xl border border-neutral-200 p-4">
            <div className="text-[13px] font-bold text-neutral-800">{g.group}</div>
            {g.note && <div className="text-[11px] text-neutral-400 mt-0.5 mb-2">{g.note}</div>}
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 mt-2">
              {g.items.map((it) => (
                <label key={it.key} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-neutral-700">{it.label}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={form[it.key]}
                      disabled={!canEdit}
                      onChange={(e) => set(it.key, e.target.value)}
                      className="w-28 px-2.5 py-1.5 border border-neutral-300 rounded-lg text-sm text-neutral-900 text-right tabular-nums focus:border-black focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                    />
                    <span className="text-[11px] text-neutral-400 w-6">{it.unit}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {canEdit && (
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 저장
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  Users,
  UserPlus,
  Globe,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Map as MapIcon,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  getMyPlots,
  getInvitedPlots,
  syncMyPlots,
  trustPlotMemberAction,
  untrustPlotMemberAction,
  transferPlotOwnerAction,
  getMyPendingTransfers,
} from "@/app/actions/minecraft";
import { McMemberChip } from "./McAvatar";

const MAP_URL = (process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "").replace(/\/$/, "");
const MAP_NAME = process.env.NEXT_PUBLIC_MINECRAFT_MAP_NAME || "flat";
// 페이지 로드마다 새 값 → 브라우저가 캐시한 예전(base 없는) 프록시 응답을 무시하고 항상 새로 받게 함.
const MAP_CB = Date.now();
function buildMapSrc(world: string, x: number, z: number) {
  // 슬래시 없이(`?` 바로) — /dynmap-proxy 같은 경로에서 Next 의 trailing-slash 308 리다이렉트(+캐시) 회피.
  // _cb: 캐시 버스터 — base 없는 예전 응답이 캐시돼 자산이 루트(/js…)로 404 나던 문제 회피.
  return `${MAP_URL}?worldname=${encodeURIComponent(world)}&mapname=${encodeURIComponent(MAP_NAME)}&zoom=6&x=${x}&y=64&z=${z}&_cb=${MAP_CB}`;
}

interface PlotMember {
  uuid?: string;
  name: string;
}
interface Plot {
  id: string;
  world: string;
  alias: string | null;
  centerX: number | null;
  centerZ: number | null;
  members: PlotMember[];
  trusted: PlotMember[];
  owned: boolean;
  ownerName?: string;
}
interface PendingTransfer {
  id: string;
  plot_id: string;
  target_name: string;
  status: string;
}

function normalize(arr: unknown): PlotMember[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => {
    if (typeof m === "string") return { uuid: m, name: m };
    const o = (m ?? {}) as { uuid?: string; name?: string };
    return { uuid: o.uuid, name: o.name ?? o.uuid ?? "" };
  });
}

export default function PlotsView({ focusPlotId }: { focusPlotId?: string | null }) {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(focusPlotId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [trustInput, setTrustInput] = useState("");
  const [transferInput, setTransferInput] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [mineRes, invRes, pendRes] = await Promise.all([getMyPlots(), getInvitedPlots(), getMyPendingTransfers()]);
    const mine: Plot[] = mineRes.success
      ? (mineRes.plots as Record<string, unknown>[]).map((p) => ({
          id: String(p.id),
          world: String(p.world ?? "world"),
          alias: (p.alias as string) ?? null,
          centerX: (p.centerX as number) ?? null,
          centerZ: (p.centerZ as number) ?? null,
          members: normalize(p.members),
          trusted: normalize(p.trusted),
          owned: true,
        }))
      : [];
    const inv: Plot[] = invRes.success
      ? (invRes.plots as Record<string, unknown>[]).map((p) => ({
          id: String(p.id),
          world: String(p.world ?? "world"),
          alias: (p.alias as string) ?? null,
          centerX: (p.centerX as number) ?? null,
          centerZ: (p.centerZ as number) ?? null,
          members: normalize(p.members),
          trusted: normalize(p.trusted),
          owned: false,
          ownerName: (p.ownerName as string) ?? "?",
        }))
      : [];
    const all = [...mine, ...inv];
    setPlots(all);
    if (pendRes.success) setPending((pendRes.transfers as PendingTransfer[]) || []);
    setSelectedId((cur) => (cur && all.some((p) => p.id === cur) ? cur : all[0]?.id ?? null));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (focusPlotId) setSelectedId(focusPlotId);
  }, [focusPlotId]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    const res = await syncMyPlots();
    if (res.success) {
      setMessage({ type: "success", text: `플롯 ${res.count}개를 동기화했습니다.` });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "동기화에 실패했습니다. (서버 연결 확인)" });
    }
    setSyncing(false);
  };

  const handleTrust = async (plotId: string) => {
    const name = trustInput.trim();
    if (!name) return;
    setBusy(plotId);
    setMessage(null);
    const res = await trustPlotMemberAction(plotId, name);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "초대했습니다." });
      setTrustInput("");
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "초대에 실패했습니다." });
    }
    setBusy(null);
  };

  const handleUntrust = async (plotId: string, member: PlotMember) => {
    setBusy(plotId);
    setMessage(null);
    const res = await untrustPlotMemberAction(plotId, member.name);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "제외했습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "제외에 실패했습니다." });
    }
    setBusy(null);
  };

  const handleTransfer = async (plotId: string) => {
    const name = transferInput.trim();
    if (!name) return;
    if (!confirm(`플롯 ${plotId} 의 소유권을 ${name} 님에게 양도 신청합니다.\n대상이 인게임에서 /웹연동 수락 을 입력해야 완료됩니다. 계속할까요?`)) return;
    setBusy(plotId);
    setMessage(null);
    const res = await transferPlotOwnerAction(plotId, name);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "양도 신청을 전송했습니다." });
      setTransferInput("");
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "양도 신청에 실패했습니다." });
    }
    setBusy(null);
  };

  const selected = plots.find((p) => p.id === selectedId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-400 text-sm gap-2">
        <Loader2 size={18} className="animate-spin" /> 플롯 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 space-y-6">
      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={14} className="mt-px" /> : <ShieldAlert size={14} className="mt-px" />}
          <span>{message.text}</span>
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-2">
            <Clock size={14} /> 대기 중인 소유권 양도
          </div>
          <ul className="space-y-1">
            {pending.map((t) => (
              <li key={t.id} className="text-[11px] text-amber-900/80 font-medium flex items-center gap-1.5 flex-wrap">
                <span className="font-mono px-1.5 py-0.5 bg-amber-100 rounded">{t.plot_id}</span>→{" "}
                <span className="font-bold">{t.target_name}</span>
                <span className="text-amber-600">(인게임 수락 대기)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 상단: 내 플롯들 카드 + 플롯 정보 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* 내 플롯들 (카드) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
              <Layers size={16} className="text-neutral-500" /> 내 플롯들
            </h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 동기화
            </button>
          </div>
          {plots.length === 0 ? (
            <div className="text-center p-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl">
              <Globe className="mx-auto text-neutral-300 mb-2" size={28} />
              <p className="text-sm text-neutral-500">표시할 영토가 없습니다.</p>
              <p className="text-xs text-neutral-400 mt-1">인게임에서 영토를 소유하고 있다면 동기화를 눌러주세요.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {plots.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    selectedId === p.id ? "border-black bg-neutral-50" : "border-neutral-200 hover:border-neutral-400 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-neutral-900 truncate">{p.alias || `영토 ${p.id}`}</span>
                    {!p.owned && <span className="text-[9px] font-bold px-1 py-px rounded bg-sky-50 text-sky-700 shrink-0">초대</span>}
                  </div>
                  <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Globe size={11} /> {p.world}
                    <span className="font-mono ml-1">{p.id}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 플롯 정보 + 초대된 리스트 */}
        <div>
          <h2 className="text-sm font-bold text-neutral-900 mb-3">플롯 정보</h2>
          {!selected ? (
            <div className="text-xs text-neutral-400 p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
              플롯을 선택하세요.
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div>
                <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                  {selected.alias || `영토 ${selected.id}`}
                  {!selected.owned && <span className="text-[9px] font-bold px-1 py-px rounded bg-sky-50 text-sky-700">초대됨</span>}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {selected.world} · <span className="font-mono">{selected.id}</span>
                  {!selected.owned && selected.ownerName && <> · 소유자 {selected.ownerName}</>}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 mb-1.5">
                  <Users size={12} /> 초대된 멤버 (Trusted)
                </div>
                {selected.trusted.length === 0 ? (
                  <p className="text-[11px] text-neutral-400">없음</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.trusted.map((m) => (
                      <McMemberChip
                        key={m.uuid || m.name}
                        id={m.uuid}
                        name={m.name}
                        onRemove={selected.owned ? () => handleUntrust(selected.id, m) : undefined}
                        disabled={busy === selected.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {selected.owned && (
                <>
                  <div className="flex gap-1.5">
                    <input
                      value={trustInput}
                      onChange={(e) => setTrustInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTrust(selected.id);
                      }}
                      placeholder="초대할 닉네임"
                      className="flex-1 border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                    />
                    <button
                      onClick={() => handleTrust(selected.id)}
                      disabled={busy === selected.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                    >
                      <UserPlus size={12} /> 초대
                    </button>
                  </div>
                  <div className="flex gap-1.5 pt-2 border-t border-neutral-100">
                    <input
                      value={transferInput}
                      onChange={(e) => setTransferInput(e.target.value)}
                      placeholder="양도 대상 닉네임"
                      className="flex-1 border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                    />
                    <button
                      onClick={() => handleTransfer(selected.id)}
                      disabled={busy === selected.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-300 hover:border-black text-neutral-700 text-[11px] font-bold rounded-lg disabled:opacity-50"
                    >
                      <ArrowUpRight size={12} /> 양도
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단: DYNMAP */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Dynmap</div>
        {selected && MAP_URL && selected.centerX !== null && selected.centerZ !== null ? (
          <div className="rounded-2xl overflow-hidden border border-neutral-200">
            <iframe
              title={`Dynmap ${selected.id}`}
              src={buildMapSrc(selected.world, selected.centerX, selected.centerZ)}
              className="w-full h-[420px]"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 h-72 flex flex-col items-center justify-center text-neutral-400">
            <MapIcon size={28} className="mb-2" />
            <p className="text-xs">
              {!MAP_URL ? "Dynmap 미설정 (NEXT_PUBLIC_MINECRAFT_MAP_URL)" : "플롯을 선택하면 지도가 표시됩니다."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

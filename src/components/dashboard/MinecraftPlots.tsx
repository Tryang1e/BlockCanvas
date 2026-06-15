"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  Users,
  UserPlus,
  X,
  ArrowUpRight,
  Clock,
  Layers,
  Globe,
  CheckCircle2,
  ShieldAlert,
  Map as MapIcon,
} from "lucide-react";
import {
  getMyPlots,
  syncMyPlots,
  trustPlotMemberAction,
  untrustPlotMemberAction,
  transferPlotOwnerAction,
  getMyPendingTransfers,
} from "@/app/actions/minecraft";

// Dynmap 임베드 설정(빌드 시 인라인). 미설정 시 지도 버튼이 숨겨진다.
const MAP_URL = (process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "").replace(/\/$/, "");
const MAP_NAME = process.env.NEXT_PUBLIC_MINECRAFT_MAP_NAME || "flat";
function buildMapSrc(world: string, x: number, z: number) {
  return `${MAP_URL}/?worldname=${encodeURIComponent(world)}&mapname=${encodeURIComponent(MAP_NAME)}&zoom=6&x=${x}&y=64&z=${z}`;
}

interface PlotMember {
  uuid: string;
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
}
interface PendingTransfer {
  id: string;
  plot_id: string;
  target_name: string;
  status: string;
}

export default function MinecraftPlots() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyPlot, setBusyPlot] = useState<string | null>(null);
  const [trustInputs, setTrustInputs] = useState<Record<string, string>>({});
  const [transferInputs, setTransferInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [mapOpen, setMapOpen] = useState<Record<string, boolean>>({});

  const loadAll = useCallback(async () => {
    const [plotRes, pendRes] = await Promise.all([getMyPlots(), getMyPendingTransfers()]);
    if (plotRes.success) setPlots((plotRes.plots as Plot[]) || []);
    if (pendRes.success) setPending((pendRes.transfers as PendingTransfer[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    const res = await syncMyPlots();
    if (res.success) {
      setMessage({ type: "success", text: `플롯 ${res.count}개를 동기화했습니다.` });
      await loadAll();
    } else {
      setMessage({ type: "error", text: res.error || "동기화에 실패했습니다. (마인크래프트 서버 연결을 확인하세요)" });
    }
    setSyncing(false);
  };

  const handleTrust = async (plotId: string) => {
    const name = (trustInputs[plotId] || "").trim();
    if (!name) return;
    setBusyPlot(plotId);
    setMessage(null);
    const res = await trustPlotMemberAction(plotId, name);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "초대했습니다." });
      setTrustInputs((p) => ({ ...p, [plotId]: "" }));
      await loadAll();
    } else {
      setMessage({ type: "error", text: res.error || "초대에 실패했습니다." });
    }
    setBusyPlot(null);
  };

  const handleUntrust = async (plotId: string, member: PlotMember) => {
    setBusyPlot(plotId);
    setMessage(null);
    const res = await untrustPlotMemberAction(plotId, member.name);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "제외했습니다." });
      await loadAll();
    } else {
      setMessage({ type: "error", text: res.error || "제외에 실패했습니다." });
    }
    setBusyPlot(null);
  };

  const handleTransfer = async (plotId: string) => {
    const name = (transferInputs[plotId] || "").trim();
    if (!name) return;
    if (
      !confirm(
        `플롯 ${plotId} 의 소유권을 ${name} 님에게 양도 신청합니다.\n대상 유저가 인게임에서 /웹연동 수락 을 입력해야 최종 완료됩니다. 계속할까요?`
      )
    ) {
      return;
    }
    setBusyPlot(plotId);
    setMessage(null);
    const res = await transferPlotOwnerAction(plotId, name);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "양도 신청을 전송했습니다." });
      setTransferInputs((p) => ({ ...p, [plotId]: "" }));
      await loadAll();
    } else {
      setMessage({ type: "error", text: res.error || "양도 신청에 실패했습니다." });
    }
    setBusyPlot(null);
  };

  return (
    <section className="border-t border-neutral-100 pt-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-neutral-900">
            <Layers size={20} className="text-neutral-700" />
            마인크래프트 영토(Plot) 관리
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            인게임 영토의 멤버 권한과 소유권을 웹에서 직접 관리합니다. 최신 상태를 보려면 동기화를 눌러주세요.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
        >
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {syncing ? "동기화 중..." : "동기화"}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium mb-6 flex items-start gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={16} className="mt-0.5" /> : <ShieldAlert size={16} className="mt-0.5" />}
          <span>{message.text}</span>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6 bg-amber-50/60 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-3">
            <Clock size={16} /> 대기 중인 소유권 양도 신청
          </div>
          <ul className="space-y-2">
            {pending.map((t) => (
              <li key={t.id} className="text-xs text-amber-900/80 font-medium flex items-center gap-2 flex-wrap">
                <span className="font-mono px-1.5 py-0.5 bg-amber-100 rounded">{t.plot_id}</span>
                → <span className="font-bold">{t.target_name}</span>
                <span className="text-amber-600">(인게임 /웹연동 수락 대기)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8 bg-neutral-50 border border-neutral-100 rounded-xl">
          <Loader2 className="animate-spin text-neutral-400 mr-2" size={20} />
          <span className="text-neutral-500 font-medium text-sm">플롯 정보를 불러오는 중...</span>
        </div>
      ) : plots.length === 0 ? (
        <div className="text-center p-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl">
          <Globe className="mx-auto text-neutral-300 mb-3" size={32} />
          <p className="text-sm text-neutral-500 font-medium">표시할 영토가 없습니다.</p>
          <p className="text-xs text-neutral-400 mt-1">
            인게임에서 영토를 소유하고 있다면 <b>동기화</b>를 눌러 불러오세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plots.map((plot) => (
            <div key={plot.id} className="border border-neutral-200 rounded-2xl p-5 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-900">{plot.alias || `영토 ${plot.id}`}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded">{plot.id}</span>
                </div>
                <div className="flex items-center gap-3">
                  {MAP_URL && plot.centerX !== null && plot.centerZ !== null && (
                    <button
                      onClick={() => setMapOpen((m) => ({ ...m, [plot.id]: !m[plot.id] }))}
                      className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      <MapIcon size={13} /> {mapOpen[plot.id] ? "지도 닫기" : "지도 보기"}
                    </button>
                  )}
                  <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                    <Globe size={12} /> {plot.world}
                  </span>
                </div>
              </div>

              {MAP_URL && mapOpen[plot.id] && plot.centerX !== null && plot.centerZ !== null && (
                <div className="mb-4 rounded-xl overflow-hidden border border-neutral-200">
                  <iframe
                    title={`Dynmap ${plot.id}`}
                    src={buildMapSrc(plot.world, plot.centerX, plot.centerZ)}
                    className="w-full h-72"
                    loading="lazy"
                  />
                  <div className="px-3 py-1.5 bg-neutral-50 text-[10px] text-neutral-400 font-medium border-t border-neutral-100">
                    Dynmap 실시간 뷰 · 좌표 {plot.centerX}, {plot.centerZ}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 mb-2">
                  <Users size={14} /> 초대된 멤버 (Trusted)
                </div>
                {plot.trusted.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium mb-2">아직 초대된 멤버가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {plot.trusted.map((m) => (
                      <span
                        key={m.uuid || m.name}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-neutral-100 rounded-full text-xs font-medium text-neutral-700"
                      >
                        {m.name}
                        <button
                          onClick={() => handleUntrust(plot.id, m)}
                          disabled={busyPlot === plot.id}
                          className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors disabled:opacity-40"
                          title="제외"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={trustInputs[plot.id] || ""}
                    onChange={(e) => setTrustInputs((p) => ({ ...p, [plot.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTrust(plot.id);
                    }}
                    placeholder="초대할 닉네임 입력"
                    className="flex-1 border border-neutral-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black transition-all"
                  />
                  <button
                    onClick={() => handleTrust(plot.id)}
                    disabled={busyPlot === plot.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    <UserPlus size={14} /> 초대
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 mb-2">
                  <ArrowUpRight size={14} /> 소유권 양도 (2단계 수락)
                </div>
                <div className="flex gap-2">
                  <input
                    value={transferInputs[plot.id] || ""}
                    onChange={(e) => setTransferInputs((p) => ({ ...p, [plot.id]: e.target.value }))}
                    placeholder="양도할 대상 닉네임"
                    className="flex-1 border border-neutral-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black transition-all"
                  />
                  <button
                    onClick={() => handleTransfer(plot.id)}
                    disabled={busyPlot === plot.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-neutral-300 hover:border-neutral-900 text-neutral-700 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    양도 신청
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

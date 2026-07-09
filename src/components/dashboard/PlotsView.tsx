"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ArrowDownLeft,
  Check,
  X,
  ShoppingCart,
  Trash2,
  Tag,
  LogOut,
} from "lucide-react";
import {
  getMyPlots,
  getInvitedPlots,
  syncMyPlots,
  trustPlotMemberAction,
  untrustPlotMemberAction,
  transferPlotOwnerAction,
  getMyPendingTransfers,
  getIncomingTransfers,
  acceptIncomingTransferAction,
  rejectIncomingTransferAction,
  claimPlotAction,
  deletePlotAction,
  leavePlotAction,
  listAuctionAction,
  cancelAuctionAction,
  buyAuctionAction,
} from "@/app/actions/minecraft";
import { McMemberChip } from "./McAvatar";
import DynmapPlayerContextMenu, { type DynmapPlayerAction } from "./DynmapPlayerContextMenu";
import DynmapPlotContextMenu from "./DynmapPlotContextMenu";

const MAP_URL = (process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "").replace(/\/$/, "");
const MAP_NAME = process.env.NEXT_PUBLIC_MINECRAFT_MAP_NAME || "flat";
// 마켓플레이스(빈 플롯) 지도 — 플롯 월드 전경(스폰 0,0 기준). 월드/맵 이름은 환경변수로 조정 가능.
const PLOT_WORLD = process.env.NEXT_PUBLIC_MINECRAFT_PLOT_WORLD || "plotworld";
const PLOT_MAP = process.env.NEXT_PUBLIC_MINECRAFT_PLOT_MAP || MAP_NAME;
// 페이지 로드마다 새 값 → 브라우저가 캐시한 예전(base 없는) 프록시 응답을 무시하고 항상 새로 받게 함.
const MAP_CB = Date.now();
function buildPlotWorldMapSrc() {
  return `${MAP_URL}?worldname=${encodeURIComponent(PLOT_WORLD)}&mapname=${encodeURIComponent(PLOT_MAP)}&zoom=5&x=0&y=64&z=0&_cb=${MAP_CB}`;
}

interface PlotMember {
  uuid?: string;
  name: string;
}
interface Plot {
  id: string;
  world: string;
  uid: string; // "<world>:<id>" — 같은 plotId 가 여러 플롯월드에 있어 선택/키는 이 복합값으로 식별
  alias: string | null;
  centerX: number | null;
  centerZ: number | null;
  members: PlotMember[];
  trusted: PlotMember[];
  owned: boolean;
  ownerName?: string;
  auctionPrice?: number | null; // 경매중이면 가격(코인), 아니면 null
}
interface PendingTransfer {
  id: string;
  plot_id: string;
  target_name: string;
  status: string;
}
interface IncomingTransfer {
  id: string;
  plot_id: string;
  from_name: string;
}

/** 플롯 식별 복합키 — 같은 plotId 가 여러 플롯월드(plotworld/plot_1000…)에 있어도 충돌하지 않게 world 로 네임스페이스. */
function plotUid(world: string, id: string): string {
  return `${world}:${id}`;
}

function normalize(arr: unknown): PlotMember[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => {
    if (typeof m === "string") return { uuid: m, name: m };
    const o = (m ?? {}) as { uuid?: string; name?: string };
    return { uuid: o.uuid, name: o.name ?? o.uuid ?? "" };
  });
}

export default function PlotsView({ focusPlotId, onClaimed, viewAs, readOnly = false }: { focusPlotId?: string | null; onClaimed?: () => void; viewAs?: string; readOnly?: boolean }) {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [incoming, setIncoming] = useState<IncomingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(focusPlotId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [trustInput, setTrustInput] = useState("");
  const [transferInput, setTransferInput] = useState("");
  const [auctionInput, setAuctionInput] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [marketCount, setMarketCount] = useState<number | null>(null); // 지도에 표시된 구매 가능한 빈 플롯 수
  const mapRef = useRef<HTMLIFrameElement | null>(null);

  const load = useCallback(async () => {
    const [mineRes, invRes, pendRes, inRes] = await Promise.all([
      getMyPlots(viewAs),
      getInvitedPlots(viewAs),
      getMyPendingTransfers(viewAs),
      getIncomingTransfers(viewAs),
    ]);
    const mine: Plot[] = mineRes.success
      ? (mineRes.plots as Record<string, unknown>[]).map((p) => ({
          id: String(p.id),
          world: String(p.world ?? "world"),
          uid: plotUid(String(p.world ?? "world"), String(p.id)),
          alias: (p.alias as string) ?? null,
          centerX: (p.centerX as number) ?? null,
          centerZ: (p.centerZ as number) ?? null,
          members: normalize(p.members),
          trusted: normalize(p.trusted),
          owned: true,
          auctionPrice: (p.auctionPrice as number) ?? null,
        }))
      : [];
    const inv: Plot[] = invRes.success
      ? (invRes.plots as Record<string, unknown>[]).map((p) => ({
          id: String(p.id),
          world: String(p.world ?? "world"),
          uid: plotUid(String(p.world ?? "world"), String(p.id)),
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
    if (inRes.success) setIncoming((inRes.transfers as IncomingTransfer[]) || []);
    setSelectedUid((cur) => (cur && all.some((p) => p.uid === cur) ? cur : all[0]?.uid ?? null));
    setLoading(false);
  }, [viewAs]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (focusPlotId) setSelectedUid(focusPlotId);
  }, [focusPlotId]);

  // 마켓 지도(주입 스크립트)가 보내는 "구매 가능한 플롯 수"를 받아 헤더에 표시.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __bc?: string; count?: number } | null;
      if (!d || d.__bc !== "dynmap-market-count" || typeof d.count !== "number") return;
      setMarketCount(d.count);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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

  const handleTrust = async (plotId: string, world: string) => {
    const name = trustInput.trim();
    if (!name) return;
    setBusy(plotId);
    setMessage(null);
    const res = await trustPlotMemberAction(plotId, name, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "초대했습니다." });
      setTrustInput("");
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "초대에 실패했습니다." });
    }
    setBusy(null);
  };

  const handleUntrust = async (plotId: string, member: PlotMember, world: string) => {
    setBusy(plotId);
    setMessage(null);
    const res = await untrustPlotMemberAction(plotId, member.name, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "제외했습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "제외에 실패했습니다." });
    }
    setBusy(null);
  };

  // Dynmap 우클릭 메뉴용: 닉네임을 직접 받아 초대/추방
  const trustByName = async (plotId: string, name: string, world: string) => {
    setBusy(plotId);
    setMessage(null);
    const res = await trustPlotMemberAction(plotId, name, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || `${name} 님을 초대했습니다.` });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "초대에 실패했습니다." });
    }
    setBusy(null);
  };
  const untrustByName = async (plotId: string, name: string, world: string) => {
    setBusy(plotId);
    setMessage(null);
    const res = await untrustPlotMemberAction(plotId, name, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || `${name} 님을 제외했습니다.` });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "제외에 실패했습니다." });
    }
    setBusy(null);
  };

  const handleTransfer = async (plotId: string, world: string) => {
    const name = transferInput.trim();
    if (!name) return;
    if (!confirm(`플롯 ${plotId} 의 소유권을 ${name} 님에게 양도 신청합니다.\n대상이 /플롯 수락(인게임) 또는 웹 대시보드에서 수락해야 완료됩니다. 계속할까요?`)) return;
    setBusy(plotId);
    setMessage(null);
    const res = await transferPlotOwnerAction(plotId, name, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "양도 신청을 전송했습니다." });
      setTransferInput("");
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "양도 신청에 실패했습니다." });
    }
    setBusy(null);
  };

  // 나에게 들어온 양도를 웹에서 직접 수락 — 성공 시 새로 받은 플롯이 내 목록에 나타난다.
  const handleAcceptIncoming = async (transferId: string) => {
    setBusy(transferId);
    setMessage(null);
    const res = await acceptIncomingTransferAction(transferId);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "양도를 수락했습니다." });
      onClaimed?.(); // 보유 수 변동 → 상단 헤더 갱신
    } else {
      setMessage({ type: "error", text: res.error || "수락에 실패했습니다." });
    }
    await load(); // 성공/실패(만료·취소) 모두 목록 갱신
    setBusy(null);
  };

  // 나에게 들어온 양도를 웹에서 거절.
  const handleRejectIncoming = async (transferId: string) => {
    if (!confirm("이 소유권 양도를 거절하시겠습니까?")) return;
    setBusy(transferId);
    setMessage(null);
    const res = await rejectIncomingTransferAction(transferId);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "양도를 거절했습니다." });
    } else {
      setMessage({ type: "error", text: res.error || "거절에 실패했습니다." });
    }
    await load();
    setBusy(null);
  };

  // 마켓플레이스: Dynmap 빈 플롯 마커 → 우클릭/구매버튼 → claim. 성공 시 목록 새로고침.
  const handleClaim = async (plotId: string, world: string) => {
    setMessage(null);
    const res = await claimPlotAction(plotId, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || `플롯 ${plotId} 을(를) 구매했습니다.` });
      await load();
      setSelectedUid(plotUid(world, plotId)); // 새로 산 플롯을 선택 상태로
      onClaimed?.(); // 상단 헤더의 "구매 가능 N회" 갱신(부모 ServerDashboard)
    } else {
      setMessage({ type: "error", text: res.error || "구매에 실패했습니다." });
    }
    return res;
  };

  // 본인 소유 플롯 삭제(건축 초기화 + 소유권 해제). 초대된 플롯엔 버튼 자체가 노출되지 않음.
  const handleDelete = async (plotId: string, world: string) => {
    if (!confirm(`플롯 ${plotId} 을(를) 삭제하시겠습니까?\n건축물이 초기화되고 소유권이 사라집니다. (되돌릴 수 없음)`)) return;
    setBusy(plotId);
    setMessage(null);
    const res = await deletePlotAction(plotId, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "삭제했습니다." });
      await load();
      onClaimed?.(); // 보유 수 감소 → 헤더 "구매 가능 N회" 갱신
    } else {
      setMessage({ type: "error", text: res.error || "삭제에 실패했습니다." });
    }
    setBusy(null);
  };

  // 초대받은 플롯에서 나가기(본인 trust/member 회수). 소유 플롯엔 노출 안 됨.
  const handleLeave = async (plotId: string, world: string) => {
    if (!confirm(`플롯 ${plotId} 에서 나가시겠습니까?\n이 플롯의 건축 권한이 사라집니다.`)) return;
    setBusy(plotId);
    setMessage(null);
    const res = await leavePlotAction(plotId, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "플롯에서 나갔습니다." });
      setSelectedUid(null);
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "나가기에 실패했습니다." });
    }
    setBusy(null);
  };

  // 경매 등록(본인 소유, 가격) — 성공 시 주황 마커로 전환됨.
  const handleListAuction = async (plotId: string, world: string) => {
    const price = parseInt(auctionInput, 10);
    if (!Number.isFinite(price) || price <= 0) {
      setMessage({ type: "error", text: "경매 가격을 입력하세요 (1 이상)." });
      return;
    }
    setBusy(plotId);
    setMessage(null);
    const res = await listAuctionAction(plotId, price, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "경매 등록했습니다." });
      setAuctionInput("");
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "경매 등록에 실패했습니다." });
    }
    setBusy(null);
  };

  // 경매 취소(본인 소유).
  const handleCancelAuction = async (plotId: string, world: string) => {
    setBusy(plotId);
    setMessage(null);
    const res = await cancelAuctionAction(plotId, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "경매를 취소했습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "경매 취소에 실패했습니다." });
    }
    setBusy(null);
  };

  // 경매 플롯 구매(낙찰) — Dynmap 주황 마커 우클릭 → 코인 이체 + 소유권 이전.
  const handleBuyAuction = async (plotId: string, world: string) => {
    setMessage(null);
    const res = await buyAuctionAction(plotId, world);
    if (res.success) {
      setMessage({ type: "success", text: res.message || `플롯 ${plotId} 을(를) 구매했습니다.` });
      await load();
      setSelectedUid(plotUid(world, plotId));
      onClaimed?.(); // 보유 수/잔액 변동 → 헤더 갱신
    } else {
      setMessage({ type: "error", text: res.error || "구매에 실패했습니다." });
    }
    return res;
  };

  const selected = plots.find((p) => p.uid === selectedUid) || null;
  // 단일 Dynmap: 플롯월드 전경을 1회만 로드하고(고정 src → 리로드 없음), 플롯 선택/지도 로드 시
  // dynmap-goto 메시지로 부드럽게 팬한다.
  const mapSrc = buildPlotWorldMapSrc();

  const sendGoto = useCallback(() => {
    const sel = plots.find((p) => p.uid === selectedUid);
    if (!sel || sel.centerX === null || sel.centerZ === null) return;
    mapRef.current?.contentWindow?.postMessage(
      { __bc: "dynmap-goto", world: sel.world, x: sel.centerX, z: sel.centerZ },
      "*"
    );
  }, [selectedUid, plots]);

  useEffect(() => {
    sendGoto(); // 선택이 바뀌면 지도를 그 플롯으로 팬(주입 스크립트가 dynmap 준비될 때까지 재시도)
  }, [sendGoto]);

  const plotMenuActions: DynmapPlayerAction[] = [];
  if (selected?.owned && !readOnly) {
    const sel = selected;
    plotMenuActions.push({ label: "이 플롯에 초대 (Trust)", run: (p) => trustByName(sel.id, p, sel.world) });
    plotMenuActions.push({ label: "이 플롯에서 추방 (Untrust)", run: (p) => untrustByName(sel.id, p, sel.world), danger: true });
  }

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
                <span className="text-amber-600">(상대 수락 대기)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 나에게 들어온 양도(내가 양수인) — 웹에서 바로 수락/거절. 읽기 전용 조회에서는 숨김(동작 불가). */}
      {!readOnly && incoming.length > 0 && (
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-2">
            <ArrowDownLeft size={14} /> 나에게 들어온 소유권 양도
          </div>
          <ul className="space-y-2">
            {incoming.map((t) => (
              <li
                key={t.id}
                className="text-[11px] text-emerald-900/80 font-medium flex items-center gap-1.5 flex-wrap"
              >
                <span className="font-bold">{t.from_name}</span> 님이{" "}
                <span className="font-mono px-1.5 py-0.5 bg-emerald-100 rounded">{t.plot_id}</span> 플롯을 양도하려 합니다.
                <span className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => handleAcceptIncoming(t.id)}
                    disabled={busy === t.id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                  >
                    <Check size={12} /> 수락
                  </button>
                  <button
                    onClick={() => handleRejectIncoming(t.id)}
                    disabled={busy === t.id}
                    className="flex items-center gap-1 px-2.5 py-1 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold rounded-lg disabled:opacity-50"
                  >
                    <X size={12} /> 거절
                  </button>
                </span>
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
            {!readOnly && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 동기화
              </button>
            )}
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
                  key={p.uid}
                  onClick={() => setSelectedUid(p.uid)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    selectedUid === p.uid ? "border-black bg-neutral-50" : "border-neutral-200 hover:border-neutral-400 bg-white"
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
                        onRemove={selected.owned && !readOnly ? () => handleUntrust(selected.id, m, selected.world) : undefined}
                        disabled={busy === selected.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {selected.owned && !readOnly && (
                <>
                  <div className="flex gap-1.5">
                    <input
                      value={trustInput}
                      onChange={(e) => setTrustInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTrust(selected.id, selected.world);
                      }}
                      placeholder="초대할 닉네임"
                      className="flex-1 border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                    />
                    <button
                      onClick={() => handleTrust(selected.id, selected.world)}
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
                      onClick={() => handleTransfer(selected.id, selected.world)}
                      disabled={busy === selected.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-300 hover:border-black text-neutral-700 text-[11px] font-bold rounded-lg disabled:opacity-50"
                    >
                      <ArrowUpRight size={12} /> 양도
                    </button>
                  </div>
                  {/* 경매 등록/취소 */}
                  {selected.auctionPrice != null ? (
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-neutral-100">
                      <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                        <Tag size={12} /> 경매중 {selected.auctionPrice.toLocaleString()}코인
                      </span>
                      <button
                        onClick={() => handleCancelAuction(selected.id, selected.world)}
                        disabled={busy === selected.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 text-[11px] font-bold rounded-lg disabled:opacity-50"
                      >
                        경매 취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 pt-2 border-t border-neutral-100">
                      <input
                        type="number"
                        min={1}
                        value={auctionInput}
                        onChange={(e) => setAuctionInput(e.target.value)}
                        placeholder="경매 가격(코인)"
                        className="flex-1 border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => handleListAuction(selected.id, selected.world)}
                        disabled={busy === selected.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                      >
                        <Tag size={12} /> 경매 등록
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(selected.id, selected.world)}
                    disabled={busy === selected.id}
                    className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} /> 플롯 삭제
                  </button>
                </>
              )}

              {/* 초대받은 플롯: 나가기(원치 않은 초대 탈퇴) */}
              {!selected.owned && !readOnly && (
                <button
                  onClick={() => handleLeave(selected.id, selected.world)}
                  disabled={busy === selected.id}
                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  <LogOut size={12} /> 이 플롯에서 나가기
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하단: DYNMAP (단일) — 선택 플롯 중심(없으면 플롯월드 전경). 초록 마커=구매 가능한 빈 플롯.
          한 iframe 에 두 컨텍스트 메뉴를 동시에 배선: 플레이어 우클릭=초대/추방, 초록 플롯=구매(claim). */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Dynmap</div>
          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <ShoppingCart size={11} />
            {marketCount !== null ? `구매 가능한 플롯 ${marketCount}곳` : "구매 가능"} · 클릭 → 구매
          </div>
        </div>
        {MAP_URL ? (
          <>
            <div className="rounded-2xl overflow-hidden border border-neutral-200">
              <iframe
                ref={mapRef}
                title="Dynmap"
                src={mapSrc}
                className="w-full h-[460px]"
                loading="lazy"
                onLoad={sendGoto}
              />
            </div>
            <DynmapPlayerContextMenu
              iframeRef={mapRef}
              title={selected ? `플롯 ${selected.alias || selected.id}` : undefined}
              actions={plotMenuActions}
            />
            {!readOnly && <DynmapPlotContextMenu iframeRef={mapRef} onClaim={handleClaim} onBuyAuction={handleBuyAuction} />}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 h-72 flex flex-col items-center justify-center text-neutral-400">
            <MapIcon size={28} className="mb-2" />
            <p className="text-xs">Dynmap 미설정 (NEXT_PUBLIC_MINECRAFT_MAP_URL)</p>
          </div>
        )}
      </div>
    </div>
  );
}

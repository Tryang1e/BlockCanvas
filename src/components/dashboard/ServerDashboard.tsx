"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import {
  Plus,
  HardDrive,
  Globe,
  Users,
  Download,
  Map as MapIcon,
  Clock,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Boxes,
  Calendar,
  Layers,
  Trash2,
  Power,
  PowerOff,
  Archive,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { getMyWorlds, getInvitedWorlds, getWorldLive, setWorldGamerule, setWorldSetting, backupWorld, deleteWorld, restoreWorld, renameWorld, deactivateWorld } from "@/app/actions/worlds";
import { getMyPlots, getInvitedPlots } from "@/app/actions/minecraft";
import { formatBytes } from "@/lib/worldQuota";
import { worldIconSrc } from "@/lib/worldIcons";
import UserSidebar from "@/components/layout/UserSidebar";
import PlotsView from "./PlotsView";
import WorldCreateModal from "./WorldCreateModal";
import { McMemberChip } from "./McAvatar";
import { ConfirmModal, DownloadModal, type ConfirmType } from "./WorldActionModals";

// Dynmap 임베드(PlotsView 와 동일한 /dynmap-proxy 규약). 월드는 보더 중심이 (0,0) 이라 0,0 기준.
const MAP_URL = (process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "").replace(/\/$/, "");
const MAP_NAME = process.env.NEXT_PUBLIC_MINECRAFT_MAP_NAME || "flat";
const MAP_CB = Date.now(); // 캐시 버스터(base 없는 예전 프록시 응답 무시)
function buildWorldMapSrc(world: string) {
  return `${MAP_URL}?worldname=${encodeURIComponent(world)}&mapname=${encodeURIComponent(MAP_NAME)}&zoom=5&x=0&y=64&z=0&_cb=${MAP_CB}`;
}

interface Member {
  uuid?: string;
  name: string;
}
interface World {
  id: string;
  name: string;
  icon: string | null;
  mvWorld: string | null;
  source: string;
  ownerName: string;
  generator: string;
  version: string | null;
  sizeBytes: number;
  border: number;
  flags: Record<string, unknown>;
  trusted: Member[];
  status: string;
  lastSaved: string | null;
  lastBackupAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  backups: { ts: number; bytes: number }[];
  owned: boolean;
}
interface Quota {
  usedBytes: number;
  totalBytes: number | null;
  worldCount: number;
}
interface PlotLite {
  id: string;
  alias: string | null;
  world: string;
  ownerName?: string;
}

const FLAGS: { key: string; label: string }[] = [
  { key: "doMobSpawning", label: "몹 스폰 (Mob Spawn)" },
  { key: "doWeatherCycle", label: "날씨 (Weather)" },
  { key: "doDaylightCycle", label: "낮/밤 순환 (Daylight)" },
  { key: "doFireTick", label: "불 번짐 (Fire Tick)" },
  { key: "mobGriefing", label: "몹 그리핑 (Mob Griefing)" },
  { key: "doTileDrops", label: "블록 드롭 (Tile Drops)" },
  { key: "doTraderSpawning", label: "방랑상인 (Wandering Trader)" },
];
const DIFFICULTIES: { id: string; label: string }[] = [
  { id: "peaceful", label: "평화 (Peaceful)" },
  { id: "easy", label: "쉬움 (Easy)" },
  { id: "normal", label: "보통 (Normal)" },
  { id: "hard", label: "어려움 (Hard)" },
];
const GAMEMODES: { id: string; label: string }[] = [
  { id: "creative", label: "크리에이티브 (Creative)" },
  { id: "survival", label: "서바이벌 (Survival)" },
  { id: "adventure", label: "모험 (Adventure)" },
  { id: "spectator", label: "관전 (Spectator)" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function addDays(iso: string, days: number): string {
  try {
    return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
  } catch {
    return iso;
  }
}

export default function ServerDashboard({
  userName,
  userHandle,
  avatarUrl,
  userRole,
}: {
  userName: string;
  userHandle: string;
  avatarUrl: string;
  userRole: string;
}) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [invited, setInvited] = useState<World[]>([]);
  const [plots, setPlots] = useState<PlotLite[]>([]);
  const [invitedPlots, setInvitedPlots] = useState<PlotLite[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaState, setQuotaState] = useState<string>("ok");
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"plots" | "world">("plots");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [focusPlotId, setFocusPlotId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [ruleBusy, setRuleBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [wRes, iRes, pRes, ipRes] = await Promise.all([getMyWorlds(), getInvitedWorlds(), getMyPlots(), getInvitedPlots()]);
    if (wRes.success) {
      setWorlds(wRes.worlds.map((w) => ({ ...w, owned: true })));
      setQuota(wRes.quota);
      setQuotaState(wRes.quotaState || "ok");
    }
    if (iRes.success) {
      setInvited(
        iRes.worlds.map((w) => ({
          id: w.id,
          name: w.name,
          icon: w.icon ?? null,
          mvWorld: w.mvWorld ?? null,
          source: w.source ?? "basic",
          ownerName: w.ownerName,
          generator: w.generator,
          version: w.version ?? null,
          sizeBytes: w.sizeBytes ?? 0,
          border: 3000,
          flags: {},
          trusted: (w.trusted as Member[]) ?? [],
          status: w.status,
          lastSaved: null,
          lastBackupAt: null,
          archivedAt: null,
          createdAt: w.createdAt ?? "",
          backups: [],
          owned: false,
        }))
      );
    }
    if (pRes.success) setPlots((pRes.plots as PlotLite[]) || []);
    if (ipRes.success) setInvitedPlots((ipRes.plots as PlotLite[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allWorlds = [...worlds, ...invited];
  const selected = allWorlds.find((w) => w.id === selectedWorldId) || null;

  const selectWorld = (id: string) => {
    setSelectedWorldId(id);
    setView("world");
  };

  // 선택된(활성) 월드의 실시간 정보(크기·게임룰)를 서버에서 가져와 병합 + 30일 수명주기 갱신.
  const refreshLive = useCallback(async (worldId: string) => {
    setLiveBusy(true);
    const res = await getWorldLive(worldId);
    setLiveBusy(false);
    if (!res.success) return;
    const patch = (arr: World[]) =>
      arr.map((w) =>
        w.id === worldId
          ? { ...w, sizeBytes: res.live.sizeBytes, border: res.live.border, flags: res.live.gamerules, version: res.live.version ?? w.version, status: w.status === "provisioning" ? "active" : w.status }
          : w
      );
    setWorlds((a) => patch(a));
    setInvited((a) => patch(a));
  }, []);

  useEffect(() => {
    if (view !== "world" || !selectedWorldId) return;
    const w = [...worlds, ...invited].find((x) => x.id === selectedWorldId);
    if (w?.mvWorld && w.status === "active") refreshLive(selectedWorldId);
    // 선택 변경 시 1회만 호출(patch 로 인한 재실행 방지 위해 worlds/invited 제외)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorldId, view, refreshLive]);

  const patchWorld = (id: string, fn: (w: World) => World) => {
    setWorlds((a) => a.map((w) => (w.id === id ? fn(w) : w)));
    setInvited((a) => a.map((w) => (w.id === id ? fn(w) : w)));
  };

  const handleToggleRule = async (world: World, key: string, next: boolean) => {
    setRuleBusy(key);
    setMessage(null);
    const res = await setWorldGamerule(world.id, key, next);
    setRuleBusy(null);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, flags: res.flags }));
    } else {
      setMessage({ type: "error", text: res.error || "게임룰 변경에 실패했습니다." });
    }
  };

  const handleSetting = async (world: World, key: string, value: string | number | boolean) => {
    setRuleBusy(key);
    setMessage(null);
    const res = await setWorldSetting(world.id, key, value);
    setRuleBusy(null);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, flags: res.flags }));
    } else {
      setMessage({ type: "error", text: res.error || "설정 변경에 실패했습니다." });
    }
  };

  // 백업/비활성화/삭제 확인 모달의 실제 실행기.
  const runConfirm = async () => {
    if (!selected || !confirmType) return;
    const t = confirmType;
    setBusy(true);
    setMessage(null);
    const res =
      t === "backup" ? await backupWorld(selected.id) : t === "deactivate" ? await deactivateWorld(selected.id) : await deleteWorld(selected.id);
    setBusy(false);
    setConfirmType(null);
    if (res.success) {
      if (t === "delete") {
        setSelectedWorldId(null);
        setView("plots");
      }
      setMessage({
        type: "success",
        text: t === "backup" ? "백업을 완료했습니다." : t === "deactivate" ? "월드를 비활성화했습니다." : "월드를 삭제했습니다.",
      });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "처리에 실패했습니다." });
    }
  };

  // 비활성(아카이브) 월드를 다시 활성화(복구).
  const handleRestore = async (world: World) => {
    setBusy(true);
    setMessage(null);
    const res = await restoreWorld(world.id);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "월드를 활성화했습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "활성화에 실패했습니다." });
    }
  };

  const handleRename = async (world: World, newName: string): Promise<boolean> => {
    if (newName.trim() === world.name) return true;
    setBusy(true);
    setMessage(null);
    const res = await renameWorld(world.id, newName);
    setBusy(false);
    if (res.success) {
      patchWorld(world.id, (w) => ({ ...w, name: res.name }));
      return true;
    }
    setMessage({ type: "error", text: res.error || "이름 변경에 실패했습니다." });
    return false;
  };

  const pct = quota && quota.totalBytes ? Math.min(100, (quota.usedBytes / quota.totalBytes) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {/* ===== 상단 바 ===== */}
      <header className="h-14 shrink-0 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6">
        <a href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo_icon.png" alt="BlockCanvas" width={26} height={26} className="object-contain w-auto h-auto" />
          <span className="font-black text-lg tracking-tighter">BlockCanvas</span>
        </a>
        <UserSidebar userName={userName} userHandle={userHandle} avatarUrl={avatarUrl} isOwner userRole={userRole} />
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* ===== 좌측 사이드바 ===== */}
        <aside className="w-72 shrink-0 bg-white border-r border-neutral-200 flex flex-col overflow-y-auto">
          {/* 내 플롯 */}
          <div className="p-3 border-b border-neutral-100">
            <button
              onClick={() => setView("plots")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
                view === "plots" ? "bg-neutral-100" : "hover:bg-neutral-50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Layers size={16} className="text-neutral-500" /> 내 플롯
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">{plots.length}</span>
            </button>
            {plots.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {plots.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setFocusPlotId(p.id);
                      setView("plots");
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-neutral-500 hover:bg-neutral-50 truncate"
                  >
                    {p.alias || `영토 ${p.id}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 초대된 플롯 */}
          {invitedPlots.length > 0 && (
            <div className="p-3 border-b border-neutral-100">
              <div className="px-2.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">초대된 플롯</div>
              <div className="space-y-0.5">
                {invitedPlots.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setFocusPlotId(p.id);
                      setView("plots");
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-neutral-500 hover:bg-neutral-50 truncate"
                  >
                    {p.alias || `영토 ${p.id}`}
                    {p.ownerName && <span className="text-neutral-400"> · {p.ownerName}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 내 월드 */}
          <div className="p-3 border-b border-neutral-100">
            <div className="flex items-center justify-between px-2.5 mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Boxes size={16} className="text-neutral-500" /> 내 월드
              </span>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors"
              >
                <Plus size={12} /> 생성
              </button>
            </div>

            {quota && (
              <div className="px-2.5 mb-3">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1 font-medium">
                  <span>{formatBytes(quota.usedBytes)}</span>
                  <span>{quota.totalBytes === null ? "무제한" : formatBytes(quota.totalBytes)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 90 ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${quota.totalBytes === null ? 4 : pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-0.5">
              {loading ? (
                <div className="flex items-center gap-2 px-2.5 py-3 text-xs text-neutral-400">
                  <Loader2 size={14} className="animate-spin" /> 불러오는 중...
                </div>
              ) : worlds.length === 0 ? (
                <p className="px-2.5 py-3 text-xs text-neutral-400">아직 월드가 없습니다. 위 생성으로 만드세요.</p>
              ) : (
                worlds.map((w) => <WorldRow key={w.id} world={w} active={view === "world" && selectedWorldId === w.id} onClick={() => selectWorld(w.id)} />)
              )}
            </div>
          </div>

          {/* 초대된 월드 */}
          {invited.length > 0 && (
            <div className="p-3">
              <div className="px-2.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">초대된 월드</div>
              <div className="space-y-0.5">
                {invited.map((w) => (
                  <WorldRow key={w.id} world={w} shared active={view === "world" && selectedWorldId === w.id} onClick={() => selectWorld(w.id)} />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ===== 메인 ===== */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {quotaState !== "ok" && (
            <div
              className={`mx-6 mt-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                quotaState === "locked" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}
            >
              <ShieldAlert size={14} className="mt-px shrink-0" />
              <span>
                {quotaState === "locked"
                  ? "클라우드 용량을 초과해 모든 월드가 비활성화되었습니다. 지금은 다운로드/삭제만 가능합니다. 월드를 삭제해 용량을 확보하면 다시 활성화·사용할 수 있습니다."
                  : "클라우드 용량이 거의 찼습니다(90% 이상). 용량을 초과하면 모든 월드가 자동 비활성화됩니다. 미리 정리해 주세요."}
              </span>
            </div>
          )}
          {message && (
            <div
              className={`mx-6 mt-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-rose-50 text-rose-700 border border-rose-100"
              }`}
            >
              {message.type === "success" ? <CheckCircle2 size={14} className="mt-px" /> : <ShieldAlert size={14} className="mt-px" />}
              <span>{message.text}</span>
            </div>
          )}

          {view === "plots" ? (
            <PlotsView focusPlotId={focusPlotId} />
          ) : selected ? (
            <WorldDetail
              world={selected}
              busy={busy}
              liveBusy={liveBusy}
              ruleBusy={ruleBusy}
              locked={quotaState === "locked"}
              onToggleRule={(key, next) => handleToggleRule(selected, key, next)}
              onSetting={(key, value) => handleSetting(selected, key, value)}
              onBackup={() => setConfirmType("backup")}
              onDownload={() => setDownloadOpen(true)}
              onDeactivate={() => setConfirmType("deactivate")}
              onDelete={() => setConfirmType("delete")}
              onRestore={() => handleRestore(selected)}
              onRename={(newName) => handleRename(selected, newName)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-300 p-10">
              <Boxes size={40} className="mb-3" />
              <p className="text-sm text-neutral-400">왼쪽에서 월드를 선택하세요.</p>
            </div>
          )}
        </main>
      </div>

      <WorldCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={load}
        quota={quota ? { usedBytes: quota.usedBytes, totalBytes: quota.totalBytes } : null}
      />
      <ConfirmModal type={confirmType} worldName={selected?.name || ""} busy={busy} onConfirm={runConfirm} onClose={() => !busy && setConfirmType(null)} />
      {selected && (
        <DownloadModal
          open={downloadOpen}
          worldId={selected.id}
          worldName={selected.name}
          active={selected.status === "active"}
          backups={selected.backups}
          onClose={() => setDownloadOpen(false)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function IconImg({ iconKey, size }: { iconKey: string | null; size: number }) {
  const [err, setErr] = useState(false);
  const src = worldIconSrc(iconKey);
  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
        className="object-cover rounded"
      />
    );
  }
  return (
    <span className="rounded bg-neutral-100 flex items-center justify-center" style={{ width: size, height: size }}>
      <Boxes size={Math.round(size * 0.5)} className="text-neutral-400" />
    </span>
  );
}

function WorldRow({ world, active, shared, onClick }: { world: World; active: boolean; shared?: boolean; onClick: () => void }) {
  const archived = world.status === "archived";
  // 설명: 내 월드 = 버전 · 용량 · 업로드날짜 / 공유된 월드 = 버전 · 날짜 · 용량 · 소유자
  const desc = shared
    ? `${world.version || "?"} · ${fmtDate(world.createdAt)} · ${formatBytes(world.sizeBytes)} · ${world.ownerName}`
    : `${world.version || "?"} · ${formatBytes(world.sizeBytes)} · ${fmtDate(world.createdAt)}`;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
        active ? "bg-neutral-100" : "hover:bg-neutral-50"
      } ${archived ? "opacity-60" : ""}`}
    >
      <IconImg iconKey={world.icon} size={32} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block text-sm font-semibold text-neutral-900 truncate">{world.name}</span>
          {world.source === "import" && <span className="text-[9px] font-bold px-1 py-px rounded bg-violet-50 text-violet-700 shrink-0">삽입</span>}
          {archived && <span className="text-[9px] font-bold px-1 py-px rounded bg-neutral-200 text-neutral-500 shrink-0">비활성</span>}
        </span>
        <span className="block text-[11px] text-neutral-400 truncate">{desc}</span>
      </span>
      {world.status === "provisioning" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="프로비저닝 중" />}
    </button>
  );
}

function WorldDetail({
  world,
  busy,
  liveBusy,
  ruleBusy,
  locked,
  onToggleRule,
  onSetting,
  onBackup,
  onDownload,
  onDeactivate,
  onDelete,
  onRestore,
  onRename,
}: {
  world: World;
  busy: boolean;
  liveBusy: boolean;
  ruleBusy: string | null;
  locked: boolean;
  onToggleRule: (key: string, next: boolean) => void;
  onSetting: (key: string, value: string | number | boolean) => void;
  onBackup: () => void;
  onDownload: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onRename: (newName: string) => Promise<boolean>;
}) {
  const flagEntries = FLAGS.map((f) => ({ ...f, v: world.flags?.[f.key] }));
  const archived = world.status === "archived";
  const active = world.status === "active";
  const editable = world.owned && active && !locked;
  const difficulty = typeof world.flags?.difficulty === "string" ? (world.flags.difficulty as string) : "";
  const gamemode = typeof world.flags?.gamemode === "string" ? (world.flags.gamemode as string) : "";
  const tick = typeof world.flags?.randomTickSpeed === "number" ? (world.flags.randomTickSpeed as number) : 3;
  const explosionOn = world.flags?.explosionBlocked === true;
  const settingBusy = ruleBusy !== null || liveBusy;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(world.name);
  useEffect(() => {
    setEditingName(false);
    setNameDraft(world.name);
  }, [world.id]);
  const saveName = async () => {
    if (await onRename(nameDraft)) setEditingName(false);
  };

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* 헤더 + 액션 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <IconImg iconKey={world.icon} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <span className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") {
                        setEditingName(false);
                        setNameDraft(world.name);
                      }
                    }}
                    maxLength={32}
                    className="text-lg font-bold border border-neutral-300 rounded-lg px-2 py-1 w-48 focus:outline-none focus:border-black"
                  />
                  <button onClick={saveName} disabled={busy} className="p-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 disabled:opacity-40" title="저장">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(world.name);
                    }}
                    disabled={busy}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 disabled:opacity-40"
                    title="취소"
                  >
                    <X size={14} />
                  </button>
                </span>
              ) : (
                <h2 className="text-xl font-bold text-neutral-900 truncate flex items-center gap-1">
                  {world.name}
                  {world.owned && !locked && (
                    <button
                      onClick={() => {
                        setNameDraft(world.name);
                        setEditingName(true);
                      }}
                      className="p-1 rounded text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100"
                      title="이름 변경"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </h2>
              )}
              <StatusPill status={world.status} />
              {world.source === "import" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">삽입</span>}
              {!world.owned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">초대됨</span>}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              소유자: {world.ownerName} · {world.version || "?"} · 보더 {world.border}×{world.border}
            </p>
          </div>
        </div>

        {/* 소유자만 관리 가능. 공유된 월드는 삭제/백업/변경 불가(읽기 전용). */}
        {world.owned && (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {archived ? (
              <>
                <ActionBtn onClick={onDownload} disabled={busy} icon={<Download size={15} />} label="다운로드" />
                <button
                  onClick={onRestore}
                  disabled={busy || locked}
                  title={locked ? "용량 초과 잠금 중에는 활성화할 수 없습니다." : ""}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors disabled:opacity-40"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />} 활성화
                </button>
              </>
            ) : (
              <>
                <ActionBtn onClick={onBackup} disabled={busy || !active || locked} icon={<Archive size={15} />} label="백업" />
                <ActionBtn onClick={onDownload} disabled={busy || !active} icon={<Download size={15} />} label="다운로드" />
                <ActionBtn onClick={onDeactivate} disabled={busy || !active || locked} icon={<PowerOff size={15} />} label="비활성화" />
              </>
            )}
            <button
              onClick={onDelete}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-40"
            >
              <Trash2 size={15} /> 삭제
            </button>
          </div>
        )}
      </div>

      {archived && (
        <div className="text-xs text-neutral-500 bg-neutral-100 rounded-xl px-4 py-3 flex items-start gap-2">
          <Archive size={14} className="mt-0.5 shrink-0" />
          <span>
            비활성 상태 — 서버에서 내려가(unload) 아카이브에 보관 중입니다. <b>활성화</b>하면 다시 사용할 수 있습니다.
            {world.archivedAt && (
              <> 아카이브 후 90일이 지나면 영구 삭제됩니다 (삭제 예정: <b>{fmtDate(addDays(world.archivedAt, 90))}</b>).</>
            )}
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 월드 정보 */}
        <div>
          <SectionLabel>월드 정보</SectionLabel>
          <div className="grid grid-cols-2 gap-px bg-neutral-200 rounded-xl overflow-hidden border border-neutral-200">
            <Info icon={<HardDrive size={13} />} label="용량" value={formatBytes(world.sizeBytes)} />
            <Info icon={<Globe size={13} />} label="버전" value={world.version || "?"} />
            <Info icon={<Calendar size={13} />} label="업로드" value={fmtDate(world.createdAt)} />
            <Info icon={<Clock size={13} />} label="최근 저장" value={fmtDate(world.lastSaved)} />
            <Info icon={<Archive size={13} />} label="최근 백업" value={fmtDate(world.lastBackupAt)} />
            <Info icon={<Users size={13} />} label="초대 멤버" value={`${world.trusted.length}명`} />
          </div>

          <div className="mt-4">
            <SectionLabel>초대된 멤버</SectionLabel>
            {world.trusted.length === 0 ? (
              <p className="text-xs text-neutral-400">아직 초대된 멤버가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {world.trusted.map((m) => (
                  <McMemberChip key={m.uuid || m.name} id={m.uuid} name={m.name} />
                ))}
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-2">멤버 초대/강퇴는 서버 연동 후 제공됩니다.</p>
          </div>
        </div>

        {/* Gamerule */}
        <div>
          <SectionLabel>
            Gamerule 및 월드 설정
            {liveBusy && <Loader2 size={11} className="inline ml-1.5 animate-spin text-neutral-400" />}
          </SectionLabel>
          <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {flagEntries.map((f) => {
              const known = typeof f.v === "boolean";
              const on = f.v === true;
              return (
                <div key={f.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-neutral-700">{f.label}</span>
                  {editable ? (
                    <Toggle on={on} busy={ruleBusy === f.key} disabled={settingBusy} onClick={() => onToggleRule(f.key, !on)} />
                  ) : (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        !known ? "bg-neutral-100 text-neutral-400" : on ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {!known ? "—" : on ? "켜짐" : "꺼짐"}
                    </span>
                  )}
                </div>
              );
            })}

            {/* 게임모드 (Game Mode) — Multiverse 가 월드별로 관리, 입장 시 적용 */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-neutral-700 shrink-0">게임모드 (Game Mode)</span>
              {editable ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {GAMEMODES.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onSetting("gamemode", g.id)}
                      disabled={settingBusy}
                      title={g.label}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                        gamemode === g.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {g.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">{gamemodeLabel(gamemode)}</span>
              )}
            </div>

            {/* 난이도 (Difficulty) */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-neutral-700 shrink-0">난이도 (Difficulty)</span>
              {editable ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onSetting("difficulty", d.id)}
                      disabled={settingBusy}
                      title={d.label}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                        difficulty === d.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {d.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">{difficultyLabel(difficulty)}</span>
              )}
            </div>

            {/* 랜덤 틱 속도 (Random Tick Speed) */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-neutral-700">랜덤 틱 속도 (Random Tick Speed)</span>
              {editable ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSetting("randomTickSpeed", Math.max(0, tick - 1))}
                    disabled={settingBusy || tick <= 0}
                    className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold leading-none disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums">
                    {ruleBusy === "randomTickSpeed" ? <Loader2 size={12} className="inline animate-spin text-neutral-400" /> : tick}
                  </span>
                  <button
                    onClick={() => onSetting("randomTickSpeed", Math.min(40, tick + 1))}
                    disabled={settingBusy || tick >= 40}
                    className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold leading-none disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">{tick}</span>
              )}
            </div>

            {/* 폭발 방지 (Explosion Protection) */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-neutral-700">폭발 방지 (Explosion Protection)</span>
              {editable ? (
                <Toggle on={explosionOn} busy={ruleBusy === "explosionBlocked"} disabled={settingBusy} onClick={() => onSetting("explosionBlocked", !explosionOn)} />
              ) : (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${explosionOn ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {explosionOn ? "켜짐" : "꺼짐"}
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">
            {world.owned
              ? active
                ? "변경은 서버에 즉시 적용됩니다. 게임모드는 Multiverse 가 입장 시 적용합니다."
                : "활성 상태에서만 변경할 수 있습니다."
              : "초대된 월드는 읽기 전용입니다."}
          </p>
        </div>
      </div>

      {/* 다이나믹맵 */}
      <div>
        <SectionLabel>다이나믹맵 (Dynmap)</SectionLabel>
        {MAP_URL && world.mvWorld && active ? (
          <div className="rounded-xl overflow-hidden border border-neutral-200">
            <iframe title={`Dynmap ${world.name}`} src={buildWorldMapSrc(world.mvWorld)} className="w-full h-[600px]" loading="lazy" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 h-72 flex flex-col items-center justify-center text-neutral-400">
            <MapIcon size={28} className="mb-2" />
            <p className="text-xs">
              {!MAP_URL ? "Dynmap 미설정 (NEXT_PUBLIC_MINECRAFT_MAP_URL)" : !active ? "활성 월드만 지도가 표시됩니다" : "월드 지도를 준비 중입니다"}
            </p>
          </div>
        )}
      </div>

      {world.status === "provisioning" && (
        <div className="text-[11px] text-amber-600 flex items-center gap-1.5">
          <Clock size={12} /> 서버 프로비저닝 대기 중 — 플러그인 연동 후 자동 활성화됩니다.
        </div>
      )}
    </div>
  );
}

function Toggle({ on, busy, disabled, onClick }: { on: boolean; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-neutral-300"}`}
    >
      {busy ? (
        <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-white" />
      ) : (
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: on ? 18 : 2 }} />
      )}
    </button>
  );
}

function difficultyLabel(id: string): string {
  const d = DIFFICULTIES.find((x) => x.id === id);
  return d ? d.label.split(" ")[0] : "—";
}

function gamemodeLabel(id: string): string {
  const g = GAMEMODES.find((x) => x.id === id);
  return g ? g.label.split(" ")[0] : "—";
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string }> = {
    active: { t: "활성", c: "bg-emerald-50 text-emerald-700" },
    provisioning: { t: "프로비저닝 중", c: "bg-amber-50 text-amber-700" },
    archived: { t: "비활성", c: "bg-neutral-200 text-neutral-600" },
  };
  const s = map[status] || { t: status, c: "bg-neutral-100 text-neutral-500" };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.c}`}>{s.t}</span>;
}

function ActionBtn({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {icon} {label}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{children}</div>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold text-neutral-900 truncate">{value}</div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import {
  Plus,
  HardDrive,
  Globe,
  Users,
  Download,
  ArrowUpRight,
  Archive,
  Map as MapIcon,
  Clock,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Boxes,
  Calendar,
  Layers,
} from "lucide-react";
import { getMyWorlds, getInvitedWorlds, createWorld, archiveWorld } from "@/app/actions/worlds";
import { getMyPlots, getInvitedPlots } from "@/app/actions/minecraft";
import { formatBytes } from "@/lib/worldQuota";
import { WORLD_ICONS, worldIconSrc } from "@/lib/worldIcons";
import UserSidebar from "@/components/layout/UserSidebar";
import PlotsView from "./PlotsView";

interface World {
  id: string;
  name: string;
  icon: string | null;
  ownerName: string;
  generator: string;
  version: string | null;
  sizeBytes: number;
  border: number;
  flags: Record<string, unknown>;
  trusted: { uuid?: string; name: string }[];
  status: string;
  lastSaved: string | null;
  lastBackupAt: string | null;
  createdAt: string;
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

const GENERATORS = [
  { id: "flat", label: "평지 (Flat)" },
  { id: "wild", label: "야생 (Wild)" },
];
const FLAGS: { key: string; label: string }[] = [
  { key: "doMobSpawning", label: "몹 스폰" },
  { key: "doWeatherCycle", label: "날씨" },
  { key: "doDaylightCycle", label: "낮/밤 순환" },
  { key: "doFireTick", label: "불 번짐" },
  { key: "mobGriefing", label: "몹 그리핑" },
  { key: "doTileDrops", label: "블록 드롭" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
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
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"plots" | "world">("plots");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [focusPlotId, setFocusPlotId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [gen, setGen] = useState("flat");
  const [icon, setIcon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [wRes, iRes, pRes, ipRes] = await Promise.all([
      getMyWorlds(),
      getInvitedWorlds(),
      getMyPlots(),
      getInvitedPlots(),
    ]);
    if (wRes.success) {
      setWorlds((wRes.worlds as World[]).map((w) => ({ ...w, owned: true })));
      setQuota(wRes.quota);
    }
    if (iRes.success) {
      setInvited(
        (iRes.worlds as Partial<World>[]).map((w) => ({
          id: w.id as string,
          name: w.name as string,
          icon: w.icon ?? null,
          ownerName: w.ownerName as string,
          generator: w.generator as string,
          version: null,
          sizeBytes: w.sizeBytes ?? 0,
          border: 3000,
          flags: {},
          trusted: [],
          status: w.status as string,
          lastSaved: null,
          lastBackupAt: null,
          createdAt: "",
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

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await createWorld(name, gen, icon ?? undefined);
    if (res.success) {
      setMessage({ type: "success", text: "월드 생성을 신청했습니다." });
      setName("");
      setIcon(null);
      setShowForm(false);
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "월드 생성에 실패했습니다." });
    }
    setBusy(false);
  };

  const handleArchive = async (w: World) => {
    if (!confirm(`'${w.name}' 월드를 보관함으로 이동할까요? (30일 후 영구 삭제)`)) return;
    setBusy(true);
    setMessage(null);
    const res = await archiveWorld(w.id);
    if (res.success) {
      setSelectedWorldId(null);
      setView("plots");
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "보관에 실패했습니다." });
    }
    setBusy(false);
  };

  const pct = quota && quota.totalBytes ? Math.min(100, (quota.usedBytes / quota.totalBytes) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {/* ===== 상단 바: BlockCanvas 로고 + 기존 로그인 NAV ===== */}
      <header className="h-14 shrink-0 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6">
        <a href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo_icon.png" alt="BlockCanvas" width={26} height={26} className="object-contain w-auto h-auto" />
          <span className="font-black text-lg tracking-tighter">BlockCanvas</span>
        </a>
        <UserSidebar userName={userName} userHandle={userHandle} avatarUrl={avatarUrl} isOwner userRole={userRole} />
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* ===== 좌측 사이드바: 내 플롯 / 내 월드 / 초대된 월드 ===== */}
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
                onClick={() => setShowForm((s) => !s)}
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

            {showForm && (
              <div className="mb-3 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="월드 이름 (2~32자)"
                  maxLength={32}
                  className="w-full bg-white border border-neutral-200 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                />
                <select
                  value={gen}
                  onChange={(e) => setGen(e.target.value)}
                  className="w-full bg-white border border-neutral-200 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-black"
                >
                  {GENERATORS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <div>
                  <div className="text-[10px] text-neutral-400 font-bold mb-1">아이콘 선택</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {WORLD_ICONS.map((ic) => (
                      <button
                        key={ic.key}
                        onClick={() => setIcon((cur) => (cur === ic.key ? null : ic.key))}
                        title={ic.label}
                        className={`aspect-square rounded-lg border flex items-center justify-center overflow-hidden ${
                          icon === ic.key ? "border-black ring-1 ring-black" : "border-neutral-200 hover:border-neutral-400"
                        }`}
                      >
                        <IconImg iconKey={ic.key} size={26} />
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={busy || !name.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-bold disabled:opacity-40"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : "만들기"}
                </button>
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
                  <WorldRow key={w.id} world={w} active={view === "world" && selectedWorldId === w.id} onClick={() => selectWorld(w.id)} />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ===== 메인 ===== */}
        <main className="flex-1 min-h-0 overflow-y-auto">
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
            <WorldDetail world={selected} busy={busy} onArchive={() => handleArchive(selected)} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-300 p-10">
              <Boxes size={40} className="mb-3" />
              <p className="text-sm text-neutral-400">왼쪽에서 월드를 선택하세요.</p>
            </div>
          )}
        </main>
      </div>
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

function WorldRow({ world, active, onClick }: { world: World; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
        active ? "bg-neutral-100" : "hover:bg-neutral-50"
      }`}
    >
      <IconImg iconKey={world.icon} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-900 truncate">{world.name}</span>
        <span className="block text-[11px] text-neutral-400 truncate">소유자: {world.ownerName}</span>
      </span>
      {world.status === "provisioning" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="프로비저닝 중" />}
    </button>
  );
}

function WorldDetail({ world, busy, onArchive }: { world: World; busy: boolean; onArchive: () => void }) {
  const flagEntries = FLAGS.map((f) => ({ ...f, v: world.flags?.[f.key] }));
  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* 헤더 + 액션 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <IconImg iconKey={world.icon} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-neutral-900 truncate">{world.name}</h2>
              <StatusPill status={world.status} />
              {!world.owned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">초대됨</span>}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              소유자: {world.ownerName} · {world.generator} · 보더 {world.border}×{world.border}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Action icon={<Users size={15} />} label={`멤버 ${world.trusted.length}`} disabled title="서버 연동 후" />
          <Action icon={<Download size={15} />} label="백업" disabled title="서버 연동 후" />
          <Action icon={<ArrowUpRight size={15} />} label="양도" disabled title="서버 연동 후" />
          {world.owned && (
            <button
              onClick={onArchive}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-40"
            >
              <Archive size={15} /> 보관
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 월드 정보 */}
        <div>
          <SectionLabel>월드 정보</SectionLabel>
          <div className="grid grid-cols-2 gap-px bg-neutral-200 rounded-xl overflow-hidden border border-neutral-200">
            <Info icon={<HardDrive size={13} />} label="크기" value={formatBytes(world.sizeBytes)} />
            <Info icon={<Globe size={13} />} label="생성기" value={world.generator} />
            <Info icon={<Calendar size={13} />} label="생성일" value={fmtDate(world.createdAt)} />
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
                  <span key={m.uuid || m.name} className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                    {m.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-2">멤버 초대/강퇴는 서버 연동 후 제공됩니다.</p>
          </div>
        </div>

        {/* Gamerule 및 월드 설정 */}
        <div>
          <SectionLabel>Gamerule 및 월드 설정</SectionLabel>
          <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {flagEntries.map((f) => {
              const known = typeof f.v === "boolean";
              return (
                <div key={f.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-neutral-700">{f.label}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      !known ? "bg-neutral-100 text-neutral-400" : f.v ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {!known ? "—" : f.v ? "켜짐" : "꺼짐"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">게임룰 편집은 서버 연동(Phase C) 후 제공됩니다.</p>
        </div>
      </div>

      {/* 다이나믹맵 */}
      <div>
        <SectionLabel>다이나믹맵 (Dynmap)</SectionLabel>
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 h-72 flex flex-col items-center justify-center text-neutral-400">
          <MapIcon size={28} className="mb-2" />
          <p className="text-xs">월드 Dynmap 실시간 뷰 — 서버 연동 후 표시</p>
        </div>
      </div>

      {world.status === "provisioning" && (
        <div className="text-[11px] text-amber-600 flex items-center gap-1.5">
          <Clock size={12} /> 서버 프로비저닝 대기 중 — 플러그인 연동 후 자동 활성화됩니다.
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string }> = {
    active: { t: "활성", c: "bg-emerald-50 text-emerald-700" },
    provisioning: { t: "프로비저닝 중", c: "bg-amber-50 text-amber-700" },
  };
  const s = map[status] || { t: status, c: "bg-neutral-100 text-neutral-500" };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.c}`}>{s.t}</span>;
}

function Action({ icon, label, disabled, title }: { icon: ReactNode; label: string; disabled?: boolean; title?: string }) {
  return (
    <button
      disabled={disabled}
      title={title}
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

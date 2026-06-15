"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  HardDrive,
  Loader2,
  Plus,
  Globe,
  Clock,
  Users,
  Download,
  ArrowUpRight,
  Archive,
  Map as MapIcon,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { getMyWorlds, createWorld, archiveWorld } from "@/app/actions/worlds";
import { formatBytes } from "@/lib/worldQuota";

interface World {
  id: string;
  name: string;
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
}
interface Quota {
  usedBytes: number;
  totalBytes: number | null;
  worldCount: number;
}

const GENERATORS = [
  { id: "flat", label: "평지 (Flat)" },
  { id: "wild", label: "야생 (Wild)" },
];

export default function MinecraftWorlds() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [gen, setGen] = useState("flat");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await getMyWorlds();
    if (res.success) {
      setWorlds(res.worlds as World[]);
      setQuota(res.quota);
    } else {
      setMessage({ type: "error", text: res.error || "월드 정보를 불러오지 못했습니다." });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await createWorld(name, gen);
    if (res.success) {
      setMessage({ type: "success", text: "월드 생성을 신청했습니다. (서버 프로비저닝 대기)" });
      setName("");
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
      setMessage({ type: "success", text: "월드를 보관함으로 이동했습니다." });
      await load();
    } else {
      setMessage({ type: "error", text: res.error || "보관에 실패했습니다." });
    }
    setBusy(false);
  };

  const pct = quota && quota.totalBytes ? Math.min(100, (quota.usedBytes / quota.totalBytes) * 100) : 0;

  return (
    <section>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-neutral-900">
            <HardDrive size={20} className="text-neutral-700" />
            내 월드 (클라우드)
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            개인 전용 월드를 만들고 멤버·게임룰·백업을 웹에서 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm whitespace-nowrap"
        >
          <Plus size={15} /> 월드 생성
        </button>
      </div>

      {/* 쿼터 바 */}
      {quota && (
        <div className="mb-5 p-4 rounded-2xl border border-neutral-200 bg-neutral-50/60">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-600 mb-2">
            <span className="flex items-center gap-1.5">
              <HardDrive size={13} /> 클라우드 사용량
            </span>
            <span>
              {formatBytes(quota.usedBytes)} / {quota.totalBytes === null ? "무제한" : formatBytes(quota.totalBytes)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct > 90 ? "bg-rose-500" : "bg-neutral-800"}`}
              style={{ width: `${quota.totalBytes === null ? 3 : pct}%` }}
            />
          </div>
          <div className="text-[11px] text-neutral-400 mt-1.5 font-medium">월드 {quota.worldCount}개</div>
        </div>
      )}

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium mb-5 flex items-start gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} className="mt-0.5" />
          ) : (
            <ShieldAlert size={16} className="mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 생성 폼 */}
      {showForm && (
        <div className="mb-5 p-5 rounded-2xl border border-neutral-200 bg-white">
          <div className="text-sm font-bold text-neutral-800 mb-3">새 월드 만들기</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="월드 이름 (2~32자)"
              maxLength={32}
              className="flex-1 border border-neutral-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black transition-all"
            />
            <select
              value={gen}
              onChange={(e) => setGen(e.target.value)}
              className="border border-neutral-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black bg-white"
            >
              {GENERATORS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={busy || !name.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 생성
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 mt-2 font-medium">
            월드 보더는 3000×3000으로 제한됩니다. 실제 생성은 서버 연동 후 완료됩니다.
          </p>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center p-8 bg-neutral-50 border border-neutral-100 rounded-xl">
          <Loader2 className="animate-spin text-neutral-400 mr-2" size={20} />
          <span className="text-neutral-500 font-medium text-sm">월드 정보를 불러오는 중...</span>
        </div>
      ) : worlds.length === 0 ? (
        <div className="text-center p-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl">
          <Globe className="mx-auto text-neutral-300 mb-3" size={32} />
          <p className="text-sm text-neutral-500 font-medium">아직 월드가 없습니다.</p>
          <p className="text-xs text-neutral-400 mt-1">
            위 <b>월드 생성</b>으로 첫 클라우드 월드를 만들어 보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {worlds.map((w) => (
            <WorldCard key={w.id} world={w} busy={busy} onArchive={() => handleArchive(w)} />
          ))}
        </div>
      )}
    </section>
  );
}

function WorldCard({ world, busy, onArchive }: { world: World; busy: boolean; onArchive: () => void }) {
  const flagEntries = Object.entries(world.flags || {});
  const statusBadge =
    world.status === "active"
      ? { text: "활성", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" }
      : world.status === "provisioning"
      ? { text: "프로비저닝 중", cls: "bg-amber-50 text-amber-700 border-amber-100" }
      : { text: world.status, cls: "bg-neutral-100 text-neutral-500 border-neutral-200" };

  return (
    <div className="border border-neutral-200 rounded-2xl p-5 bg-white">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-neutral-900">{world.name}</span>
            {world.version && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded">
                {world.version}
              </span>
            )}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>
              {statusBadge.text}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-medium mt-1.5">
            <span className="flex items-center gap-1">
              <HardDrive size={11} /> {formatBytes(world.sizeBytes)}
            </span>
            <span className="flex items-center gap-1">
              <Globe size={11} /> {world.generator}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} /> {world.trusted.length}
            </span>
          </div>
        </div>
        {/* 액션 (Builder's Refuge 스타일) — 서버 연동 후 활성화 */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ActionBtn icon={<MapIcon size={14} />} label="지도" disabled title="서버 연동 후 제공" />
          <ActionBtn icon={<Download size={14} />} label="백업" disabled title="서버 연동 후 제공" />
          <ActionBtn icon={<ArrowUpRight size={14} />} label="양도" disabled title="서버 연동 후 제공" />
          <button
            onClick={onArchive}
            disabled={busy}
            title="보관함으로 이동"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            <Archive size={14} /> 보관
          </button>
        </div>
      </div>

      {flagEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100">
          {flagEntries.slice(0, 6).map(([k, v]) => (
            <span
              key={k}
              className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-50 border border-neutral-100 text-neutral-500"
            >
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      {world.status === "provisioning" && (
        <div className="mt-3 text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
          <Clock size={12} /> 서버 프로비저닝 대기 중 — 플러그인 연동 후 자동 활성화됩니다.
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  disabled,
  title,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-500"
    >
      {icon} {label}
    </button>
  );
}

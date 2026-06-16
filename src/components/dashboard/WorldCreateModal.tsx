"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Upload, Loader2, Boxes, FileArchive } from "lucide-react";
import { createWorld } from "@/app/actions/worlds";
import { WORLD_ICONS, worldIconSrc } from "@/lib/worldIcons";
import { formatBytes } from "@/lib/worldQuota";

const GENERATORS = [
  { id: "flat", label: "평지 (Flat)" },
  { id: "wild", label: "야생 (Wild)" },
];

function IconPicker({ value, onChange }: { value: string | null; onChange: (k: string | null) => void }) {
  return (
    <div>
      <div className="text-[11px] text-neutral-500 font-bold mb-1.5">아이콘 선택</div>
      <div className="grid grid-cols-8 gap-1.5">
        {WORLD_ICONS.map((ic) => {
          const src = worldIconSrc(ic.key);
          return (
            <button
              key={ic.key}
              type="button"
              onClick={() => onChange(value === ic.key ? null : ic.key)}
              title={ic.label}
              className={`aspect-square rounded-lg border flex items-center justify-center overflow-hidden ${
                value === ic.key ? "border-black ring-1 ring-black" : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={ic.label} style={{ imageRendering: "pixelated" }} className="w-6 h-6 object-cover rounded" />
              ) : (
                <Boxes size={16} className="text-neutral-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WorldCreateModal({
  open,
  onClose,
  onDone,
  quota,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  quota: { usedBytes: number; totalBytes: number | null } | null;
}) {
  const [tab, setTab] = useState<"basic" | "import">("basic");
  const [name, setName] = useState("");
  const [gen, setGen] = useState("flat");
  const [icon, setIcon] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (open) {
      setTab("basic");
      setName("");
      setGen("flat");
      setIcon(null);
      setFile(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const remaining = quota && quota.totalBytes !== null ? Math.max(0, quota.totalBytes - quota.usedBytes) : null;

  const handleBasic = async () => {
    setBusy(true);
    setError(null);
    const res = await createWorld(name, gen, icon ?? undefined);
    setBusy(false);
    if (res.success) {
      onDone();
      onClose();
    } else {
      setError(res.error || "월드 생성에 실패했습니다.");
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError(".zip 월드 파일을 선택하세요.");
      return;
    }
    if (remaining !== null && file.size > remaining) {
      setError(`클라우드 용량을 초과합니다. (남은 용량 ${formatBytes(remaining)})`);
      return;
    }
    // ZIP 매직바이트(PK) 확인 — 월드맵이 아닌 파일(이미지·문서 등) 즉시 거부.
    try {
      const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
      if (head[0] !== 0x50 || head[1] !== 0x4b) {
        setError("올바른 .zip 파일이 아닙니다. 월드 폴더를 압축한 .zip 을 선택해 주세요.");
        return;
      }
    } catch { /* 읽기 실패 시 서버 검증에 위임 */ }
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ name });
      if (icon) qs.set("icon", icon);
      const res = await fetch(`/api/world/import?${qs.toString()}`, { method: "POST", body: file });
      const json = await res.json().catch(() => ({ success: false, error: "응답 파싱 실패" }));
      if (res.ok && json.success) {
        onDone();
        onClose();
      } else {
        setError(json.error || "월드 삽입에 실패했습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-base font-bold text-neutral-900">새 월드</h2>
          <button onClick={() => !busy && onClose()} className="text-neutral-400 hover:text-neutral-700" title="닫기">
            <X size={18} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setTab("basic")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === "basic" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            <Boxes size={15} /> 기본 생성
          </button>
          <button
            onClick={() => setTab("import")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === "import" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            <FileArchive size={15} /> 월드 삽입
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[11px] text-neutral-500 font-bold mb-1.5">월드 이름</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="월드 이름 (2~32자)"
              maxLength={32}
              className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black"
            />
          </div>

          {tab === "basic" ? (
            <div>
              <div className="text-[11px] text-neutral-500 font-bold mb-1.5">맵 종류</div>
              <select
                value={gen}
                onChange={(e) => setGen(e.target.value)}
                className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black"
              >
                {GENERATORS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] text-neutral-500 font-bold">월드 파일 (.zip)</div>
                {remaining !== null && (
                  <div className="text-[11px] text-neutral-400">남은 용량 {formatBytes(remaining)}</div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-neutral-300 hover:border-neutral-500 text-sm text-neutral-600"
              >
                <Upload size={15} />
                {file ? (
                  <span className="truncate">
                    {file.name} <span className="text-neutral-400">({formatBytes(file.size)})</span>
                  </span>
                ) : (
                  "월드 폴더를 압축한 .zip 선택"
                )}
              </button>
              <p className="text-[11px] text-neutral-400 mt-1.5">level.dat 이 포함된 월드 폴더를 zip 으로 압축해 업로드하세요.</p>
            </div>
          )}

          <IconPicker value={icon} onChange={setIcon} />

          {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button onClick={() => !busy && onClose()} className="px-3 py-2 rounded-lg text-sm font-bold text-neutral-500 hover:bg-neutral-100">
            취소
          </button>
          <button
            onClick={tab === "basic" ? handleBasic : handleImport}
            disabled={busy || name.trim().length < 2 || (tab === "import" && !file)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-sm font-bold disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : tab === "basic" ? <Plus size={15} /> : <Upload size={15} />}
            {tab === "basic" ? "생성" : "삽입"}
          </button>
        </div>
      </div>
    </div>
  );
}

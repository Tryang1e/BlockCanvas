"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Upload, Loader2, Boxes, FileArchive, Castle } from "lucide-react";
import { createWorld } from "@/app/actions/worlds";
import { WORLD_ICONS, worldIconSrc } from "@/lib/worldIcons";
import { formatBytes } from "@/lib/worldQuota";
import { useFileDrop } from "@/lib/useFileDrop";
import { UPLOAD_CHUNK_SIZE, clientUploadBytesPerSec } from "@/lib/uploadChunk";
import { etaRangeText, UPLOAD_ETA_BPS } from "@/lib/transferEta";

// 청크 케이던스 페이서 — 각 청크 전송 "시작 시각"을 rate 로 띄워 평균 송신속도를 rate 이하로 제한한다.
// 요청 스트리밍(Chrome 전용) 대신 이 방식이라 Firefox/Safari·HTTP/1.1·비보안(plain-http LAN) 포함 전 브라우저에서 동작.
// 청크가 작아(UPLOAD_CHUNK_SIZE=8MB) 각 버스트가 짧고, 사이 간격으로 회선이 비어 같은 회선의 MC 가 안 끊긴다.
// Math.max(nextAt, now): 전송이 rate 보다 느린(회선 느림) 경우엔 추가 대기 없이 자연히 회선 속도를 따른다.
// rate 는 가변 — 서버 QoS 동적 할당(청크 응답 rateBps)이 setRate 로 갱신한다(혼자면 총 대역, 혼잡 시 가중 1/n).
function makeCadence(initialBps: number): { wait: (bytes: number) => Promise<void>; setRate: (bps: number) => void } {
  let rate = initialBps;
  let nextAt = performance.now();
  return {
    wait: async (bytes: number) => {
      if (rate <= 0) return; // 0 = 무제한
      const now = performance.now();
      if (now < nextAt) await new Promise((r) => setTimeout(r, nextAt - now));
      nextAt = Math.max(nextAt, now) + (bytes / rate) * 1000;
    },
    // 서버가 준 몫으로 갱신 — 쓰레기값(NaN/0/음수)은 무시하고 직전 속도 유지(fail-safe).
    setRate: (bps: number) => {
      if (Number.isFinite(bps) && bps > 0) rate = bps;
    },
  };
}

const GENERATORS = [
  { id: "flat", label: "평지 (Flat)" },
  { id: "wild", label: "야생 (Wild)" },
];

// uploadId 를 파일 지문(name|size|lastModified) 키로 sessionStorage 에 보존 — 성공 응답 유실 후
// 모달 재오픈·페이지 리로드·파일 재선택에도 같은 uploadId 를 재사용해 서버 멱등(import_key)이 중복
// 월드 삽입을 막는다. **확인된 성공 시 삭제** — 그 뒤 같은 파일 재업로드는 의도적 복제본으로 정상 동작.
// sessionStorage 접근 실패(프라이버시 모드 등)는 조용히 in-memory(ref)만으로 동작.
function uploadIdStorageKey(f: File): string {
  return `world-upload-id:${f.name}|${f.size}|${f.lastModified}`;
}
function loadOrCreateUploadId(f: File): string {
  try {
    const prev = sessionStorage.getItem(uploadIdStorageKey(f));
    if (prev && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prev)) return prev;
  } catch { /* 접근 불가 → 새로 발급 */ }
  const id = genUploadId();
  try { sessionStorage.setItem(uploadIdStorageKey(f), id); } catch { /* 저장 실패해도 이번 세션 ref 로 동작 */ }
  return id;
}
function clearStoredUploadId(f: File): void {
  try { sessionStorage.removeItem(uploadIdStorageKey(f)); } catch { /* 무해 */ }
}

// 업로드 세션 식별자(v4 uuid). crypto.randomUUID 는 보안 컨텍스트(HTTPS/localhost)에서만 보장되므로,
// 비보안 컨텍스트(plain-http LAN 접속)에서도 동작하도록 폴백을 둔다. 서버 UUID_RE 와 형식이 일치해야 한다.
function genUploadId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
  speedMultiplier = 1,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  quota: { usedBytes: number; totalBytes: number | null } | null;
  speedMultiplier?: number; // 등급 배수(creator 이상 2) — 업로드 페이싱·ETA 에 반영
}) {
  const [tab, setTab] = useState<"basic" | "import">("basic");
  const [name, setName] = useState("");
  const [gen, setGen] = useState("flat");
  const [structures, setStructures] = useState(false);
  const [icon, setIcon] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // 청크 업로드 진행률(0~100), null=미진행
  const [liveBps, setLiveBps] = useState<number | null>(null); // 서버 QoS 가 할당한 현재 송신 속도(표시용)
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 선택한 파일별 업로드 uploadId 를 유지 — 오탐 실패 후 같은 파일로 재클릭하면 같은 uploadId 를 재사용해
  // 서버 멱등(import_key)이 기존 월드를 반환하게 한다(중복 월드 방지). 파일이 바뀌면 새 uploadId 를 발급한다.
  const uploadIdRef = useRef<{ file: File; id: string } | null>(null);

  // .zip 월드 파일 드래그앤드롭.
  const { dragging, dropProps } = useFileDrop((files) => {
    const f = files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".zip")) {
      setError("올바른 .zip 월드 파일을 올려주세요.");
      return;
    }
    setError(null);
    setFile(f);
  });

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
      setStructures(false);
      setIcon(null);
      setFile(null);
      setError(null);
      setProgress(null);
      setLiveBps(null);
      uploadIdRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  const remaining = quota && quota.totalBytes !== null ? Math.max(0, quota.totalBytes - quota.usedBytes) : null;

  const handleBasic = async () => {
    setBusy(true);
    setError(null);
    const res = await createWorld(name, gen, icon ?? undefined, structures);
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
    setProgress(null);
    setLiveBps(null);
    try {
      // 모든 파일을 청크 경로로 통일 — CF 100MB 요청본문 한도 우회 + 완료 마커 멱등 보호를
      // 소용량에도 일관 적용(재클릭·응답유실 시 중복 월드 방지). 소용량은 단일 조각(chunkCount=1)으로 처리된다.
      // uploadId 는 파일 지문 키의 sessionStorage 가 진실원본 — 리로드/모달 재오픈/파일 재선택을 넘어
      // 같은 파일이면 같은 uploadId(서버 멱등), 확인된 성공 후에만 새 id(의도적 복제본 허용).
      if (!uploadIdRef.current || uploadIdRef.current.file !== file) {
        uploadIdRef.current = { file, id: loadOrCreateUploadId(file) };
      }
      const uploadId = uploadIdRef.current.id;
      const chunkCount = Math.ceil(file.size / UPLOAD_CHUNK_SIZE);
      // 브라우저 송신 속도 제한(전 브라우저) — 업로드는 소스(브라우저)에서 페이싱해야 cloudflared 인바운드가
      // 회선을 포화시키지 않는다. 작은 청크를 케이던스로 띄워 평균속도를 제한(짧은 버스트+간격 → MC 보호).
      // 시작은 역할 기본레벨(user 1 / creator+ 2 MB/s — 보수적), 첫 청크 응답부터 서버 QoS 몫(rateBps)을 따른다.
      const uploadRate = clientUploadBytesPerSec() * (speedMultiplier > 0 ? speedMultiplier : 1);
      const cadence = makeCadence(uploadRate);
      setProgress(0);
      for (let i = 0; i < chunkCount; i++) {
        const start = i * UPLOAD_CHUNK_SIZE;
        const blob = file.slice(start, Math.min(start + UPLOAD_CHUNK_SIZE, file.size));
        const qs = new URLSearchParams({
          name,
          uploadId,
          chunkIndex: String(i),
          chunkCount: String(chunkCount),
          chunkStart: String(start),
          totalSize: String(file.size),
        });
        if (icon) qs.set("icon", icon);

        await cadence.wait(blob.size); // 이 청크 전송 전 케이던스 대기(평균 송신속도 제한). 재시도엔 추가 대기 없음.

        // 조각 전송 — 최대 3회 재시도. 4xx(용량/검증)는 즉시 중단, 5xx·네트워크오류·본문유실은 재전송한다
        // (멱등: 서버가 같은 오프셋에 덮어씀. 마지막 조각은 완료 마커로 재삽입 없이 원래 결과를 돌려준다).
        let json: { success?: boolean; error?: string; rateBps?: number } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          let r: Response;
          // 멈춘 연결이 무한 대기하지 않도록 AbortController 로 상한(작은 청크라 정상 전송은 그 안에 완료).
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(), 120_000);
          try {
            r = await fetch(`/api/world/import?${qs.toString()}`, { method: "POST", body: blob, signal: ac.signal });
          } catch {
            continue; // 네트워크 오류/타임아웃 → 재시도
          } finally {
            clearTimeout(to);
          }
          if (r.status >= 400 && r.status < 500) {
            json = await r.json().catch(() => ({ success: false, error: "월드 삽입에 실패했습니다." }));
            break; // 재시도 무의미한 클라이언트 오류 — 메시지 표시 후 중단
          }
          if (!r.ok) continue; // 5xx → 재시도
          try {
            json = await r.json(); // 200 — 본문 파싱 성공하면 확정
            break;
          } catch {
            continue; // 200 인데 본문 유실/잘림 → 재전송(마지막 조각은 마커로 성공 복구)
          }
        }
        if (!json) {
          setError("업로드 중 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (!json.success) {
          setError(json.error || "월드 삽입에 실패했습니다.");
          return;
        }
        // 서버 QoS 동적 할당 반영 — 다음 청크부터 이 몫으로 송신(혼자면 총 대역 전체, 혼잡 시 가중 1/n).
        if (typeof json.rateBps === "number") {
          cadence.setRate(json.rateBps);
          setLiveBps(json.rateBps);
        }
        setProgress(Math.round(((i + 1) / chunkCount) * 100));

        if (i === chunkCount - 1) {
          // 성공을 클라이언트가 실제로 확인한 시점 — 지문 키 삭제(이후 같은 파일 재업로드 = 새 월드).
          clearStoredUploadId(file);
          uploadIdRef.current = null;
          onDone();
          onClose();
        }
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
            <div className="space-y-4">
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

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-bold">
                    <Castle size={13} /> 구조물 생성
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                    {structures
                      ? "마을·전초기지·사원 등 자연 구조물이 생성됩니다."
                      : "마을 등 구조물 없이 깨끗한 맵으로 생성됩니다."}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={structures}
                  onClick={() => setStructures((v) => !v)}
                  title="구조물 생성 토글"
                  className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    structures ? "bg-black" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      structures ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>
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
                {...dropProps}
                className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed text-sm transition-colors ${
                  dragging
                    ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                    : file
                      ? "border-emerald-300 bg-emerald-50/40 text-neutral-700"
                      : "border-neutral-300 hover:border-neutral-500 text-neutral-600"
                }`}
              >
                <Upload size={15} />
                {dragging ? (
                  "여기에 놓아 업로드"
                ) : file ? (
                  <span className="truncate">
                    {file.name} <span className="text-neutral-400">({formatBytes(file.size)})</span>
                  </span>
                ) : (
                  "월드 폴더를 압축한 .zip 선택 또는 드래그"
                )}
              </button>
              {file ? (
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  예상 업로드 시간 <span className="font-semibold">{etaRangeText(file.size, UPLOAD_ETA_BPS, speedMultiplier)}</span>
                  <span className="text-neutral-400"> · 서버 보호를 위해 속도가 자동 조절됩니다{speedMultiplier > 1 ? " (혼잡 시 크리에이터 2배 지분)" : ""}</span>
                </p>
              ) : (
                <p className="text-[11px] text-neutral-400 mt-1.5">level.dat 이 포함된 월드 폴더를 zip 으로 압축해 이 영역에 끌어다 놓거나 클릭해 업로드하세요.</p>
              )}
            </div>
          )}

          <IconPicker value={icon} onChange={setIcon} />

          {progress !== null && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-bold mb-1">
                <span>업로드 중… (큰 월드는 시간이 걸립니다)</span>
                <span>
                  {liveBps !== null && <span className="text-neutral-400 font-medium">{(liveBps / 1048576).toFixed(1)} MB/s · </span>}
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

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

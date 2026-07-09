"use client";

import { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import { Loader2, Upload, Download, Trash2, FileBox, ShieldAlert, CheckCircle2, Clock, Share2, Users, X, Eye, Pencil, HardDrive, ArrowLeftRight, Folder, FolderPlus, ChevronRight, FolderInput, CornerLeftUp, CheckSquare, Square } from "lucide-react";
import {
  getMySchematics,
  deleteSchematicAction,
  convertSchematicAction,
  createSchematicFolderAction,
  deleteSchematicFolderAction,
  moveSchematicsAction,
  deleteSchematicsAction,
  getSchemFolderTree,
  shareSchematicAction,
  unshareSchematicAction,
  setSharePermAction,
  getMyShares,
  getSharedWithMe,
} from "@/app/actions/schematics";
import { formatBytes } from "@/lib/worldQuota";
import { useFileDrop } from "@/lib/useFileDrop";
import McAvatar from "./McAvatar";

interface SchemFile {
  name: string; // basename
  path: string; // 루트 기준 상대경로(폴더 포함) — 작업 식별자
  bytes: number;
  mtime: number;
}
type SelItem = { path: string; isFolder: boolean };
interface ShareGrant {
  granteeId: string;
  perm: string;
  name: string;
  uuid: string | null;
}
interface SharedFolder {
  ownerId: string;
  perm: string;
  canWrite: boolean;
  ownerName: string;
  ownerUuid: string | null;
  files: SchemFile[];
}

const UP_TARGET = "up"; // 상위 폴더 드롭 타깃 식별자(폴더 경로와 충돌 불가)

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function dlHref(relPath: string, ownerId?: string): string {
  const q = new URLSearchParams({ name: relPath });
  if (ownerId) q.set("owner", ownerId);
  return `/api/schematic/download?${q.toString()}`;
}

/** 변환 버튼 라벨(상대 포맷). .schem/.schematic → ".bp", .bp → ".schem". 변환 불가 시 null. */
function convertTargetLabel(name: string): string | null {
  const l = name.toLowerCase();
  if (l.endsWith(".schem") || l.endsWith(".schematic")) return "→ .bp";
  if (l.endsWith(".bp")) return "→ .schem";
  return null;
}

/** 상대경로의 폴더 부분(공유 평면 목록·드롭 검사용). 루트면 "". */
function folderOf(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i >= 0 ? relPath.slice(0, i) : "";
}

/** 파일 한 줄(내 폴더 / 공유 폴더 공용). selectable=체크박스, onDragStart=드래그 이동(내 폴더만). */
function FileRow({ file, href, pathLabel, selectable, checked, onToggle, onDragStart, onDelete, deleting, onConvert, converting, convertLabel }: {
  file: SchemFile; href: string; pathLabel?: string;
  selectable?: boolean; checked?: boolean; onToggle?: () => void; onDragStart?: (e: DragEvent) => void;
  onDelete?: () => void; deleting?: boolean;
  onConvert?: () => void; converting?: boolean; convertLabel?: string | null;
}) {
  return (
    <div draggable={!!onDragStart} onDragStart={onDragStart} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
      {selectable && (
        <button onClick={onToggle} className="shrink-0" title="선택">
          {checked ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-neutral-300 hover:text-neutral-500" />}
        </button>
      )}
      <FileBox size={16} className="text-neutral-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-neutral-900 truncate">{file.name}</div>
        <div className="text-[11px] text-neutral-400 truncate">
          {pathLabel ? <span className="text-neutral-400">📁 {pathLabel} · </span> : null}
          {formatBytes(file.bytes)} · {fmtDate(file.mtime)}
        </div>
      </div>
      {onConvert && convertLabel && (
        <button
          onClick={onConvert}
          disabled={converting}
          title={`${convertLabel} 형식으로 변환`}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 hover:border-indigo-400 text-indigo-600 text-[11px] font-bold rounded-lg shrink-0 disabled:opacity-50"
        >
          {converting ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />} {convertLabel}
        </button>
      )}
      <a href={href} draggable={false} className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 hover:border-black text-neutral-700 text-[11px] font-bold rounded-lg shrink-0">
        <Download size={12} /> 다운로드
      </a>
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-lg shrink-0 disabled:opacity-50"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      )}
    </div>
  );
}

export default function SchematicsView() {
  const [files, setFiles] = useState<SchemFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const pathRef = useRef(""); // 변경(업로드/삭제 등) 후 현재 폴더 새로고침용(stale 클로저 방지)
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadOwner, setUploadOwner] = useState<string | null>(null); // 공유 폴더 업로드 중인 ownerId
  const [busy, setBusy] = useState<string | null>(null); // 삭제 중인 키
  const [converting, setConverting] = useState<string | null>(null); // 변환 중인 키
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [limits, setLimits] = useState({ maxFiles: 200, maxBytes: 25 * 1024 * 1024 });
  const [quota, setQuota] = useState<{ usedBytes: number; totalBytes: number | null; state: string } | null>(null); // 월드 클라우드와 공동 풀
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 다중 선택 / 이동 / 드래그앤드롭
  const [selected, setSelected] = useState<SelItem[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFolders, setMoveFolders] = useState<string[]>([]);
  const [moveDest, setMoveDest] = useState("");
  const [moving, setMoving] = useState(false);
  const dragItems = useRef<SelItem[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null); // 드롭 대상 강조(폴더 경로 또는 UP_TARGET)

  // 공유
  const [myShares, setMyShares] = useState<ShareGrant[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedFolder[]>([]);
  const [shareNick, setShareNick] = useState("");
  const [sharePerm, setSharePerm] = useState<"view" | "edit">("view");
  const [sharing, setSharing] = useState(false);
  const [shareBusy, setShareBusy] = useState<string | null>(null); // 변경/해제 중 granteeId

  const load = useCallback(async (targetPath: string) => {
    const [mine, mineShares, shared] = await Promise.all([getMySchematics(targetPath), getMyShares(), getSharedWithMe()]);
    if (mine.success) {
      setFiles((mine.files as SchemFile[]) || []);
      setFolders((mine.folders as string[]) || []);
      setCurrentPath(mine.path || "");
      pathRef.current = mine.path || "";
      setLimits({ maxFiles: mine.maxFiles, maxBytes: mine.maxBytes });
      setQuota(mine.quota ?? null);
      setErr(null);
    } else {
      setErr(mine.error || "스키매틱을 불러오지 못했습니다.");
      setFiles([]);
      setFolders([]);
      setQuota(null);
    }
    setMyShares(mineShares.success ? ((mineShares.shares as ShareGrant[]) || []) : []);
    setSharedWithMe(shared.success ? ((shared.shares as SharedFolder[]) || []) : []);
    setLoading(false);
  }, []);

  const reload = useCallback(() => load(pathRef.current), [load]);
  const navigate = useCallback((targetPath: string) => { setMessage(null); setSelected([]); load(targetPath); }, [load]);

  useEffect(() => {
    load("");
  }, [load]);

  // --- 선택 ---
  const isSelected = (path: string, isFolder: boolean) => selected.some((s) => s.isFolder === isFolder && s.path === path);
  const toggleSelect = (path: string, isFolder: boolean) =>
    setSelected((prev) => (prev.some((s) => s.isFolder === isFolder && s.path === path)
      ? prev.filter((s) => !(s.isFolder === isFolder && s.path === path))
      : [...prev, { path, isFolder }]));
  const clearSel = () => setSelected([]);
  const folderPath = (name: string) => (currentPath ? `${currentPath}/${name}` : name);
  const parentPath = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) : "";
  const selectedFolderPaths = selected.filter((s) => s.isFolder).map((s) => s.path);
  const isInvalidDest = (f: string) => f === currentPath || selectedFolderPaths.some((sf) => f === sf || f.startsWith(`${sf}/`));

  const handleUpload = async (file: File, ownerId?: string) => {
    if (ownerId) setUploadOwner(ownerId);
    else setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const params = new URLSearchParams();
      if (ownerId) params.set("owner", ownerId); // 공유 폴더 업로드는 소유자 루트로
      else if (currentPath) params.set("path", currentPath); // 내 폴더 업로드는 현재 폴더로
      const qs = params.toString();
      const r = await fetch(`/api/schematic/upload${qs ? `?${qs}` : ""}`, { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.success) {
        setMessage({ type: "success", text: `${j.name} 업로드 완료.` });
        reload();
      } else {
        setMessage({ type: "error", text: j.error || "업로드에 실패했습니다." });
      }
    } catch {
      setMessage({ type: "error", text: "업로드 중 오류가 발생했습니다." });
    }
    if (ownerId) setUploadOwner(null);
    else setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  // 외부 파일 드래그앤드롭 업로드(현재 폴더로). 여러 개면 순차 업로드. 내부 이동 DnD(파일 아님)와 충돌 없음.
  const handleUploadFiles = async (droppedFiles: File[]) => {
    for (const f of droppedFiles) {
      const l = f.name.toLowerCase();
      if (!l.endsWith(".schem") && !l.endsWith(".schematic") && !l.endsWith(".bp")) {
        setMessage({ type: "error", text: `${f.name}: .schem · .bp 파일만 업로드할 수 있습니다.` });
        continue;
      }
      await handleUpload(f);
    }
  };
  const { dragging: fileDragging, dropProps: fileDropProps } = useFileDrop(handleUploadFiles, uploading || !!err);

  const handleDelete = async (relPath: string, ownerId?: string) => {
    if (!confirm(`${relPath.split("/").pop()} 을(를) 삭제하시겠습니까? (되돌릴 수 없음)`)) return;
    setBusy(`${ownerId || ""}|${relPath}`);
    setMessage(null);
    const res = await deleteSchematicAction(relPath, ownerId);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "삭제했습니다." });
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "삭제에 실패했습니다." });
    }
    setBusy(null);
  };

  const handleConvert = async (relPath: string, ownerId?: string) => {
    setConverting(`${ownerId || ""}|${relPath}`);
    setMessage(null);
    const res = await convertSchematicAction(relPath, ownerId);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "변환했습니다." });
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "변환에 실패했습니다." });
    }
    setConverting(null);
  };

  const handleNewFolder = async () => {
    const name = prompt("새 폴더 이름");
    if (!name || !name.trim()) return;
    setMessage(null);
    const res = await createSchematicFolderAction(currentPath, name.trim());
    if (res.success) {
      setMessage({ type: "success", text: res.message || "폴더를 만들었습니다." });
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "폴더 생성에 실패했습니다." });
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`'${folderName}' 폴더와 그 안의 모든 파일을 삭제하시겠습니까? (되돌릴 수 없음)`)) return;
    const rel = folderPath(folderName);
    setBusy(`folder|${rel}`);
    setMessage(null);
    const res = await deleteSchematicFolderAction(rel);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "폴더를 삭제했습니다." });
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "폴더 삭제에 실패했습니다." });
    }
    setBusy(null);
  };

  // --- 이동(모달 + 드래그앤드롭) ---
  const openMoveModal = async () => {
    if (selected.length === 0) return;
    setMoveDest("");
    setMoveOpen(true);
    const res = await getSchemFolderTree();
    setMoveFolders(res.success ? res.folders : []);
  };
  const doMove = async (dest: string, items?: SelItem[]) => {
    const payload = items ?? selected;
    if (payload.length === 0) return;
    setMoving(true);
    setMessage(null);
    const res = await moveSchematicsAction(payload, dest);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "이동했습니다." });
      clearSel();
      setMoveOpen(false);
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "이동에 실패했습니다." });
    }
    setMoving(false);
  };
  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`${selected.length}개 항목을 삭제하시겠습니까? (폴더는 안의 파일까지 · 되돌릴 수 없음)`)) return;
    setMessage(null);
    const res = await deleteSchematicsAction(selected);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "삭제했습니다." });
      clearSel();
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "삭제에 실패했습니다." });
    }
  };
  const onDragStartItem = (e: DragEvent, item: SelItem) => {
    const inSel = selected.some((s) => s.isFolder === item.isFolder && s.path === item.path);
    dragItems.current = inSel && selected.length > 0 ? selected : [item];
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", item.path); } catch { /* ignore */ }
  };
  const onDropTo = (destFolder: string) => {
    const items = dragItems.current;
    dragItems.current = [];
    setDragOver(null);
    if (items.length === 0) return;
    const valid = items.filter((it) => {
      if (it.isFolder && (destFolder === it.path || destFolder.startsWith(`${it.path}/`))) return false; // 자기/하위
      if (folderOf(it.path) === destFolder) return false; // 이미 거기
      return true;
    });
    if (valid.length === 0) {
      setMessage({ type: "error", text: "그 위치로는 이동할 수 없습니다." });
      return;
    }
    doMove(destFolder, valid);
  };

  const handleShare = async () => {
    const nick = shareNick.trim();
    if (!nick) return;
    setSharing(true);
    setMessage(null);
    const res = await shareSchematicAction(nick, sharePerm);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "공유했습니다." });
      setShareNick("");
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "공유에 실패했습니다." });
    }
    setSharing(false);
  };

  const handleSetPerm = async (granteeId: string, perm: "view" | "edit") => {
    setShareBusy(granteeId);
    setMessage(null);
    const res = await setSharePermAction(granteeId, perm);
    if (res.success) reload();
    else setMessage({ type: "error", text: res.error || "권한 변경에 실패했습니다." });
    setShareBusy(null);
  };

  const handleUnshare = async (granteeId: string, name: string) => {
    if (!confirm(`${name} 님과의 공유를 해제하시겠습니까?`)) return;
    setShareBusy(granteeId);
    setMessage(null);
    const res = await unshareSchematicAction(granteeId);
    if (res.success) {
      setMessage({ type: "success", text: res.message || "공유를 해제했습니다." });
      reload();
    } else {
      setMessage({ type: "error", text: res.error || "해제에 실패했습니다." });
    }
    setShareBusy(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-400 text-sm gap-2">
        <Loader2 size={18} className="animate-spin" /> 스키매틱을 불러오는 중...
      </div>
    );
  }

  const segs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
            <FileBox size={16} className="text-neutral-500" /> 스키매틱 클라우드
          </h2>
          <p className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
            <Clock size={11} /> .schem · .bp(Axiom) 저장·상호변환 · 폴더 관리(이동·드래그) · 90일 미접속 자동삭제 · 최대 {limits.maxFiles}개 · 파일당 {formatBytes(limits.maxBytes)}
          </p>
        </div>
        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${uploading ? "bg-neutral-300 text-white" : "bg-black hover:bg-neutral-800 text-white"}`}>
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "업로드 중..." : "업로드"}
          <input
            ref={inputRef}
            type="file"
            accept=".schem,.schematic,.bp"
            className="hidden"
            disabled={uploading || !!err}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
        </label>
      </div>

      {quota && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500 mb-1.5">
            <span className="flex items-center gap-1">
              <HardDrive size={11} /> 클라우드 용량 <span className="text-neutral-400">· 월드와 공동</span>
            </span>
            <span>{formatBytes(quota.usedBytes)} / {quota.totalBytes === null ? "무제한" : formatBytes(quota.totalBytes)}</span>
          </div>
          {quota.totalBytes !== null && (
            <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${quota.usedBytes / quota.totalBytes > 0.9 ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, (quota.usedBytes / quota.totalBytes) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
          {message.type === "success" ? <CheckCircle2 size={14} className="mt-px" /> : <ShieldAlert size={14} className="mt-px" />}
          <span>{message.text}</span>
        </div>
      )}

      {err ? (
        <div className="text-center p-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl">
          <FileBox className="mx-auto text-neutral-300 mb-2" size={28} />
          <p className="text-sm text-neutral-500">{err}</p>
        </div>
      ) : (
        <>
          {/* 내 스키매틱 — 폴더 내비게이션 + 다중선택/이동/드래그 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[12px] text-neutral-500 min-w-0 overflow-x-auto">
                <button onClick={() => navigate("")} className={`px-1.5 py-0.5 rounded font-bold hover:bg-neutral-100 ${segs.length === 0 ? "text-neutral-900" : "text-neutral-500"}`}>루트</button>
                {segs.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    <ChevronRight size={12} className="text-neutral-300" />
                    <button onClick={() => navigate(segs.slice(0, i + 1).join("/"))} className={`px-1.5 py-0.5 rounded hover:bg-neutral-100 ${i === segs.length - 1 ? "text-neutral-900 font-bold" : "text-neutral-500"}`}>{s}</button>
                  </span>
                ))}
              </div>
              <button onClick={handleNewFolder} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-200 hover:border-black text-neutral-700 text-[11px] font-bold rounded-lg shrink-0">
                <FolderPlus size={13} /> 새 폴더
              </button>
            </div>

            {/* 파일 드래그앤드롭 업로드 존 (현재 폴더로) */}
            <div
              {...fileDropProps}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed text-[12px] transition-colors ${
                fileDragging ? "border-indigo-400 bg-indigo-50 text-indigo-600 font-bold" : "border-neutral-200 text-neutral-400"
              }`}
            >
              <Upload size={14} /> {fileDragging ? "여기에 놓아 업로드" : ".schem · .bp 파일을 이 영역에 드래그해 업로드 (현재 폴더)"}
            </div>

            {/* 선택 바 */}
            {selected.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-[12px]">
                <span className="font-bold text-indigo-700">{selected.length}개 선택됨</span>
                <button onClick={openMoveModal} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100">
                  <FolderInput size={12} /> 이동
                </button>
                <button onClick={handleBulkDelete} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50">
                  <Trash2 size={12} /> 삭제
                </button>
                <button onClick={clearSel} className="ml-auto text-neutral-500 hover:text-neutral-800 font-medium">선택 해제</button>
              </div>
            )}

            {/* 상위 폴더 드롭/이동 타깃 */}
            {currentPath && (
              <div
                onClick={() => navigate(parentPath)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(UP_TARGET); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); onDropTo(parentPath); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed cursor-pointer text-[12px] transition-colors ${dragOver === UP_TARGET ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
              >
                <CornerLeftUp size={14} /> 상위 폴더로 <span className="text-neutral-400">(여기에 드롭하면 위로 이동)</span>
              </div>
            )}

            {folders.length === 0 && files.length === 0 ? (
              <div className="text-center p-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl">
                <FileBox className="mx-auto text-neutral-300 mb-2" size={28} />
                <p className="text-sm text-neutral-500">이 폴더가 비어 있습니다.</p>
                <p className="text-xs text-neutral-400 mt-1">파일을 업로드하거나 새 폴더를 만드세요.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
                {folders.map((name) => {
                  const fp = folderPath(name);
                  const over = dragOver === fp;
                  const delKey = `folder|${fp}`;
                  return (
                    <div
                      key={`d/${name}`}
                      draggable
                      onDragStart={(e) => onDragStartItem(e, { path: fp, isFolder: true })}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(fp); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => { e.preventDefault(); onDropTo(fp); }}
                      className={`flex items-center gap-3 px-4 py-2.5 ${over ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : "hover:bg-neutral-50"}`}
                    >
                      <button onClick={() => toggleSelect(fp, true)} className="shrink-0" title="선택">
                        {isSelected(fp, true) ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-neutral-300 hover:text-neutral-500" />}
                      </button>
                      <button onClick={() => navigate(fp)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                        <Folder size={16} className="text-amber-500 shrink-0" />
                        <span className="text-sm font-medium text-neutral-900 truncate">{name}</span>
                        <span className="text-[10px] text-neutral-300 shrink-0">폴더</span>
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(name)}
                        disabled={busy === delKey}
                        title="폴더 삭제(안의 파일까지)"
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-lg shrink-0 disabled:opacity-50"
                      >
                        {busy === delKey ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  );
                })}
                {files.map((f) => (
                  <FileRow
                    key={f.path}
                    file={f}
                    href={dlHref(f.path)}
                    selectable
                    checked={isSelected(f.path, false)}
                    onToggle={() => toggleSelect(f.path, false)}
                    onDragStart={(e) => onDragStartItem(e, { path: f.path, isFolder: false })}
                    onDelete={() => handleDelete(f.path)}
                    deleting={busy === `|${f.path}`}
                    onConvert={() => handleConvert(f.path)}
                    converting={converting === `|${f.path}`}
                    convertLabel={convertTargetLabel(f.name)}
                  />
                ))}
              </div>
            )}
            <p className="text-[11px] text-neutral-400 px-1">💡 체크박스로 여러 개를 골라 이동/삭제하거나, 항목을 폴더(또는 위 “상위 폴더로”)에 드래그해 옮길 수 있어요.</p>
          </div>

          {/* 공유 관리 — 내 폴더를 다른 유저에게 공유 */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Share2 size={15} className="text-neutral-500" /> 공유 관리
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">내 스키매틱 폴더 전체를 다른 유저에게 공유합니다. 보기 = 다운로드만, 편집 = 업로드·삭제·폴더까지.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={shareNick}
                onChange={(e) => setShareNick(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleShare(); }}
                placeholder="마인크래프트 닉네임"
                className="flex-1 min-w-[160px] px-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:border-black focus:outline-none"
              />
              <select
                value={sharePerm}
                onChange={(e) => setSharePerm(e.target.value as "view" | "edit")}
                className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-[12px] font-medium text-neutral-700 focus:border-black focus:outline-none"
              >
                <option value="view">보기 (다운로드)</option>
                <option value="edit">편집 (업로드·삭제)</option>
              </select>
              <button
                onClick={handleShare}
                disabled={sharing || !shareNick.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-black hover:bg-neutral-800 text-white disabled:opacity-40"
              >
                {sharing ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} 공유
              </button>
            </div>

            {myShares.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
                {myShares.map((s) => (
                  <div key={s.granteeId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
                    <McAvatar id={s.uuid} name={s.name} size={24} />
                    <div className="min-w-0 flex-1 text-sm font-medium text-neutral-900 truncate">{s.name}</div>
                    <div className="flex items-center rounded-lg border border-neutral-200 overflow-hidden shrink-0">
                      <button
                        onClick={() => handleSetPerm(s.granteeId, "view")}
                        disabled={shareBusy === s.granteeId}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold ${s.perm === "view" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
                      >
                        <Eye size={11} /> 보기
                      </button>
                      <button
                        onClick={() => handleSetPerm(s.granteeId, "edit")}
                        disabled={shareBusy === s.granteeId}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold ${s.perm === "edit" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
                      >
                        <Pencil size={11} /> 편집
                      </button>
                    </div>
                    <button
                      onClick={() => handleUnshare(s.granteeId, s.name)}
                      disabled={shareBusy === s.granteeId}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 disabled:opacity-50"
                      title="공유 해제"
                    >
                      {shareBusy === s.granteeId ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 공유받은 스키매틱 (폴더 포함 전체 파일) */}
          {sharedWithMe.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Users size={15} className="text-neutral-500" /> 공유받은 스키매틱
              </h3>
              {sharedWithMe.map((folder) => (
                <div key={folder.ownerId} className="rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
                    <McAvatar id={folder.ownerUuid} name={folder.ownerName} size={22} />
                    <div className="min-w-0 flex-1 text-sm font-bold text-neutral-800 truncate">{folder.ownerName}</div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${folder.canWrite ? "bg-amber-100 text-amber-700" : "bg-neutral-200 text-neutral-600"}`}>
                      {folder.canWrite ? <Pencil size={10} /> : <Eye size={10} />} {folder.canWrite ? "편집" : "보기"}
                    </span>
                    {folder.canWrite && (
                      <label className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer shrink-0 ${uploadOwner === folder.ownerId ? "bg-neutral-300 text-white" : "bg-black hover:bg-neutral-800 text-white"}`}>
                        {uploadOwner === folder.ownerId ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                        업로드
                        <input
                          type="file"
                          accept=".schem,.schematic,.bp"
                          className="hidden"
                          disabled={uploadOwner === folder.ownerId}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f, folder.ownerId);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {folder.files.length === 0 ? (
                    <p className="text-xs text-neutral-400 px-4 py-4 text-center">이 폴더에 저장된 스키매틱이 없습니다.</p>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {folder.files.map((f) => (
                        <FileRow
                          key={f.path}
                          file={f}
                          href={dlHref(f.path, folder.ownerId)}
                          pathLabel={folderOf(f.path) || undefined}
                          onDelete={folder.canWrite ? () => handleDelete(f.path, folder.ownerId) : undefined}
                          deleting={busy === `${folder.ownerId}|${f.path}`}
                          onConvert={folder.canWrite ? () => handleConvert(f.path, folder.ownerId) : undefined}
                          converting={converting === `${folder.ownerId}|${f.path}`}
                          convertLabel={folder.canWrite ? convertTargetLabel(f.name) : null}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 이동 대상 폴더 선택 모달 */}
      {moveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !moving && setMoveOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5"><FolderInput size={15} className="text-indigo-600" /> {selected.length}개 이동 — 대상 폴더</h3>
              <button onClick={() => setMoveOpen(false)} disabled={moving} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-50"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto p-2 flex-1 min-h-[140px]">
              {[""].concat(moveFolders).map((f) => {
                const invalid = isInvalidDest(f);
                const depth = f === "" ? 0 : f.split("/").length;
                const label = f === "" ? "루트" : f.split("/").pop();
                return (
                  <button
                    key={f === "" ? "__root" : f}
                    disabled={invalid}
                    onClick={() => setMoveDest(f)}
                    style={{ paddingLeft: 8 + depth * 16 }}
                    className={`w-full text-left flex items-center gap-2 pr-2 py-1.5 rounded-lg text-sm ${moveDest === f ? "bg-indigo-50 text-indigo-700 font-bold" : "text-neutral-700 hover:bg-neutral-50"} ${invalid ? "opacity-30 cursor-not-allowed" : ""}`}
                  >
                    <Folder size={14} className="text-amber-500 shrink-0" /> <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 flex justify-end gap-2">
              <button onClick={() => setMoveOpen(false)} disabled={moving} className="px-3 py-1.5 text-[12px] font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-50">취소</button>
              <button onClick={() => doMove(moveDest)} disabled={moving || isInvalidDest(moveDest)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold bg-black hover:bg-neutral-800 text-white rounded-lg disabled:opacity-40">
                {moving ? <Loader2 size={12} className="animate-spin" /> : <FolderInput size={12} />} 여기로 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

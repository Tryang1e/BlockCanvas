"use client";

import { useState, useEffect } from "react";
import { Archive, PowerOff, Trash2, Download, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";

export type ConfirmType = "backup" | "deactivate" | "delete";

const CONFIRM_CONTENT: Record<ConfirmType, { title: string; body: string; confirm: string; danger: boolean }> = {
  backup: {
    title: "월드 백업",
    body: "이 월드를 지금 백업하시겠습니까? 현재 상태의 백업본(.zip)이 새로 생성됩니다.",
    confirm: "백업",
    danger: false,
  },
  deactivate: {
    title: "월드 비활성화",
    body: "비활성화하면 월드가 서버에서 내려가(unload) 아카이브로 이동합니다. 아카이브 보관 90일이 지나면 자동으로 영구 삭제되며, 그 전에는 언제든 다시 활성화할 수 있습니다. (비활성화 시 백업본이 함께 생성됩니다.)",
    confirm: "비활성화",
    danger: false,
  },
  delete: {
    title: "월드 삭제",
    body: "정말 삭제하시겠습니까? 삭제하면 복구할 수 없습니다. 서버의 월드와 백업본(.zip)이 모두 영구 삭제됩니다.",
    confirm: "영구 삭제",
    danger: true,
  },
};

/** 백업/비활성화/삭제 공용 확인 모달. 실제 동작은 부모(onConfirm)가 수행하고 busy 로 진행 표시. */
export function ConfirmModal({
  type,
  worldName,
  busy,
  onConfirm,
  onClose,
}: {
  type: ConfirmType | null;
  worldName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!type) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [type, busy, onClose]);

  if (!type) return null;
  const c = CONFIRM_CONTENT[type];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.danger ? "bg-rose-50 text-rose-600" : "bg-neutral-100 text-neutral-600"}`}>
              {type === "backup" ? <Archive size={18} /> : type === "deactivate" ? <PowerOff size={18} /> : <Trash2 size={18} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-neutral-900">{c.title}</h2>
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{worldName}</p>
            </div>
          </div>
          <p className="text-sm text-neutral-600 mt-3 leading-relaxed">{c.body}</p>
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button onClick={() => !busy && onClose()} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-bold text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${c.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-black hover:bg-neutral-800"}`}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {c.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 다운로드 모달: 확인 → (백업 후) zip fetch → 다운로드 애니메이션 → 완료. */
export function DownloadModal({
  open,
  worldId,
  worldName,
  onClose,
}: {
  open: boolean;
  worldId: string;
  worldName: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "downloading" | "done" | "error">("confirm");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(() => onClose(), 1800);
      return () => clearTimeout(t);
    }
  }, [phase, onClose]);

  if (!open) return null;

  const start = async () => {
    setPhase("downloading");
    setError(null);
    try {
      const res = await fetch(`/api/world/${worldId}/download`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "다운로드에 실패했습니다.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${worldName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "다운로드 중 오류가 발생했습니다.");
      setPhase("error");
    }
  };

  const canClose = phase !== "downloading";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => canClose && onClose()}>
      <style>{`@keyframes bcdlbar{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}@keyframes bcdlpop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {phase === "confirm" && (
          <>
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                  <Download size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-neutral-900">월드 다운로드</h2>
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">{worldName}</p>
                </div>
              </div>
              <p className="text-sm text-neutral-600 mt-3 leading-relaxed">
                백업본을 만든 뒤 <b>.zip</b> 파일로 다운로드합니다. 월드 크기에 따라 시간이 걸릴 수 있습니다.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm font-bold text-neutral-500 hover:bg-neutral-100">
                취소
              </button>
              <button onClick={start} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-sm font-bold">
                <Download size={15} /> 다운로드
              </button>
            </div>
          </>
        )}

        {phase === "downloading" && (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4">
              <Download size={26} className="animate-bounce" />
            </div>
            <p className="text-sm font-bold text-neutral-900">백업 후 다운로드 중...</p>
            <p className="text-xs text-neutral-400 mt-1">잠시만 기다려 주세요.</p>
            <div className="mt-4 w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-neutral-900" style={{ animation: "bcdlbar 1.1s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            <div className="text-emerald-500 mb-3" style={{ animation: "bcdlpop .35s ease-out" }}>
              <CheckCircle2 size={48} />
            </div>
            <p className="text-sm font-bold text-neutral-900">다운로드 완료!</p>
            <p className="text-xs text-neutral-400 mt-1">{worldName}.zip</p>
          </div>
        )}

        {phase === "error" && (
          <div className="px-6 py-7 flex flex-col items-center text-center">
            <ShieldAlert size={36} className="text-rose-500 mb-2" />
            <p className="text-sm font-bold text-neutral-900">다운로드 실패</p>
            <p className="text-xs text-rose-600 mt-1">{error}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm font-bold text-neutral-500 hover:bg-neutral-100">
                닫기
              </button>
              <button onClick={start} className="px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-sm font-bold">
                다시 시도
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

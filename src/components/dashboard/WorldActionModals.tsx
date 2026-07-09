"use client";

import { useState, useEffect } from "react";
import { Archive, PowerOff, Trash2, Download, Loader2, CheckCircle2, ShieldAlert, ShieldCheck, AlertTriangle, Compass, X } from "lucide-react";
import { formatBytes } from "@/lib/worldQuota";
import { etaRangeText, DOWNLOAD_ETA_BPS } from "@/lib/transferEta";

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

/** 다운로드 모달: 백업 목록(날짜)에서 선택 또는 즉시 백업 → zip fetch → 다운로드 애니메이션 → 완료. */
export function DownloadModal({
  open,
  worldId,
  worldName,
  active,
  backups,
  worldSizeBytes,
  speedMultiplier = 1,
  onClose,
  onRefresh,
}: {
  open: boolean;
  worldId: string;
  worldName: string;
  active: boolean;
  backups: { ts: number; bytes: number }[];
  worldSizeBytes?: number;
  speedMultiplier?: number; // 등급 배수(creator 이상 2) — ETA 표시에 반영
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [phase, setPhase] = useState<"list" | "downloading" | "done" | "error">("list");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("list");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(() => onClose(), 1600);
      return () => clearTimeout(t);
    }
  }, [phase, onClose]);

  if (!open) return null;

  // ts=null 이면 새 백업 후 다운로드(활성 월드), ts 지정 시 해당 날짜 백업 다운로드.
  const start = async (ts: number | null) => {
    setPhase("downloading");
    setError(null);
    try {
      const url = ts ? `/api/world/${worldId}/download?ts=${ts}` : `/api/world/${worldId}/download`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "다운로드에 실패했습니다.");
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${worldName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
      if (!ts && onRefresh) onRefresh(); // 새 백업 생성됨 → 목록 갱신
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "다운로드 중 오류가 발생했습니다.");
      setPhase("error");
    }
  };

  const canClose = phase !== "downloading";
  const fmtTs = (ts: number) =>
    new Date(ts).toLocaleString("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => canClose && onClose()}>
      <style>{`@keyframes bcdlbar{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}@keyframes bcdlpop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {phase === "list" && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                  <Download size={17} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-neutral-900">월드 다운로드</h2>
                  <p className="text-[11px] text-neutral-400 truncate">{worldName}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" title="닫기">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {active && (
                <div>
                  <button
                    onClick={() => start(null)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-bold"
                  >
                    <Archive size={15} /> 지금 백업 후 다운로드
                  </button>
                  {(() => {
                    const est = worldSizeBytes ?? backups[0]?.bytes ?? 0;
                    return est > 0 ? (
                      <p className="text-[11px] text-neutral-400 text-center mt-1.5">
                        예상 다운로드 시간 {etaRangeText(est, DOWNLOAD_ETA_BPS, speedMultiplier)}
                        {speedMultiplier > 1 ? " (혼잡 시 크리에이터 2배 지분)" : ""}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
              <div>
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">백업 목록 (최대 5개)</div>
                {backups.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-3 text-center">
                    {active ? "아직 백업이 없습니다. 위 버튼으로 새로 만드세요." : "다운로드할 백업이 없습니다."}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {backups.map((b, i) => (
                      <button
                        key={b.ts}
                        onClick={() => start(b.ts)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-neutral-800 truncate">
                            {fmtTs(b.ts)} {i === 0 && <span className="text-[10px] text-emerald-600 font-bold">최신</span>}
                          </span>
                          <span className="block text-[11px] text-neutral-400">{formatBytes(b.bytes)} · 예상 {etaRangeText(b.bytes, DOWNLOAD_ETA_BPS, speedMultiplier)}</span>
                        </span>
                        <Download size={14} className="text-neutral-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {phase === "downloading" && (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4">
              <Download size={26} className="animate-bounce" />
            </div>
            <p className="text-sm font-bold text-neutral-900">다운로드 준비 중...</p>
            <p className="text-xs text-neutral-400 mt-1">백업 압축/전송 중입니다. 잠시만 기다려 주세요.</p>
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
              <button onClick={() => setPhase("list")} className="px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-sm font-bold">
                목록으로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 탐방 공유를 "켤 때"만 뜨는 사전 안내/경고 모달.
 * 무엇이 보호되고(서버 측 수정·편집·복사 차단) 무엇을 막을 수 없는지(클라이언트 측 월드 다운로더·리트매티카)를
 * 정직하게 고지한다. 실제 공유 토글은 onConfirm 이 수행하고 busy 로 진행을 표시한다. 끄기는 이 모달을 거치지 않는다.
 */
export function ExploreShareWarningModal({
  open,
  worldName,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  worldName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-share-warning-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
              <Compass size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="explore-share-warning-title" className="text-base font-bold text-neutral-900">탐방 공유를 켜기 전에</h2>
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{worldName}</p>
            </div>
          </div>

          <p className="text-sm text-neutral-600 mt-3 leading-relaxed">
            탐방 공유를 켜면 초대하지 않은 다른 유저도 인게임 <b>/탐방</b> 에서 이 월드를 둘러볼 수 있어요.
          </p>

          {/* 보호되는 것 — 서버가 강제로 막아 주는 범위(일반 방문자 기준, OP 제외) */}
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-700">
              <ShieldCheck size={15} /> 이건 안전해요
            </div>
            <p className="text-[12px] leading-relaxed text-emerald-900/80 mt-1">
              초대하지 않은 방문자는 이 월드의 블록을 <b>수정하거나 편집할 수 없어요.</b> 서버 안에서 지형을 복사하는 도구(WorldEdit <b>//copy</b>·Axiom 복사)도 차단됩니다. 방문자는 오직 <b>둘러보기</b>만 할 수 있어요.
            </p>
          </div>

          {/* 막을 수 없는 것 — 클라이언트에서 동작해 서버가 통제할 수 없는 범위. 리트매티카가 대표 예시(WDL은 AntiWorldDownloader로 차단됨). */}
          <div className="mt-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-amber-700">
              <AlertTriangle size={15} /> 이건 막을 수 없어요
            </div>
            <p className="text-[12px] leading-relaxed text-amber-900/80 mt-1">
              다만 <b>리트매티카(Litematica)</b>처럼 화면에 이미 보이는 지형을 클라이언트에서 그대로 저장하는 도구나 스크린샷·미니맵 캡처는 서버에서 <b>기술적으로 막을 수 없습니다.</b> (구형 월드 다운로더(WDL) 모드는 서버가 감지해 차단하지만, 우회 변종까지 전부 막지는 못해요.) 원치 않는 복제 위험이 있으니 공개 여부를 신중히 결정해 주세요.
            </p>
          </div>

          <p className="text-[11px] text-neutral-400 mt-2.5 leading-snug">※ 서버 관리자(OP)는 위 제한에서 예외입니다.</p>
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button autoFocus onClick={() => !busy && onClose()} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-bold text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            이해했어요, 공유하기
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, X, Flag, ShieldAlert } from "lucide-react";
import { reportBlueprintAction } from "@/app/actions/gallery";

const REASONS: { value: string; label: string }[] = [
  { value: "stolen", label: "도용 — 남의 작품을 무단으로 게시" },
  { value: "inappropriate", label: "부적절한 콘텐츠 (혐오·성적·폭력 등)" },
  { value: "spam", label: "스팸 / 광고 / 도배" },
  { value: "broken", label: "손상되었거나 열리지 않는 파일" },
  { value: "other", label: "기타 이용약관 위반" },
];

export default function ReportModal({ postId, onClose, onDone }: { postId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!reason) return setError("신고 사유를 선택해주세요.");
    setSubmitting(true);
    const r = await reportBlueprintAction(postId, reason, detail);
    if (r.success) {
      onDone(r.message || "신고가 접수되었습니다.");
    } else {
      setError(r.error || "신고에 실패했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
            <Flag size={15} className="text-rose-500" /> 게시물 신고
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-50"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[12px] text-neutral-500">이용약관에 위반되는 건축물을 신고합니다. 관리자가 검토 후 조치합니다.</p>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => { setReason(r.value); setError(null); }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm ${reason === r.value ? "border-rose-300 bg-rose-50 text-rose-700 font-semibold" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${reason === r.value ? "border-rose-500 bg-rose-500" : "border-neutral-300"}`} />
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="상세 설명 (선택)"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:outline-none resize-none"
          />
          {error && (
            <div className="p-2.5 rounded-lg text-xs font-medium flex items-start gap-2 bg-rose-50 text-rose-700 border border-rose-100">
              <ShieldAlert size={14} className="mt-px shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-neutral-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="px-3 py-1.5 text-[12px] font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-50">취소</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-40">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />} 신고하기
          </button>
        </div>
      </div>
    </div>
  );
}

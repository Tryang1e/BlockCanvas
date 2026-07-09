"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Flag, Trash2, Check, ExternalLink, ShieldAlert, CheckCircle2, FileBox } from "lucide-react";
import { adminListBlueprintReports, resolveBlueprintReportAction } from "@/app/actions/gallery";

const REASON_LABEL: Record<string, string> = {
  stolen: "도용",
  inappropriate: "부적절",
  spam: "스팸/광고",
  broken: "손상/오류",
  other: "기타",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기중",
  resolved_removed: "제거됨",
  resolved_dismissed: "기각됨",
};

interface Report {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: number;
  resolvedBy: string | null;
  resolvedAt: number | null;
  reporter: string;
  post: {
    id: string;
    title: string;
    ext: string;
    coverUrl: string | null;
    status: string;
    downloads: number;
    reportCount: number;
    authorName: string;
    authorHandle: string;
  } | null;
}

function fmt(ms: number) {
  try {
    return new Date(ms).toLocaleString("ko-KR");
  } catch {
    return "—";
  }
}

export default function BlueprintReportsClient() {
  const [tab, setTab] = useState<"pending" | "resolved">("pending");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminListBlueprintReports({ status: tab });
    if (r.success) setReports(r.reports as Report[]);
    else setToast({ type: "error", text: r.error || "신고 목록을 불러오지 못했습니다." });
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (reportId: string, action: "remove" | "dismiss") => {
    let note = "";
    if (action === "remove") {
      const input = prompt("제거 사유(작성자에게 전달됩니다):", "이용약관 위반");
      if (input === null) return;
      note = input;
    }
    setBusy(reportId);
    setToast(null);
    const r = await resolveBlueprintReportAction(reportId, action, note);
    if (r.success) {
      setToast({ type: "success", text: r.message || "처리했습니다." });
      await load();
    } else {
      setToast({ type: "error", text: r.error || "처리에 실패했습니다." });
    }
    setBusy(null);
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">블루프린트 신고</h1>
        <p className="text-sm text-neutral-500 mt-1">이용약관 위반으로 신고된 갤러리 게시물을 검토하고 제거/기각합니다.</p>
      </div>

      <div className="flex items-center rounded-xl border border-neutral-200 bg-white overflow-hidden text-sm font-bold w-fit">
        <button onClick={() => setTab("pending")} className={`px-4 py-2 ${tab === "pending" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>
          대기중 {tab === "pending" && pendingCount > 0 ? `(${pendingCount})` : ""}
        </button>
        <button onClick={() => setTab("resolved")} className={`px-4 py-2 ${tab === "resolved" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>처리됨</button>
      </div>

      {toast && (
        <div className={`p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${toast.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
          {toast.type === "success" ? <CheckCircle2 size={15} className="mt-px" /> : <ShieldAlert size={15} className="mt-px" />}
          <span>{toast.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-neutral-400 text-sm">
          <Loader2 size={18} className="animate-spin" /> 불러오는 중...
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-neutral-200 rounded-2xl">
          <Flag className="mx-auto text-neutral-300 mb-2" size={30} />
          <p className="text-sm text-neutral-500">{tab === "pending" ? "대기 중인 신고가 없습니다." : "처리된 신고가 없습니다."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-neutral-200 p-4 flex gap-4">
              <div className="w-20 h-20 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center shrink-0">
                {r.post?.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.post.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FileBox size={26} className="text-neutral-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">{REASON_LABEL[r.reason] || r.reason}</span>
                  {r.post && <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-bold">게시물: {STATUS_LABEL[r.post.status] || r.post.status}</span>}
                  {r.status !== "pending" && <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-bold">{STATUS_LABEL[r.status]}</span>}
                </div>
                <h3 className="text-sm font-bold text-neutral-900 mt-1.5 truncate">{r.post?.title || "(삭제된 게시물)"}</h3>
                <p className="text-[12px] text-neutral-500 mt-0.5">
                  작성자 <b className="text-neutral-700">{r.post?.authorName || "—"}</b> · 신고자 <b className="text-neutral-700">{r.reporter}</b> · {fmt(r.createdAt)}
                  {r.post ? <> · 누적신고 {r.post.reportCount} · 다운로드 {r.post.downloads}</> : null}
                </p>
                {r.detail && <p className="text-[12px] text-neutral-600 mt-1.5 bg-neutral-50 border border-neutral-100 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap">{r.detail}</p>}
                {r.status !== "pending" && r.resolvedBy && (
                  <p className="text-[11px] text-neutral-400 mt-1.5">처리: {r.resolvedBy}{r.resolvedAt ? ` · ${fmt(r.resolvedAt)}` : ""}</p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  {r.post && (
                    <a href={`/gallery/${r.post.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-200 hover:border-black text-neutral-700 text-[11px] font-bold rounded-lg">
                      <ExternalLink size={12} /> 게시물 보기
                    </a>
                  )}
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => act(r.id, "remove")} disabled={busy === r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-lg disabled:opacity-50">
                        {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} 게시물 제거
                      </button>
                      <button onClick={() => act(r.id, "dismiss")} disabled={busy === r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 text-[11px] font-bold rounded-lg disabled:opacity-50">
                        {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 기각
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

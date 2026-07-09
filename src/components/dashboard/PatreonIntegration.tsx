"use client";

import { useState, useEffect } from "react";
import { Heart, RefreshCw, UserMinus, ShieldAlert, CheckCircle2, LogIn, Crown } from "lucide-react";
import { getPatreonStatus, unlinkPatreon } from "@/app/actions/patreon";

interface PatreonStatus {
  linked: boolean;
  patreonName: string | null;
  subscriptionActive: boolean;
  subscriptionDaysLeft: number;
}

const PATREON_COLOR = "#FF424D";

export default function PatreonIntegration({
  patreonLoginUrl = "/api/auth/patreon/start",
}: {
  patreonLoginUrl?: string;
}) {
  const [status, setStatus] = useState<PatreonStatus>({
    linked: false,
    patreonName: null,
    subscriptionActive: false,
    subscriptionDaysLeft: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await getPatreonStatus();
    if (res.success) {
      setStatus({
        linked: res.linked || false,
        patreonName: res.patreonName || null,
        subscriptionActive: res.subscriptionActive || false,
        subscriptionDaysLeft: res.subscriptionDaysLeft || 0,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    // Patreon OAuth 콜백 결과 메시지 처리(/auth 에서 ?connected=patreon 으로 복귀 시)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "patreon") {
        const err = params.get("error"); // 콜백이 대시보드로 되돌린 오류(예: 이미 다른 계정에 연결됨). URLSearchParams 가 이미 디코드함.
        const sub = params.get("sub");
        if (err) {
          setMessage({ type: "error", text: err });
        } else if (sub === "pending") {
          setMessage({
            type: "error",
            text: "Patreon 계정은 연결됐지만 구독 적용에 일시적으로 실패했습니다. 잠시 후 '다시 연결'을 눌러주세요.",
          });
        } else {
          setMessage({
            type: "success",
            text:
              sub === "1"
                ? "Patreon 후원자 인증 완료! 구독 혜택이 적용되었습니다."
                : "Patreon 계정이 연결되었습니다. (아직 활성 후원자가 아니라 구독 혜택은 없습니다. 후원 후 다시 연결하면 자동 적용됩니다.)",
          });
        }
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  const handleUnlink = async () => {
    if (!confirm("정말로 Patreon 연동을 해제하시겠습니까? (이미 적용된 구독 기간은 유지됩니다)")) return;
    setActionLoading(true);
    setMessage(null);
    const res = await unlinkPatreon();
    if (res.success) {
      setStatus({ linked: false, patreonName: null, subscriptionActive: false, subscriptionDaysLeft: 0 });
      setMessage({ type: "success", text: "Patreon 연동이 성공적으로 해제되었습니다." });
    } else {
      setMessage({ type: "error", text: res.error || "연동 해제 중 오류가 발생했습니다." });
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-neutral-50 border border-neutral-100 rounded-xl">
        <RefreshCw className="animate-spin text-neutral-400 mr-2" size={20} />
        <span className="text-neutral-500 font-medium text-sm">연동 정보를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <section className="border-t border-neutral-100 pt-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-neutral-900">
            <Heart size={20} style={{ color: PATREON_COLOR }} />
            Patreon 후원 연동
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Patreon 후원자로 인증하면 <span className="font-semibold" style={{ color: PATREON_COLOR }}>구독 혜택</span>(포트폴리오 사이트·클라우드 용량 등)이 자동으로 적용됩니다.
          </p>
        </div>
        {status.linked && (
          <button
            onClick={handleUnlink}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            <UserMinus size={14} />
            연동 해제
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium mb-6 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={16} className="mt-0.5" /> : <ShieldAlert size={16} className="mt-0.5" />}
          <span>{message.text}</span>
        </div>
      )}

      {status.linked ? (
        <div className="border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style={{ backgroundColor: "#FFF5F5", borderColor: "#FFD6D9" }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: PATREON_COLOR }}>
              <Heart size={22} fill="white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-neutral-900 text-base">{status.patreonName || "Patreon 후원자"}</span>
                <span className="px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase tracking-wide" style={{ backgroundColor: PATREON_COLOR }}>
                  연동됨
                </span>
                {status.subscriptionActive && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1">
                    <Crown size={11} />
                    구독 중
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                {status.subscriptionActive
                  ? `구독 혜택 적용 중 · 약 ${status.subscriptionDaysLeft}일 남음`
                  : "활성 후원자가 아니라 구독 혜택은 적용되지 않았습니다."}
              </p>
            </div>
          </div>
          <div className="text-xs text-neutral-500 font-medium md:text-right">
            후원 상태는 다시 연결할 때 갱신됩니다.
          </div>
        </div>
      ) : (
        <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="font-bold text-neutral-800 text-sm">Patreon 계정으로 후원 인증</span>
            <p className="text-xs text-neutral-500 font-medium">
              Patreon 로그인 한 번으로 후원자 인증이 완료되고, 활성 후원자면 구독이 자동 적용됩니다.
            </p>
          </div>
          <a
            href={patreonLoginUrl}
            className="flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-bold rounded-lg transition-all shadow-sm whitespace-nowrap hover:opacity-90"
            style={{ backgroundColor: PATREON_COLOR }}
          >
            <LogIn size={15} />
            Patreon으로 연결
          </a>
        </div>
      )}
    </section>
  );
}

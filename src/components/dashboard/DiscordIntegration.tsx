"use client";

import { useState, useEffect } from "react";
import { MessageCircle, RefreshCw, UserCheck, UserMinus, ShieldAlert, CheckCircle2, LogIn } from "lucide-react";
import { getDiscordStatus, unlinkDiscord } from "@/app/actions/discord";

interface DiscordStatus {
  linked: boolean;
  discordId: string | null;
  discordUsername: string | null;
}

export default function DiscordIntegration({
  discordLoginUrl = "/api/auth/discord/start",
}: {
  discordLoginUrl?: string;
}) {
  const [status, setStatus] = useState<DiscordStatus>({
    linked: false,
    discordId: null,
    discordUsername: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await getDiscordStatus();
    if (res.success) {
      setStatus({
        linked: res.linked || false,
        discordId: res.discordId || null,
        discordUsername: res.discordUsername || null,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    // Discord OAuth 콜백 결과 메시지 처리(/auth 에서 ?connected=discord 로 복귀 시)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "discord") {
        setMessage({ type: "success", text: "디스코드 계정이 연동되었습니다!" });
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  const handleUnlink = async () => {
    if (!confirm("정말로 디스코드 계정 연동을 해제하시겠습니까?")) return;
    setActionLoading(true);
    setMessage(null);
    const res = await unlinkDiscord();
    if (res.success) {
      setStatus({ linked: false, discordId: null, discordUsername: null });
      setMessage({ type: "success", text: "디스코드 계정이 성공적으로 연동 해제되었습니다." });
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
            <MessageCircle size={20} className="text-indigo-500" />
            디스코드 계정 연동
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            디스코드 계정을 연결하면 봇에서 <code className="text-indigo-600">/홍보</code>·<code className="text-indigo-600">/판매</code> 로 내 영토를 홍보할 수 있습니다.
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
        <div className="bg-indigo-50/40 border border-indigo-100/70 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white">
              <UserCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900 text-base">{status.discordUsername || "디스코드 사용자"}</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded uppercase tracking-wide">
                  연동됨
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-mono mt-1 select-all">{status.discordId}</p>
            </div>
          </div>
          <div className="text-xs text-neutral-500 font-medium md:text-right">
            디스코드 계정이 성공적으로 연결되어 있습니다.
          </div>
        </div>
      ) : (
        <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="font-bold text-neutral-800 text-sm">Discord 계정으로 즉시 연동</span>
            <p className="text-xs text-neutral-500 font-medium">
              Discord 로그인 한 번으로 연동됩니다. 코드 입력이 필요 없습니다.
            </p>
          </div>
          <a
            href={discordLoginUrl}
            className="flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-bold rounded-lg transition-all shadow-sm whitespace-nowrap hover:opacity-90"
            style={{ backgroundColor: "#5865F2" }}
          >
            <LogIn size={15} />
            Discord로 연결
          </a>
        </div>
      )}
    </section>
  );
}

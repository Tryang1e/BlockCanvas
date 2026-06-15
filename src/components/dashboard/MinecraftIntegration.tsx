"use client";

import { useState, useEffect } from "react";
import { Gamepad2, RefreshCw, UserCheck, UserMinus, ShieldAlert, CheckCircle2, UserPlus, Key } from "lucide-react";
import {
  getMinecraftStatus,
  generateVerificationCode,
  unlinkMinecraftAccount,
} from "@/app/actions/minecraft";

interface MinecraftStatus {
  linked: boolean;
  minecraftUuid: string | null;
  minecraftUsername: string | null;
  verificationCode: string | null;
}

export default function MinecraftIntegration() {
  const [status, setStatus] = useState<MinecraftStatus>({
    linked: false,
    minecraftUuid: null,
    minecraftUsername: null,
    verificationCode: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await getMinecraftStatus();
    if (res.success) {
      setStatus({
        linked: res.linked || false,
        minecraftUuid: res.minecraftUuid || null,
        minecraftUsername: res.minecraftUsername || null,
        verificationCode: res.verificationCode || null,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGenerateCode = async () => {
    setActionLoading(true);
    setMessage(null);
    const res = await generateVerificationCode();
    if (res.success && res.code) {
      setStatus((prev) => ({ ...prev, verificationCode: res.code as string }));
      setMessage({ type: "success", text: "새로운 연동 코드가 발급되었습니다." });
    } else {
      setMessage({ type: "error", text: res.error || "코드 발급 중 오류가 발생했습니다." });
    }
    setActionLoading(false);
  };

  const handleUnlink = async () => {
    if (!confirm("정말로 마인크래프트 계정 연동을 해제하시겠습니까?\n연동 해제 시 웹을 통한 플롯 관리 기능이 모두 비활성화됩니다.")) {
      return;
    }
    setActionLoading(true);
    setMessage(null);
    const res = await unlinkMinecraftAccount();
    if (res.success) {
      setStatus({
        linked: false,
        minecraftUuid: null,
        minecraftUsername: null,
        verificationCode: null,
      });
      setMessage({ type: "success", text: "마인크래프트 계정이 성공적으로 연동 해제되었습니다." });
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
            <Gamepad2 size={20} className="text-neutral-700" />
            마인크래프트 인게임 계정 연동
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            마인크래프트 서버와 계정을 연결하여 웹 대시보드에서 영토(Plot) 권한과 소유권을 원격 제어할 수 있습니다.
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
        // Linked State
        <div className="bg-emerald-50/40 border border-emerald-100/70 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <UserCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900 text-base">{status.minecraftUsername}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase tracking-wide">
                  연동됨
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-mono mt-1 select-all">{status.minecraftUuid}</p>
            </div>
          </div>
          <div className="text-xs text-neutral-500 font-medium md:text-right">
            마인크래프트 계정이 성공적으로 연결되어 있습니다.<br />
            이제 웹 대시보드나 디스코드를 통해 영토를 관리하실 수 있습니다.
          </div>
        </div>
      ) : (
        // Unlinked State
        <div className="space-y-4">
          <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="font-bold text-neutral-800 text-sm">연동 코드를 발급하여 인게임 계정을 연결하세요</span>
              <p className="text-xs text-neutral-500 font-medium">
                연동 버튼을 누르면 6자리 인증 번호가 생성됩니다. 인증 번호를 마인크래프트 인게임에서 입력하여 연동을 마칩니다.
              </p>
            </div>
            <button
              onClick={handleGenerateCode}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              <UserPlus size={15} />
              연동 코드 발급하기
            </button>
          </div>

          {status.verificationCode && (
            <div className="bg-neutral-900 text-white rounded-2xl p-8 flex flex-col items-center text-center space-y-4 shadow-md border border-neutral-800 animate-in zoom-in-95 duration-300">
              <div className="p-3 bg-neutral-800 rounded-full text-amber-400">
                <Key size={24} />
              </div>
              <div>
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">마인크래프트 연동 인증코드</span>
                <div className="text-4xl font-black text-white tracking-widest mt-2 select-all font-mono">
                  {status.verificationCode}
                </div>
              </div>
              <div className="max-w-md text-xs text-neutral-400 leading-relaxed font-medium">
                마인크래프트 서버에 접속하신 뒤 아래 명령어를 입력해 주세요:<br />
                <span className="inline-block mt-2 px-3 py-1.5 bg-neutral-800 text-amber-300 rounded font-mono text-xs font-bold border border-neutral-700">
                  /웹연동 {status.verificationCode}
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-medium">
                * 인증번호는 10분간 유효합니다.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

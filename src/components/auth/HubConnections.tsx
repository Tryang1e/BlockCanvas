"use client";

import { useState } from "react";
import { unlinkDiscord } from "@/app/actions/discord";
import { roleLabel } from "@/lib/roles";

interface Props {
  creatorName: string;
  displayName: string | null;
  role: string;
  dashboardHref: string;
  discord: { id: string; username: string | null } | null;
  minecraft: { uuid: string; username: string | null } | null;
  discordConfigured: boolean;
}

export default function HubConnections(props: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const disconnectDiscord = async () => {
    if (!confirm("Discord 연결을 해제할까요?")) return;
    setBusy("discord");
    try {
      const res = await unlinkDiscord();
      if (res?.success) {
        window.location.href = "/auth";
        return;
      }
      alert(res?.error || "연결 해제에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* 로그인된 계정 정체성 */}
      <div className="flex items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-3.5">
        <div className="min-w-0">
          <div className="font-bold text-sm text-neutral-900 dark:text-white truncate">
            {props.displayName || props.creatorName}
          </div>
          <div className="text-xs text-neutral-400 truncate">
            @{props.creatorName} · {roleLabel(props.role)}
          </div>
        </div>
        <a
          href={props.dashboardHref}
          className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          내 대시보드
        </a>
      </div>

      {/* Discord 연결 */}
      <ConnectionCard
        name="Discord"
        color="#5865F2"
        connected={!!props.discord}
        label={props.discord?.username || props.discord?.id || null}
        connectHref="/api/auth/discord/start"
        configured={props.discordConfigured}
        busy={busy === "discord"}
        onDisconnect={disconnectDiscord}
      />

      {/* 마인크래프트 — 연동은 대시보드(Microsoft 로그인/인게임 코드)에서. 허브는 상태 표시만. */}
      <ConnectionCard
        name="Minecraft"
        color="#3AAE4F"
        connected={!!props.minecraft}
        label={props.minecraft?.username || props.minecraft?.uuid || null}
        configured={false}
        note="대시보드에서 연동"
        busy={false}
      />

      <div className="text-center pt-3">
        <a
          href="/api/auth/hub/logout"
          className="text-xs text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          로그아웃
        </a>
      </div>
    </div>
  );
}

function CardShell({
  name,
  color,
  sub,
  children,
}: {
  name: string;
  color: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0 text-sm"
          style={{ backgroundColor: color }}
        >
          {name[0]}
        </span>
        <div className="min-w-0">
          <div className="font-bold text-sm text-neutral-900 dark:text-white">{name}</div>
          <div className="text-xs text-neutral-400 truncate">{sub}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ConnectionCard({
  name,
  color,
  connected,
  label,
  connectHref,
  configured,
  note,
  busy,
  onDisconnect,
}: {
  name: string;
  color: string;
  connected: boolean;
  label: string | null;
  connectHref?: string;
  configured: boolean;
  note?: string;
  busy: boolean;
  onDisconnect?: () => void;
}) {
  return (
    <CardShell name={name} color={color} sub={connected ? label || "연결됨" : "연결 안 됨"}>
      {connected ? (
        onDisconnect ? (
          <button
            onClick={onDisconnect}
            disabled={busy}
            className="text-xs px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? "..." : "해제"}
          </button>
        ) : (
          <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold whitespace-nowrap">연결됨</span>
        )
      ) : configured && connectHref ? (
        <a
          href={connectHref}
          className="text-xs px-3.5 py-2 rounded-xl text-white font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: color }}
        >
          연결
        </a>
      ) : (
        <span className="text-[10px] text-neutral-400 dark:text-neutral-600 whitespace-nowrap">{note || "설정 필요"}</span>
      )}
    </CardShell>
  );
}

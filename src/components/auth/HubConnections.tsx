"use client";

import { useState } from "react";

interface Props {
  discord: { id: string; username: string | null } | null;
  minecraft: { uuid: string; username: string | null } | null;
  bridgedName: string | null;
  creatorSession: string | null;
  discordConfigured: boolean;
  minecraftConfigured: boolean;
}

export default function HubConnections(props: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const disconnect = async (provider: "discord" | "minecraft" | "web") => {
    if (!confirm("이 연결을 해제할까요?")) return;
    setBusy(provider);
    try {
      const res = await fetch("/api/auth/hub/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        window.location.href = "/auth";
        return;
      }
      alert(data?.error || "연결 해제에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const bridge = async () => {
    setBusy("web");
    try {
      const res = await fetch("/api/auth/hub/bridge", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        window.location.href = "/auth?connected=web";
        return;
      }
      alert(data?.error || "웹 계정 연결에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <ConnectionCard
        name="Discord"
        color="#5865F2"
        connected={!!props.discord}
        label={props.discord?.username || props.discord?.id || null}
        connectHref="/api/auth/discord/start"
        configured={props.discordConfigured}
        busy={busy === "discord"}
        onDisconnect={() => disconnect("discord")}
      />
      <ConnectionCard
        name="Minecraft"
        color="#3AAE4F"
        connected={!!props.minecraft}
        label={props.minecraft?.username || props.minecraft?.uuid || null}
        connectHref="/api/auth/minecraft/start?flow=hub"
        configured={props.minecraftConfigured}
        busy={busy === "minecraft"}
        onDisconnect={() => disconnect("minecraft")}
      />

      {/* craftopia 웹 계정 브리지 */}
      {props.bridgedName ? (
        <ConnectionCard
          name="craftopia 웹"
          color="#111827"
          connected
          label={props.bridgedName}
          configured
          busy={busy === "web"}
          onDisconnect={() => disconnect("web")}
        />
      ) : props.creatorSession ? (
        <CardShell name="craftopia 웹" color="#111827" sub={`${props.creatorSession} 계정 감지됨`}>
          <button
            onClick={bridge}
            disabled={busy === "web"}
            className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-bold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {busy === "web" ? "..." : "연결"}
          </button>
        </CardShell>
      ) : (
        <CardShell name="craftopia 웹" color="#111827" sub="연결 안 됨">
          <a
            href="/login"
            className="text-xs px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-950 transition-colors whitespace-nowrap"
          >
            로그인
          </a>
        </CardShell>
      )}

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
  busy,
  onDisconnect,
}: {
  name: string;
  color: string;
  connected: boolean;
  label: string | null;
  connectHref?: string;
  configured: boolean;
  busy: boolean;
  onDisconnect: () => void;
}) {
  return (
    <CardShell name={name} color={color} sub={connected ? label || "연결됨" : "연결 안 됨"}>
      {connected ? (
        <button
          onClick={onDisconnect}
          disabled={busy}
          className="text-xs px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? "..." : "해제"}
        </button>
      ) : configured && connectHref ? (
        <a
          href={connectHref}
          className="text-xs px-3.5 py-2 rounded-xl text-white font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: color }}
        >
          연결
        </a>
      ) : (
        <span className="text-[10px] text-neutral-400 dark:text-neutral-600 whitespace-nowrap">설정 필요</span>
      )}
    </CardShell>
  );
}

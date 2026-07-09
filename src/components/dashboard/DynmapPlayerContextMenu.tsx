"use client";

import { useEffect, useState } from "react";

export interface DynmapPlayerAction {
  label: string;
  run: (player: string) => void;
  danger?: boolean;
}

/**
 * Dynmap iframe(같은 출처 /dynmap-proxy)에서 플레이어를 우클릭하면, 프록시가 주입한 스크립트가
 * parent 로 postMessage({ __bc:'dynmap-player-context', player, x, y }) 를 보낸다.
 * 이 컴포넌트는 자신의 iframe(iframeRef) 에서 온 메시지만 받아 컨텍스트 메뉴를 띄우고 actions 를 실행한다.
 * (플롯 맵 → 플롯 초대/추방, 월드 맵 → 월드 초대/추방 식으로 호출부가 actions 를 주입.)
 */
export default function DynmapPlayerContextMenu({
  iframeRef,
  actions,
  title,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  actions: DynmapPlayerAction[];
  title?: string;
}) {
  const [menu, setMenu] = useState<{ player: string; x: number; y: number } | null>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __bc?: string; player?: string; x?: number; y?: number } | null;
      if (!d || d.__bc !== "dynmap-player-context" || !d.player) return;
      const iframe = iframeRef.current;
      if (!iframe || e.source !== iframe.contentWindow) return; // 내 맵에서 온 것만
      if (actions.length === 0) return; // 실행할 액션 없으면 메뉴 안 띄움
      const r = iframe.getBoundingClientRect();
      const menuW = 200;
      const menuH = 56 + actions.length * 38;
      const x = Math.max(8, Math.min(r.left + (d.x ?? 0), window.innerWidth - menuW - 8));
      const y = Math.max(8, Math.min(r.top + (d.y ?? 0), window.innerHeight - menuH - 8));
      setMenu({ player: d.player, x, y });
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [iframeRef, actions]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // 지도(iframe) 안 클릭은 부모 mousedown 에 안 잡히므로, 주입 스크립트가 보내는 닫기 신호로도 닫는다.
    const onDismiss = (e: MessageEvent) => {
      const d = e.data as { __bc?: string } | null;
      if (d && d.__bc === "dynmap-dismiss") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onDismiss);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onDismiss);
    };
  }, [menu]);

  if (!menu) return null;
  return (
    <div
      className="fixed z-[10000] min-w-[190px] bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-neutral-100 bg-neutral-50">
        <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold">플레이어</div>
        <div className="font-bold text-sm text-neutral-900 truncate">{menu.player}</div>
        {title && <div className="text-[10px] text-neutral-400 truncate mt-0.5">{title}</div>}
      </div>
      <div className="py-1">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => {
              const p = menu.player;
              setMenu(null);
              a.run(p);
            }}
            className={`w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors text-xs font-semibold ${
              a.danger ? "text-rose-600" : "text-neutral-800"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

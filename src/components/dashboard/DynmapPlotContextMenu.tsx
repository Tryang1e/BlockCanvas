"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Loader2, User, Tag } from "lucide-react";

/**
 * Dynmap iframe(같은 출처 /dynmap-proxy)의 플롯 영역 마커를 좌/우클릭하면, 프록시 주입 스크립트가 parent 로
 * postMessage({ __bc:'dynmap-plot-context', plot:<plotId>, status:'empty'|'owned'|'auction', owner, price, x, y }) 를 보낸다.
 * 상태별: 빈(초록) → 구매(claim), 점유(파랑) → 소유자 정보, 경매(주황) → 가격 + 구매(코인 이체).
 */
export default function DynmapPlotContextMenu({
  iframeRef,
  onClaim,
  onBuyAuction,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onClaim: (plotId: string, world: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  onBuyAuction: (plotId: string, world: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}) {
  const [menu, setMenu] = useState<
    { plotId: string; world: string; status: string; owner: string; price: number; x: number; y: number } | null
  >(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __bc?: string; plot?: string; world?: string; status?: string; owner?: string; price?: number; x?: number; y?: number } | null;
      if (!d || d.__bc !== "dynmap-plot-context" || !d.plot) return;
      const iframe = iframeRef.current;
      if (!iframe || e.source !== iframe.contentWindow) return; // 내 맵에서 온 것만
      const r = iframe.getBoundingClientRect();
      const menuW = 220;
      const menuH = 130;
      const x = Math.max(8, Math.min(r.left + (d.x ?? 0), window.innerWidth - menuW - 8));
      const y = Math.max(8, Math.min(r.top + (d.y ?? 0), window.innerHeight - menuH - 8));
      const status = d.status === "owned" ? "owned" : d.status === "auction" ? "auction" : "empty";
      setMenu({ plotId: String(d.plot), world: String(d.world || ""), status, owner: d.owner || "", price: typeof d.price === "number" ? d.price : 0, x, y });
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [iframeRef]);

  useEffect(() => {
    if (!menu) return;
    const close = () => {
      if (!busy) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // 지도(iframe) 안 클릭은 부모 mousedown 에 안 잡히므로, 주입 스크립트의 닫기 신호로도 닫는다.
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
  }, [menu, busy]);

  if (!menu) return null;

  const run = async (fn: (id: string, world: string) => Promise<{ success: boolean }>) => {
    setBusy(true);
    await fn(menu.plotId, menu.world);
    setBusy(false);
    setMenu(null);
  };

  const headerCls =
    menu.status === "auction" ? "bg-amber-50/70" : menu.status === "owned" ? "bg-sky-50/70" : "bg-emerald-50/70";
  const labelCls =
    menu.status === "auction" ? "text-amber-600" : menu.status === "owned" ? "text-sky-600" : "text-emerald-600";
  const title =
    menu.status === "auction" ? "경매 매물" : menu.status === "owned" ? "점유된 플롯" : "구매 가능한 플롯";

  return (
    <div
      className="fixed z-[10000] w-[220px] bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`px-3 py-2 border-b border-neutral-100 ${headerCls}`}>
        <div className={`text-[9px] uppercase tracking-wider font-bold ${labelCls}`}>{title}</div>
        <div className="font-bold text-sm text-neutral-900 truncate font-mono">{menu.plotId}</div>
      </div>
      <div className="p-2">
        {menu.status === "auction" ? (
          <>
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-amber-700 mb-1.5">
              <Tag size={12} /> {menu.price.toLocaleString()} 코인
            </div>
            <button
              onClick={() => run(onBuyAuction)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
              {busy ? "구매 중..." : `구매 ${menu.price.toLocaleString()}코인`}
            </button>
          </>
        ) : menu.status === "owned" ? (
          <div className="flex items-center gap-1.5 px-1 py-1.5 text-xs">
            <User size={13} className="text-sky-500 shrink-0" />
            <span className="text-neutral-400">소유자</span>
            <span className="font-bold text-neutral-800 truncate">{menu.owner || "?"}</span>
          </div>
        ) : (
          <>
            {menu.price > 0 && (
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 mb-1.5">
                <Tag size={12} /> 분양가 {menu.price.toLocaleString()} 코인
              </div>
            )}
            <button
              onClick={() => run(onClaim)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
              {busy ? "구매 중..." : menu.price > 0 ? `구매 ${menu.price.toLocaleString()}코인` : "구매 (claim)"}
            </button>
            <p className="text-[10px] text-neutral-400 text-center mt-1.5 leading-tight">
              {menu.price > 0 ? "코인이 차감되고 소유권을 받습니다." : "연동된 마인크래프트 계정으로 소유권을 받습니다."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

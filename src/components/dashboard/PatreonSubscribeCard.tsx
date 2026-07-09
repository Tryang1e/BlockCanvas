"use client";

import { useEffect, useState } from "react";
import { Heart, ExternalLink, Crown, Link2, RefreshCw } from "lucide-react";
import { getPatreonStatus } from "@/app/actions/patreon";

// 우리 Patreon 캠페인(후원) 페이지. 유저는 여기서 결제(구독)한다.
const PATREON_PAGE_URL = "https://www.patreon.com/cw/BlockCanvas";
const PATREON_COLOR = "#FF424D";

interface Snap {
  linked: boolean;
  patreonName: string | null;
  active: boolean;
  daysLeft: number;
}

/**
 * 대시보드 첫 화면 구독 CTA — 우리 구조(웹훅 없는 OAuth-연결)에 맞춰 순서를 강제한다:
 *   ① 미연결 → 먼저 Patreon 계정 연결(인증). 연결돼 있어야 구독 시 계정 매핑 → 역할·혜택 부여 가능.
 *   ② 연결됨·미구독 → Patreon 페이지에서 구독 → 돌아와 '반영하기'(재연결)로 후원 상태 재확인 → 혜택 적용.
 *   ③ 구독 중 → 상태(남은 일수) 표시.
 * patreonLoginUrl 은 서버에서 authHost 기준으로 만들어 주입(연결/재동기화 공용).
 */
export default function PatreonSubscribeCard({ patreonLoginUrl }: { patreonLoginUrl: string }) {
  const [snap, setSnap] = useState<Snap | null>(null);

  useEffect(() => {
    // async 콜백 안에서만 setState → 마운트 시 동기 setState 회피(불필요 재렌더 없음).
    getPatreonStatus().then((r) => {
      setSnap(
        r.success
          ? {
              linked: !!r.linked,
              patreonName: r.patreonName ?? null,
              active: !!r.subscriptionActive,
              daysLeft: r.subscriptionDaysLeft ?? 0,
            }
          : { linked: false, patreonName: null, active: false, daysLeft: 0 }
      );
    });
  }, []);

  if (!snap) {
    return (
      <div className="rounded-2xl border p-5 flex items-center gap-2" style={{ backgroundColor: "#FFF5F5", borderColor: "#FFD6D9" }}>
        <RefreshCw className="animate-spin" size={16} style={{ color: PATREON_COLOR }} />
        <span className="text-xs font-semibold text-neutral-500">구독 정보를 불러오는 중…</span>
      </div>
    );
  }

  // ③ 구독 중
  if (snap.active) {
    return (
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "#FFF5F5", borderColor: "#FFD6D9" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Crown size={16} style={{ color: PATREON_COLOR }} />
          <span className="text-sm font-bold text-neutral-900">Patreon 구독 중</span>
          <span className="px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase tracking-wide" style={{ backgroundColor: PATREON_COLOR }}>
            활성
          </span>
        </div>
        <p className="text-xs text-neutral-500 font-medium">
          구독 혜택이 적용 중입니다 · 약 <strong className="text-neutral-700">{snap.daysLeft}일</strong> 남음
        </p>
        <a
          href={PATREON_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-400 hover:text-neutral-900 mt-3 transition-colors"
        >
          Patreon에서 관리 <ExternalLink size={11} />
        </a>
      </div>
    );
  }

  // ① 미연결 — 먼저 연결(인증)
  if (!snap.linked) {
    return (
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "#FFF5F5", borderColor: "#FFD6D9" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Heart size={16} style={{ color: PATREON_COLOR }} />
          <span className="text-sm font-bold text-neutral-900">Patreon 후원으로 구독하기</span>
        </div>
        <p className="text-xs text-neutral-500 font-medium leading-relaxed mb-4">
          구독하려면 <strong className="text-neutral-700">먼저 Patreon 계정을 연결</strong>하세요. 연결돼 있어야 구독할 때 역할·혜택이 자동 부여됩니다.
        </p>
        <a
          href={patreonLoginUrl}
          className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:opacity-90"
          style={{ backgroundColor: PATREON_COLOR }}
        >
          <Link2 size={14} />
          Patreon 계정 연결
        </a>
        <p className="text-[10px] text-neutral-400 mt-2 text-center">1단계 — 연결 후 구독 버튼이 열립니다.</p>
      </div>
    );
  }

  // ② 연결됨·미구독 — Patreon 에서 구독 후 반영
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: "#FFF5F5", borderColor: "#FFD6D9" }}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Heart size={16} style={{ color: PATREON_COLOR }} fill={PATREON_COLOR} />
        <span className="text-sm font-bold text-neutral-900">{snap.patreonName || "Patreon"} 연결됨</span>
        <span className="px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase tracking-wide" style={{ backgroundColor: PATREON_COLOR }}>
          연결됨
        </span>
      </div>
      <p className="text-xs text-neutral-500 font-medium leading-relaxed mb-4">
        이제 Patreon에서 구독한 뒤 <strong className="text-neutral-700">‘구독 반영’</strong>을 누르면 혜택이 적용됩니다.
      </p>
      <a
        href={PATREON_PAGE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:opacity-90"
        style={{ backgroundColor: PATREON_COLOR }}
      >
        <ExternalLink size={14} />
        Patreon에서 구독하기
      </a>
      <a
        href={patreonLoginUrl}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-xs font-bold rounded-xl border transition-all hover:bg-white"
        style={{ color: PATREON_COLOR, borderColor: "#FFB3B8" }}
      >
        <RefreshCw size={13} />
        구독했어요 · 반영하기
      </a>
      <p className="text-[10px] text-neutral-400 mt-2 text-center">2단계 — 구독은 새 창에서, 결제 후 ‘반영하기’로 확인하세요.</p>
    </div>
  );
}

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { effectiveQuotaBytes, formatBytes } from "@/lib/worldQuota";
import { subscriptionQuotaBonus } from "@/lib/subscription";

// 인게임 상태창/카드 공용 데이터. uuid(마인크래프트) → 웹 Profile 매칭 → 요약.
// /api/minecraft/status (인게임 상태창 요약) 와 /api/minecraft/status-card (카드 렌더) 가 함께 사용.
// 미연동(uuid 에 매칭되는 Profile 없음) → { linked: false }.

export interface MinecraftStatus {
  linked: boolean;
  creator_name?: string;
  dashboard_url?: string;
  role?: string; // user | creator | official | admin (LP manager→admin)
  world_count?: number;
  world_archived?: number;
  world_invited?: number;
  quota_used?: string; // "158 MB"
  quota_total?: string; // "5 GB" | "무제한"
  quota_unlimited?: boolean;
  quota_pct?: number; // 0~100 (무제한이면 0)
  quota_state?: string; // ok | warned | locked
  plot_count?: number;
}

export async function getMinecraftStatus(uuid: string): Promise<MinecraftStatus> {
  const profile = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid } });
  if (!profile) return { linked: false };

  const worlds = await prisma.minecraftWorld.findMany({
    where: { owner_id: profile.id },
    select: { size_bytes: true, status: true },
  });
  const active = worlds.filter((w) => w.status !== "archived");
  const archived = worlds.filter((w) => w.status === "archived");
  const usedBytes = worlds.reduce((s, w) => s + Number(w.size_bytes), 0);
  const total = effectiveQuotaBytes(profile.role, subscriptionQuotaBonus(profile.subscription_until));
  const unlimited = !Number.isFinite(total);

  const [plotCount, invitedCount] = await Promise.all([
    prisma.minecraftPlot.count({ where: { owner_id: profile.id } }),
    prisma.minecraftWorld.count({
      where: { owner_id: { not: profile.id }, status: { not: "archived" }, trusted_players: { contains: uuid } },
    }),
  ]);

  return {
    linked: true,
    creator_name: profile.creator_name,
    dashboard_url: `https://${profile.creator_name}.craftopia.work/minecraft`,
    role: profile.role,
    world_count: active.length,
    world_archived: archived.length,
    world_invited: invitedCount,
    quota_used: formatBytes(usedBytes),
    quota_total: unlimited ? "무제한" : formatBytes(total),
    quota_unlimited: unlimited,
    quota_pct: unlimited ? 0 : Math.min(100, Math.round((usedBytes / total) * 100)),
    quota_state: profile.world_quota_state || "ok",
    plot_count: plotCount,
  };
}

// 카드 텍스처 내용을 결정하는 필드만의 짧은 서명(hex 16자). 변하면 개인 카드 팩을 다시 보내야 한다는 신호.
// 플러그인이 이 값을 들고 있다가, 직전과 같으면 리소스팩 재전송 없이(=재다운로드 없이) 메뉴만 다시 연다.
// ※ IGN(이름)은 status 에 없어 제외 — 이름 변경은 재접속을 동반하므로 그때 자연히 재전송된다.
// ※ CARD_LAYOUT_VERSION: 카드 이미지의 정적 레이아웃/라벨(버튼 이름 등)을 바꾸면 이 값을 올린다.
//    데이터가 그대로여도 서명이 달라져 배포 직후 1회 팩이 재전송된다(안 그러면 캐시된 옛 라벨이 남는다).
const CARD_LAYOUT_VERSION = 2; // v2: 4번째 버튼 라벨 "영토 메뉴" → "탐방" (2026-07-10)
export function cardSignature(s: MinecraftStatus): string {
  const parts = [
    `v${CARD_LAYOUT_VERSION}`,
    s.role ?? "", s.plot_count ?? 0, s.world_count ?? 0, s.world_invited ?? 0,
    s.quota_used ?? "", s.quota_total ?? "", s.quota_unlimited ? 1 : 0, s.quota_pct ?? 0,
  ];
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

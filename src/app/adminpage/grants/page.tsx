import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { currentAdminIdentity } from "@/lib/admin-auth";
import { isSuperAdmin } from "@/lib/roles";
import { getEconomyConfig } from "@/lib/economyConfig";
import GrantsClient from "./GrantsClient";

export const dynamic = "force-dynamic";

// 어드민 지급/선물 허브 — 유저 다중선택 → 코인·구독권·플롯 확장권 지급(1:1·1:n).
// 🔒 최종 관리자 전용(C-2: 지급은 admin 전용) — 서버 액션(requireSuperAdmin)과 UI 게이트를 페이지 진입에서도 강제.
export default async function AdminGrantsPage() {
  const me = await currentAdminIdentity();
  if (!isSuperAdmin(me?.role)) redirect("/adminpage");

  const [profiles, cfg] = await Promise.all([
    prisma.profile.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true, creator_name: true, display_name: true, role: true,
        minecraft_uuid: true, minecraft_username: true, discord_username: true,
        subscription_until: true, plot_slot_bonus: true, avatar_url: true,
      },
    }),
    getEconomyConfig(),
  ]);

  const users = profiles.map((p) => ({
    id: p.id,
    name: p.creator_name,
    display: p.display_name,
    role: p.role,
    mc: !!p.minecraft_uuid,
    mcName: p.minecraft_username,
    discord: p.discord_username,
    subUntil: p.subscription_until ? p.subscription_until.toISOString() : null,
    plotBonus: p.plot_slot_bonus ?? 0,
    avatar: p.avatar_url,
  }));

  return <GrantsClient users={users} subscriptionDays={cfg.subscriptionDays} plotSlotMax={cfg.plotSlotMax} />;
}

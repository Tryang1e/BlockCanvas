import { getEconomyConfig } from "@/lib/economyConfig";
import { getEconomyStats } from "@/app/actions/economy";
import { currentAdminRole } from "@/lib/admin-auth";
import { isSuperAdmin } from "@/lib/roles";
import EconomyClient from "./EconomyClient";

export const dynamic = "force-dynamic";

// 접근 권한은 상위 adminpage/layout.tsx 에서 staff(admin|manager) 로 게이트. 설정 저장은 최종 관리자만(액션에서 재검증).
export default async function AdminEconomyPage() {
  const [config, statsRes, role] = await Promise.all([getEconomyConfig(), getEconomyStats(), currentAdminRole()]);
  return <EconomyClient config={config} stats={statsRes.success ? statsRes.stats : null} canEdit={isSuperAdmin(role)} />;
}

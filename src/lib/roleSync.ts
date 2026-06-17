import { prisma } from "@/lib/prisma";
import { lpGroupToRole } from "@/lib/roles";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";

/**
 * LuckPerms 그룹 → 웹 role 런타임 동기화.
 * 인게임 접속(PlayerJoin) / 계정 연동(/웹연동) 시 플러그인이 플레이어의 LP 그룹을 push 하면 호출된다.
 *
 * 규칙:
 *  - uuid 에 연동된 Profile 이 없으면 no-op (linked:false).
 *  - 매핑 불가 그룹(default 등) 은 변경 안 함 (reason:"unmapped-group").
 *  - LP 그룹을 단일 진실로 삼아 역할을 그대로 따른다(승급·강등·admin 강등 모두).
 *    creator_name='admin' 슈퍼계정은 role 과 무관하게 어드민 접근이 보장돼(server-auth 바이패스) 잠기지 않음.
 *  - 변경 시 CreatorLog 감사 기록 + 쿼터 재평가(역할 변경 = 한도 변동 → 초과 시 잠금/해제 반영).
 */
export async function syncRoleFromLpGroup(
  uuid: string,
  group: string | null | undefined
): Promise<{ linked: boolean; changed: boolean; role?: string; reason?: string }> {
  const profile = await prisma.profile.findUnique({
    where: { minecraft_uuid: uuid },
    select: { id: true, role: true, creator_name: true },
  });
  if (!profile) return { linked: false, changed: false };

  const mapped = lpGroupToRole(group);
  if (!mapped) {
    return { linked: true, changed: false, role: profile.role, reason: "unmapped-group" };
  }
  if ((profile.role || "").toLowerCase() === mapped) {
    return { linked: true, changed: false, role: mapped };
  }

  // LP = 단일 진실: admin 포함 모든 역할을 LP 그룹에 맞춰 갱신(승급·강등 모두).
  await prisma.profile.update({ where: { id: profile.id }, data: { role: mapped } });

  await prisma.creatorLog
    .create({
      data: {
        creator_name: profile.creator_name,
        action: "ROLE_SYNC",
        details: `LuckPerms 그룹(${group}) 기준 역할 ${profile.role} → ${mapped} 자동 동기화`,
      },
    })
    .catch(() => {});

  // 역할 변경 = 쿼터 한도 변동 → 잠금/해제 상태 재평가(베스트에포트).
  await evaluateQuota(profile.id).catch(() => {});

  return { linked: true, changed: true, role: mapped };
}

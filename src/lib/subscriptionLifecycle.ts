import { prisma } from "@/lib/prisma";

/**
 * 구독 만료 강등 스윕 — '포트폴리오 사이트' 혜택으로 user→creator 승격됐던 유저(role_granted_by_sub=true)
 * 중 구독이 만료된 사람을 다시 user 로 강등한다.
 *  - 효과: 포트폴리오 사이트 게이트가 닫힘(notFound). Project·포트폴리오 데이터는 삭제하지 않음 → 재구독 시 그대로 복원.
 *  - 원래 크리에이터(role_granted_by_sub=false)는 절대 건드리지 않는다.
 *  - 인게임 구독 권한(blockcanvas.subscriber)은 LuckPerms 임시노드라 만료 자동 회수(여기서 안 만짐).
 * 월드 스윕 라우트(/api/world/sweep)에서 주기 호출.
 */
export async function sweepExpiredSubscriptions(): Promise<{ subDemoted: number }> {
  const now = new Date();
  const expired = await prisma.profile.findMany({
    where: { role_granted_by_sub: true, subscription_until: { lt: now } },
    select: { id: true },
  });
  let demoted = 0;
  for (const p of expired) {
    try {
      await prisma.profile.update({
        where: { id: p.id },
        data: { role: "user", role_granted_by_sub: false },
      });
      demoted++;
    } catch {
      /* 개별 실패는 무시(다음 스윕에서 재시도) */
    }
  }
  return { subDemoted: demoted };
}

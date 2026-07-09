import { prisma } from "@/lib/prisma";
import { getEconomyConfig, deliverCoins } from "@/lib/economyConfig";

// 인게임 활동 보상 — 플러그인이 보고한 순설치 블록/누적접속을 웹에서 마일스톤 지급(config·원장 일원화).
// 파밍 방지: 블록은 순설치(설치−파괴) 누적이라 place→break 루프는 net 0. 접속은 단조증가 바닐라 통계라 조작 불가.
// 지급은 deliverCoins(미접속/오프라인이면 미전달로 남겨 접속 시 정산).

/** 순설치 블록 델타 보고 → 누적 갱신 + 마일스톤 지급. netDelta 는 음수(파괴 우세) 가능 → 누적은 0 하한. */
export async function recordBlockReward(uuid: string, netDelta: number): Promise<void> {
  if (!uuid || !Number.isFinite(netDelta) || netDelta === 0) return;
  const profile = await prisma.profile.findUnique({
    where: { minecraft_uuid: uuid },
    select: { id: true, block_net_total: true, block_milestones_paid: true },
  });
  if (!profile) return; // 미연동 UUID 무시

  const cfg = await getEconomyConfig();
  const newTotal = Math.max(0, profile.block_net_total + Math.round(netDelta)); // 0 하한(파괴만 누적 방지)
  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: { block_net_total: newTotal },
    select: { block_milestones_paid: true },
  });

  const newMilestones = Math.floor(newTotal / cfg.blockStep);
  if (newMilestones <= updated.block_milestones_paid || cfg.blockCoin <= 0) return;
  const guard = await prisma.profile.updateMany({
    where: { id: profile.id, block_milestones_paid: { lt: newMilestones } },
    data: { block_milestones_paid: newMilestones },
  });
  if (guard.count === 0) return;

  const bonus = (newMilestones - updated.block_milestones_paid) * cfg.blockCoin;
  if (bonus <= 0) return;
  const { awarded } = await deliverCoins({ profileId: profile.id, minecraftUuid: uuid, amount: bonus, source: "block_place", reason: `블록 순설치 ${newTotal}` });
  if (awarded <= 0) return; // 일일 상한 등으로 실제 지급 0 → 알림 생략
  await prisma.notification
    .create({
      data: {
        recipient_id: profile.id,
        sender_name: "system",
        category: "coin",
        title: "블록 설치 보상",
        body: `블록을 누적 ${newTotal.toLocaleString()}개 설치해 ${awarded} 코인을 받았습니다.`,
        meta: JSON.stringify({ coin: awarded }),
      },
    })
    .catch(() => {});
}

/** 누적접속(분, 단조증가) 보고 → 마일스톤 지급. minutes 는 바닐라 PLAY_ONE_MINUTE 기반 누적치. */
export async function recordPlaytimeReward(uuid: string, minutes: number): Promise<void> {
  if (!uuid || !Number.isFinite(minutes) || minutes <= 0) return;
  const profile = await prisma.profile.findUnique({
    where: { minecraft_uuid: uuid },
    select: { id: true, playtime_milestones_paid: true },
  });
  if (!profile) return;

  const cfg = await getEconomyConfig();
  const newMilestones = Math.floor(minutes / cfg.playtimeStep);
  if (newMilestones <= profile.playtime_milestones_paid || cfg.playtimeCoin <= 0) return;
  const guard = await prisma.profile.updateMany({
    where: { id: profile.id, playtime_milestones_paid: { lt: newMilestones } },
    data: { playtime_milestones_paid: newMilestones },
  });
  if (guard.count === 0) return;

  const bonus = (newMilestones - profile.playtime_milestones_paid) * cfg.playtimeCoin;
  if (bonus <= 0) return;
  const { awarded } = await deliverCoins({ profileId: profile.id, minecraftUuid: uuid, amount: bonus, source: "playtime", reason: `누적접속 ${Math.floor(minutes)}분` });
  if (awarded <= 0) return; // 일일 상한 등으로 실제 지급 0 → 알림 생략
  await prisma.notification
    .create({
      data: {
        recipient_id: profile.id,
        sender_name: "system",
        category: "coin",
        title: "누적접속 보상",
        body: `누적 접속 ${Math.floor(minutes).toLocaleString()}분을 달성해 ${awarded} 코인을 받았습니다.`,
        meta: JSON.stringify({ coin: awarded }),
      },
    })
    .catch(() => {});
}

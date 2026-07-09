import { prisma } from "@/lib/prisma";
import { getGalleryConfig } from "@/lib/blueprintGallery";
import { deliverCoins } from "@/lib/economyConfig";
import { computeMilestoneCoins } from "@/lib/milestoneReward";
import { canUseBuildDashboard } from "@/lib/roles";

/**
 * 반응 보상 대상 포럼 채널 id 목록. env `SHOWCASE_FORUM_CHANNEL_IDS`(콤마 구분).
 * 예: 전시관-showcase 포럼 채널 id. 비어 있으면 포럼 반응 보상은 전부 비활성.
 */
export function getShowcaseForumIds(): string[] {
  return (process.env.SHOWCASE_FORUM_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 일반 포럼 게시물(전시관-showcase 등)의 👍 반응 → 인증 작성자에게 코인.
 * 게이트: ① 부모 채널이 allowlist ② 포럼 게시물 시작 메시지(=message_id===channel_id, 댓글 반응 제외)
 *        ③ 작성자가 canUseBuildDashboard(인증 완료)여야 지급 — 미인증 작성자 글은 지급 X
 *        ④ 작성자 본인 반응 제외.
 * 파밍방지: (message, reactor) unique 원장 + 마일스톤 조건부 지급. 반응 설정(step/coin)은 갤러리와 동일 config 공유.
 */
export async function recordForumReactionAndReward(args: {
  messageId: string;
  channelId: string | null;
  parentId: string | null;
  reactorDiscordId: string;
  authorDiscordId: string | null;
  added: boolean;
}): Promise<void> {
  const { messageId, channelId, parentId, reactorDiscordId, authorDiscordId, added } = args;
  if (!messageId || !reactorDiscordId) return;

  // ① allowlist 포럼 채널만.
  const allowed = getShowcaseForumIds();
  if (!allowed.length || !parentId || !allowed.includes(parentId)) return;
  // ② 포럼 게시물 시작 메시지만(댓글 반응 제외). 포럼 스레드는 시작 메시지 id == 스레드(채널) id.
  if (channelId && messageId !== channelId) return;
  // ③ 작성자 = 인증 회원이어야 지급(미인증/미연동 작성자 글 → 보상 없음).
  if (!authorDiscordId) return;
  const author = await prisma.profile.findFirst({
    where: { discord_id: authorDiscordId },
    select: { id: true, role: true, discord_id: true, discord_in_guild: true, minecraft_uuid: true, email: true, password: true },
  });
  if (!author || !canUseBuildDashboard(author)) return;
  // ④ 작성자 본인 반응 제외.
  const reactor = await prisma.profile.findFirst({ where: { discord_id: reactorDiscordId }, select: { id: true } });
  if (reactor && reactor.id === author.id) return;

  if (!added) {
    // 반응 취소 → 원장 제거 + 카운트 감소(코인 회수·마일스톤 되돌림 없음).
    const del = await prisma.forumReaction.deleteMany({ where: { message_id: messageId, discord_user_id: reactorDiscordId } });
    if (del.count > 0) {
      await prisma.forumReactionPost.updateMany({ where: { message_id: messageId, reaction_count: { gt: 0 } }, data: { reaction_count: { decrement: 1 } } });
    }
    return;
  }

  // 게시물 레코드 보장(최초 반응 시 생성 — 인증 작성자 확정된 시점).
  await prisma.forumReactionPost.upsert({
    where: { message_id: messageId },
    create: { message_id: messageId, channel_id: parentId, author_id: author.id },
    update: {},
  });
  // 신규 고유 반응.
  try {
    await prisma.forumReaction.create({ data: { message_id: messageId, discord_user_id: reactorDiscordId } });
  } catch {
    return; // unique → 이미 반응한 유저
  }
  const cfg = await getGalleryConfig();
  const updated = await prisma.forumReactionPost.update({
    where: { message_id: messageId },
    data: { reaction_count: { increment: 1 } },
    select: { reaction_count: true },
  });
  const count = updated.reaction_count;
  // 2트랙: 기본(개당=step1) + 보너스(N개 누적). 블루프린트 갤러리와 동일 config 공유.
  const base = await computeMilestoneCoins(count, cfg.reactionStep, cfg.reactionCoin, (m) =>
    prisma.forumReactionPost.updateMany({ where: { message_id: messageId, milestones_paid: { lt: m } }, data: { milestones_paid: m } }).then((r) => r.count),
  );
  const bonus = await computeMilestoneCoins(count, cfg.reactionBonusStep, cfg.reactionBonusCoin, (m) =>
    prisma.forumReactionPost.updateMany({ where: { message_id: messageId, bonus_paid: { lt: m } }, data: { bonus_paid: m } }).then((r) => r.count),
  );
  if (base <= 0 && bonus <= 0) return;
  if (!author.minecraft_uuid) return;
  // 기본(개당)은 조용히 적립, 보너스(N개 누적)에서만 알림.
  if (base > 0) {
    await deliverCoins({ profileId: author.id, minecraftUuid: author.minecraft_uuid, amount: base, source: "forum_reaction", reason: "전시관 반응" });
  }
  if (bonus > 0) {
    const { awarded } = await deliverCoins({ profileId: author.id, minecraftUuid: author.minecraft_uuid, amount: bonus, source: "forum_reaction_bonus", reason: "전시관 반응 보너스" });
    if (awarded > 0) {
      await prisma.notification
        .create({
          data: {
            recipient_id: author.id,
            sender_name: "system",
            category: "coin",
            title: "전시관 반응 보너스",
            body: `전시관 게시물이 누적 👍 ${count}개를 받아 보너스 ${awarded} 코인을 받았습니다.`,
            meta: JSON.stringify({ coin: awarded }),
          },
        })
        .catch(() => {});
    }
  }
}

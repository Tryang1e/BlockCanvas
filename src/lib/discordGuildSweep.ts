import { prisma } from "@/lib/prisma";
import { isDiscordGuildMember, isGuildGateEnabled } from "@/lib/discordOAuth";
import { applyGuildMembership } from "@/lib/roleSync";

const SWEEP_SPACING_MS = 250; // Discord REST 레이트리밋 완화용 호출 간격
const SWEEP_MAX_PER_RUN = 500; // 한 사이클 처리 상한(초과분은 다음 사이클 — 스윕 무한 대기 방지)

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Discord 길드 멤버십 재조정 스윕(스케줄러 전용, /api/world/sweep) — 봇이 오프라인이던 사이 놓친
 * 이탈/재가입을 보정해 **최종 일관성**을 보장한다(실시간 GuildMemberRemove/Add 리스너는 advisory,
 * 이 스윕이 신뢰 경로).
 *
 *  - discord_id 가 연동된 전 계정을 봇 토큰으로 재확인 → discord_in_guild 를 실제와 맞춘다.
 *  - 불일치 시 applyGuildMembership 로 건축권한(builder) + 웹 대시보드 접근을 회수/복구한다.
 *  - **조회 실패(레이트리밋·네트워크)는 플래그를 건드리지 않고 건너뛴다** — 일시 장애로 잘못 강등하지 않는다(fail-safe).
 *  - 게이트 미설정(봇 토큰/길드 ID 없음)이면 no-op. 절대 throw 하지 않는다(sweep 격리 규약).
 */
export async function sweepDiscordGuildMembership(): Promise<{
  guildChecked: number;
  guildCorrected: number;
  guildErrors: number;
  guildSkipped: number;
}> {
  if (!isGuildGateEnabled()) {
    return { guildChecked: 0, guildCorrected: 0, guildErrors: 0, guildSkipped: 0 };
  }

  const linked = await prisma.profile.findMany({
    where: { discord_id: { not: null } },
    select: { id: true, discord_id: true, discord_in_guild: true },
  });

  const batch = linked.slice(0, SWEEP_MAX_PER_RUN);
  const skipped = Math.max(0, linked.length - batch.length);
  let checked = 0;
  let corrected = 0;
  let errors = 0;

  for (const p of batch) {
    if (!p.discord_id) continue;
    try {
      const inGuild = await isDiscordGuildMember(p.discord_id);
      checked++;
      if (inGuild !== p.discord_in_guild) {
        await applyGuildMembership(p.id, inGuild).catch(() => {});
        corrected++;
      }
    } catch (e) {
      errors++; // 레이트리밋/네트워크 — 플래그 유지하고 다음 사이클에 재시도(잘못된 강등 방지)
      console.warn(`[discord-guild-sweep] ${p.discord_id} 길드 조회 실패(건너뜀):`, e instanceof Error ? e.message : String(e));
    }
    await sleep(SWEEP_SPACING_MS);
  }

  if (skipped > 0) {
    console.warn(`[discord-guild-sweep] 처리 상한(${SWEEP_MAX_PER_RUN}) 초과 — ${skipped}건은 다음 사이클로 이월`);
  }
  return { guildChecked: checked, guildCorrected: corrected, guildErrors: errors, guildSkipped: skipped };
}

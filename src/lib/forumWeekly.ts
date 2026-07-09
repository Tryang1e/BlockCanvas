import { prisma } from "@/lib/prisma";
import { deliverCoins, getEconomyConfig } from "@/lib/economyConfig";

/**
 * 전시관(showcase) 포럼 "주간 최다 반응 게시물" 보상 — 스케줄러 전용(/api/world/sweep 이 8시간마다 호출).
 *
 * 정책(2026-07-03):
 *  - 매주 1개: 직전 완료된 ISO 주(월~일, KST 기준)에 **그 주에 새로 받은** 👍 반응 수가 가장 많은
 *    전시관 게시물의 작성자에게 forumWeeklyCoin(기본 300) 코인을 1회 지급한다.
 *  - "그 주에 받은 반응" 기준 → ForumReaction.created_at 이 주 구간에 든 것만 센다(누적 총합 아님).
 *    오래된 인기글이 매주 반복 수상하는 것을 방지.
 *  - 동점 시 먼저 올라온 게시물(ForumReactionPost.created_at 오름차순)이 우선.
 *
 * 멱등성:
 *  - ForumWeeklyAward.week_key(unique)를 **먼저 claim(create)** 한 뒤 지급 → 스윕이 주중 여러 번 돌아도
 *    주당 정확히 1회만 지급된다(중복 지급 불가). claim 성공자만 승자 계산·지급을 수행한다.
 *  - claim 후 크래시로 지급이 누락되면 그 주는 coin=0(처리됨)으로 남아 재시도하지 않는다 —
 *    중복 지급보다 (드문) 1주 누락을 택한 안전한 트레이드오프.
 *
 * 반환값은 sweep 응답에 스프레드되므로 키를 weekly* 로 접두(다른 스윕 결과와 충돌 방지). 절대 throw 하지 않는다.
 */

const KST_OFFSET_MS = 9 * 3600 * 1000; // KST=UTC+9 고정(서머타임 없음). blueprintGallery.countTodayShares 와 동일 패턴.
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** KST 벽시계 날짜(Date의 UTC 필드로 해석)에서 ISO-8601 주 키 "YYYY-Www" 를 계산. */
function isoWeekKey(kstWall: Date): string {
  // 주의 목요일로 정규화(ISO 주의 연도는 그 주 목요일이 속한 연도).
  const d = new Date(Date.UTC(kstWall.getUTCFullYear(), kstWall.getUTCMonth(), kstWall.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 월=0 … 일=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // 이번 주 목요일
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4)); // 1월 4일은 항상 W01 에 속함
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3); // W01 의 목요일
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / WEEK_MS);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** 직전 완료된 주(월 00:00 KST ~ 다음 월 00:00 KST)의 [start, end) 절대 instant + week_key. */
function previousWeekWindow(nowMs: number): { weekStart: Date; weekEnd: Date; weekKey: string } {
  const kstNow = new Date(nowMs + KST_OFFSET_MS); // UTC 필드 = KST 벽시계
  const mondayOffset = (kstNow.getUTCDay() + 6) % 7; // 이번 주 월요일까지의 일수(월=0)
  // 이번 주 월요일 00:00 KST 의 실제 instant.
  const thisMondayUtc = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - mondayOffset) - KST_OFFSET_MS;
  const weekEnd = new Date(thisMondayUtc); // 직전 주의 끝(이번 주 시작, exclusive)
  const weekStart = new Date(thisMondayUtc - WEEK_MS); // 직전 주 월요일 00:00 KST
  const weekKey = isoWeekKey(new Date(weekStart.getTime() + KST_OFFSET_MS)); // 직전 주 임의 시점(월요일)의 ISO 주
  return { weekStart, weekEnd, weekKey };
}

export interface WeeklyShowcaseResult {
  weeklySkipped?: boolean; // 비활성(forumWeeklyCoin<=0) 등으로 건너뜀
  weeklyAlreadyProcessed?: boolean; // 이번 주는 이미 처리(지급)됨
  weeklyWeekKey?: string;
  weeklyWinnerMessageId?: string | null;
  weeklyReactionCount?: number;
  weeklyAwarded?: number;
  weeklyError?: string;
}

const BACKFILL_WEEKS = 4; // 다운타임(주 경계 넘김) 대비 — 최근 완료 주부터 최대 N주 역방향으로 미처리 주를 보정.

/** 특정 완료 주(weekStart~weekEnd)의 전시관 최다 반응 게시물에 1회 지급. week_key claim 으로 멱등. */
async function awardWeek(weekStart: Date, weekEnd: Date, weekKey: string, weeklyCoin: number): Promise<WeeklyShowcaseResult> {
  // ① 주 claim(멱등 게이트). P2002(unique=이미 처리)만 정상 완료로 취급하고,
  //    그 외(SQLITE_BUSY/timeout 등 일시적 쓰기 오류)는 삼키지 않고 노출 → 다음 스윕에서 재시도·관측.
  try {
    await prisma.forumWeeklyAward.create({ data: { week_key: weekKey } });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { weeklyAlreadyProcessed: true, weeklyWeekKey: weekKey };
    return { weeklyWeekKey: weekKey, weeklyError: e instanceof Error ? e.message : String(e) };
  }

  // ② 그 주에 새로 받은 반응 수 기준 최다 게시물 후보(동점 포함).
  const grouped = await prisma.forumReaction.groupBy({
    by: ["message_id"],
    where: { created_at: { gte: weekStart, lt: weekEnd } },
    _count: { message_id: true },
    orderBy: { _count: { message_id: "desc" } },
    take: 50,
  });
  if (grouped.length === 0) {
    // 그 주 반응 0건 — claim 행은 coin=0(처리됨)으로 남긴다.
    return { weeklyWeekKey: weekKey, weeklyWinnerMessageId: null, weeklyReactionCount: 0, weeklyAwarded: 0 };
  }

  const topCount = grouped[0]._count.message_id;
  const tiedIds = grouped.filter((g) => g._count.message_id === topCount).map((g) => g.message_id);

  // ③ 동점 tie-break: 먼저 올라온 게시물 우선(+ 작성자 확보). 게시물이 삭제됐으면(cascade) 후보에서 빠진다.
  const posts = await prisma.forumReactionPost.findMany({
    where: { message_id: { in: tiedIds } },
    select: { message_id: true, author_id: true, created_at: true },
    orderBy: { created_at: "asc" },
  });
  const winner = posts[0];
  if (!winner) {
    return { weeklyWeekKey: weekKey, weeklyWinnerMessageId: null, weeklyReactionCount: topCount, weeklyAwarded: 0 };
  }

  // ④ 작성자 지급(deliverCoins: 미접속/오프라인이면 미지급 원장→접속 시 정산. forum_weekly 는 일일 상한 면제).
  const author = await prisma.profile.findUnique({ where: { id: winner.author_id }, select: { id: true, minecraft_uuid: true } });
  if (!author) {
    return { weeklyWeekKey: weekKey, weeklyWinnerMessageId: winner.message_id, weeklyReactionCount: topCount, weeklyAwarded: 0 };
  }

  const { awarded } = await deliverCoins({
    profileId: author.id,
    minecraftUuid: author.minecraft_uuid,
    amount: weeklyCoin,
    source: "forum_weekly",
    reason: `전시관 주간 최다 반응 (${weekKey})`,
  });

  // ⑤ 수상 결과를 claim 행에 기록.
  await prisma.forumWeeklyAward
    .update({ where: { week_key: weekKey }, data: { message_id: winner.message_id, author_id: author.id, reaction_count: topCount, coin: awarded } })
    .catch(() => {});

  // ⑥ 수상 알림(실지급>0 일 때만).
  if (awarded > 0) {
    await prisma.notification
      .create({
        data: {
          recipient_id: author.id,
          sender_name: "system",
          category: "coin",
          title: "전시관 주간 우수작 보상",
          body: `이번 주 전시관에서 가장 많은 👍(${topCount}개)를 받아 ${awarded} 코인을 받았습니다.`,
          meta: JSON.stringify({ coin: awarded }),
        },
      })
      .catch(() => {});
  }

  return { weeklyWeekKey: weekKey, weeklyWinnerMessageId: winner.message_id, weeklyReactionCount: topCount, weeklyAwarded: awarded };
}

/**
 * 직전 완료된 주의 전시관 최다 반응 게시물에 1회 보상. 멱등·비-throw.
 * 다운타임으로 주 경계를 넘겨 놓쳐도, 최근 완료 주부터 최대 BACKFILL_WEEKS 주를 역방향으로 확인해 미처리 주를 보정한다.
 * 최신(back=1) 주가 이미 처리됐으면 그 이전 주도 앞선 스윕에서 처리됐으므로 조기 종료(정상 운영 시 매 스윕 1회 조회).
 */
export async function sweepWeeklyShowcaseWinner(): Promise<WeeklyShowcaseResult> {
  try {
    const cfg = await getEconomyConfig();
    if (cfg.forumWeeklyCoin <= 0) return { weeklySkipped: true }; // 주간 보상 비활성

    const nowMs = Date.now();
    let newest: WeeklyShowcaseResult | null = null;
    for (let back = 1; back <= BACKFILL_WEEKS; back++) {
      // 앵커를 (back-1)주 뒤로 밀어 previousWeekWindow 가 그만큼 이전의 완료 주를 가리키게 한다(월요일 경계로 재스냅).
      const { weekStart, weekEnd, weekKey } = previousWeekWindow(nowMs - (back - 1) * WEEK_MS);
      const r = await awardWeek(weekStart, weekEnd, weekKey, cfg.forumWeeklyCoin);
      if (back === 1) {
        newest = r;
        if (r.weeklyAlreadyProcessed) break; // 최신 주가 이미 처리됨 → 이전 주도 처리 완료(정상 운영). 조기 종료.
      }
    }
    return newest ?? { weeklySkipped: true };
  } catch (e) {
    return { weeklyError: e instanceof Error ? e.message : String(e) };
  }
}

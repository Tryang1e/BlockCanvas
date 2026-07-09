import { prisma } from "@/lib/prisma";
import { awardCoins } from "@/lib/minecraft";

/**
 * 경제 전역 설정 — 코인 보상 금액 + 상점 가격을 SiteSetting 으로 중앙 관리(어드민 UI 편집, 재배포 불필요).
 * getGalleryConfig 와 동일 패턴. 미설정/파싱 실패는 기본값(기존 env 값 유지) 폴백.
 *   - 보상 키 중 다운로드/이모지는 갤러리 기존 키(blueprint_*)를 재사용 → 한 곳에서 편집하면 갤러리·경제 모두 반영.
 *   - 상점 가격은 기존 env(SHOP_*)를 기본값으로 흡수 → SiteSetting 이 우선, 없으면 env, 없으면 하드코딩.
 */

const envNum = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const n = raw != null && raw !== "" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export interface EconomyConfig {
  // --- 코인 보상(획득) — 다운로드/반응은 2트랙: 기본(개당) + 보너스(N개 누적) ---
  downloadStep: number; // (기본) 블루프린트 고유 다운로드 N회마다 — 개당은 1
  downloadCoin: number;
  reactionStep: number; // (기본) 블루프린트/전시관 👍 N개마다 — 개당은 1
  reactionCoin: number;
  downloadBonusStep: number; // (보너스) 고유 다운로드 N회 누적마다 추가
  downloadBonusCoin: number;
  reactionBonusStep: number; // (보너스) 고유 반응 N개 누적마다 추가
  reactionBonusCoin: number;
  blockStep: number; // 순설치(설치−파괴) 블록 N개마다
  blockCoin: number;
  playtimeStep: number; // 누적 접속 N분마다
  playtimeCoin: number;
  // --- 상점 가격(소비) ---
  subscriptionPrice: number;
  subscriptionDays: number;
  nickPrice: number;
  plotSlotBase: number; // 플롯 확장 구매권 첫 구매 가격(코인). 다음 구매마다 2배(base×2^보유수).
  plotSlotMax: number; // 플롯 확장 구매권 1인당 최대 구매 개수. 0 = 무제한(2배 가격이 사실상 상한).
  // --- 코인 보상(온보딩) ---
  signupBonusCoin: number; // 3종 인증(디스코드+마크+웹가입) 최초 완료 시 1회 지급. 0 = 지급 안 함.
  forumWeeklyCoin: number; // 전시관 주간 최다 반응 게시물 1개 보상. 0 = 주간 보상 비활성.
  // --- 블루프린트 유료 판매 ---
  blueprintBuyerFeePercent: number; // 구매 수수료 %(구매자가 가격에 더해 지불, 소각). 0~100.
  blueprintSellerFeePercent: number; // 판매 수수료 %(판매자가 받는 금액에서 차감, 소각). 0~100.
  blueprintPriceMax: number; // 판매가 상한(코인). 과도한 가격/오버플로 방지.
  // --- 인플레이션 통제 ---
  dailyEarnCap: number; // 유저 1인당 최근 24시간 유입(보상) 상한. 0 = 무제한. 초과분은 지급 안 함(파밍 억제).
  // --- 기타 ---
  reportAutohide: number; // 갤러리 신고 자동숨김 임계(공유 유지)
}

export const ECONOMY_DEFAULTS: EconomyConfig = {
  downloadStep: 1, // (기본) 다운로드 1회당(2026-07-03 정책)
  downloadCoin: 5, // 5코인
  reactionStep: 1, // (기본) 반응 1개당
  reactionCoin: 10, // 10코인
  downloadBonusStep: 10, // (보너스) 다운로드 10회 누적마다
  downloadBonusCoin: 30, // +30코인
  reactionBonusStep: 10, // (보너스) 반응 10개 누적마다
  reactionBonusCoin: 100, // +100코인
  blockStep: 100,
  blockCoin: 10,
  playtimeStep: 60, // 60분(1시간)당
  playtimeCoin: 20, // 20코인 (누적접속 보상)
  subscriptionPrice: envNum("SHOP_SUBSCRIPTION_PRICE", 50000),
  subscriptionDays: envNum("SHOP_SUBSCRIPTION_DAYS", 30),
  nickPrice: envNum("SHOP_NICK_PRICE", 10000),
  plotSlotBase: envNum("SHOP_PLOT_SLOT_PRICE", 300),
  plotSlotMax: envNum("SHOP_PLOT_SLOT_MAX", 0), // 0 = 무제한
  signupBonusCoin: envNum("SIGNUP_BONUS_COIN", 1000),
  forumWeeklyCoin: 300, // 전시관 주간 최다 반응 게시물 보상(2026-07-03)
  blueprintBuyerFeePercent: 10,
  blueprintSellerFeePercent: 10,
  blueprintPriceMax: 10_000_000,
  dailyEarnCap: 0, // 기본 무제한
  reportAutohide: 3,
};

// 필드 → SiteSetting 키. 다운로드/이모지/신고는 갤러리 기존 키 재사용(호환).
export const ECONOMY_KEYS: Record<keyof EconomyConfig, string> = {
  downloadStep: "blueprint_milestone_step",
  downloadCoin: "blueprint_milestone_coin",
  reactionStep: "blueprint_reaction_step",
  reactionCoin: "blueprint_reaction_coin",
  downloadBonusStep: "blueprint_download_bonus_step",
  downloadBonusCoin: "blueprint_download_bonus_coin",
  reactionBonusStep: "blueprint_reaction_bonus_step",
  reactionBonusCoin: "blueprint_reaction_bonus_coin",
  blockStep: "economy_block_step",
  blockCoin: "economy_block_coin",
  playtimeStep: "economy_playtime_step",
  playtimeCoin: "economy_playtime_coin",
  subscriptionPrice: "shop_subscription_price",
  subscriptionDays: "shop_subscription_days",
  nickPrice: "shop_nick_price",
  plotSlotBase: "shop_plot_slot_price",
  plotSlotMax: "shop_plot_slot_max",
  signupBonusCoin: "signup_bonus_coin",
  forumWeeklyCoin: "forum_weekly_coin",
  blueprintBuyerFeePercent: "blueprint_buyer_fee_percent",
  blueprintSellerFeePercent: "blueprint_seller_fee_percent",
  blueprintPriceMax: "blueprint_price_max",
  dailyEarnCap: "economy_daily_earn_cap",
  reportAutohide: "blueprint_report_autohide",
};

// step/일수처럼 최소 1 이상이어야 하는 키(0 나눗셈/무한 방지).
const MIN_ONE: (keyof EconomyConfig)[] = ["downloadStep", "reactionStep", "downloadBonusStep", "reactionBonusStep", "blockStep", "playtimeStep", "subscriptionDays", "reportAutohide"];

/** 경제 설정값 로드(SiteSetting). 누락/파싱 실패는 기본값으로 폴백. */
export async function getEconomyConfig(): Promise<EconomyConfig> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(ECONOMY_KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as EconomyConfig;
  (Object.keys(ECONOMY_KEYS) as (keyof EconomyConfig)[]).forEach((k) => {
    const raw = map.get(ECONOMY_KEYS[k]);
    const n = raw != null ? parseInt(String(raw).replace(/[^0-9-]/g, ""), 10) : NaN;
    let v = Number.isFinite(n) && n >= 0 ? n : ECONOMY_DEFAULTS[k];
    if (MIN_ONE.includes(k)) v = Math.max(1, v);
    out[k] = v;
  });
  return out;
}

export type CoinDirection = "in" | "out" | "transfer";

/**
 * 코인 원장에 1행 기록(경제순환 분석용, delivered=true 기본). best-effort.
 * amount 는 항상 양수 크기이고, 방향(유입/유출/이체)은 direction 으로 구분한다.
 * 이미 성공 확인된 이동에 사용(관리자 지급=in, 상점 소각=out, 유저 이체=transfer).
 */
export async function logCoinAward(input: {
  profileId?: string | null;
  minecraftUuid?: string | null;
  amount: number;
  source: string;
  reason?: string | null;
  direction?: CoinDirection;
}): Promise<void> {
  const amt = Math.round(Math.abs(input.amount));
  if (!Number.isFinite(amt) || amt === 0) return;
  try {
    await prisma.coinAward.create({
      data: {
        profile_id: input.profileId ?? null,
        minecraft_uuid: input.minecraftUuid ?? null,
        amount: amt,
        source: input.source,
        direction: input.direction ?? "in",
        reason: (input.reason ?? "").slice(0, 200) || null,
      },
    });
  } catch (e) {
    // best-effort 이지만 감사(coin-spend) 경로의 조용한 누락을 관측할 수 있게 로그는 남긴다.
    console.error("logCoinAward failed:", e instanceof Error ? e.message : String(e));
  }
}

/**
 * 코인 소비(유출/이체) 원장 기록 — 코인은 이미 인게임/CMI 에서 차감·이동된 뒤 호출한다(CMI 재입금 없음).
 *  - transfer=false(기본): 소각/상점 결제 = 통화량 감소(direction=out).
 *  - transfer=true: 유저 간 이체 = 순통화량 불변(direction=transfer, 회전량으로만 집계).
 */
export async function logCoinSpend(input: {
  profileId?: string | null;
  minecraftUuid?: string | null;
  amount: number;
  source: string;
  reason?: string | null;
  transfer?: boolean;
}): Promise<void> {
  await logCoinAward({ ...input, direction: input.transfer ? "transfer" : "out" });
}

/**
 * 코인 지급 + 원장 기록 + 미지급 정산 대비. 자동 보상(다운로드/이모지/블록/접속)에 사용.
 *  1) 원장 1행을 delivered=false 로 먼저 생성. 2) CMI 입금 시도. 3) 성공 시 delivered=true 로 갱신.
 * 실패(서버 오프라인/미접속 유저=CMI 계정 없음) 시 원장은 미전달로 남고, 유저가 서버에 접속할 때
 * flushPendingCoins 가 몰아서 정산한다. → "서버 안 들어온 인증 유저"도 접속하는 순간 코인이 안전하게 지급됨.
 */
export async function deliverCoins(input: {
  profileId?: string | null;
  minecraftUuid: string | null;
  amount: number;
  source: string;
  reason?: string | null;
}): Promise<{ delivered: boolean; awarded: number }> {
  // awarded = 실제 지급(원장 기록)된 코인. 상한(dailyEarnCap) 으로 깎이거나 0 이 될 수 있어 호출부가 이 값으로
  // 알림/표시를 해야 한다(마일스톤 금액이 아니라). delivered = CMI 실제 입금 여부(오프라인이면 false → 접속 시 정산).
  let amt = Math.round(input.amount);
  if (!Number.isFinite(amt) || amt <= 0) return { delivered: false, awarded: 0 };

  // 인플레이션 통제 — 유저 1인당 최근 24h 유입 상한(0=무제한). 초과분은 지급/기록하지 않는다(파밍 억제).
  //  상한 면제 소스: admin_grant(관리자 수동 지급) + forum_weekly(주간 우수작 편집 보상) — 정상 보상 여력을 잠식하지 않게.
  //  ⚠ forum_weekly 는 스윕이 주 claim 후 1회만 지급(멱등)하므로, 상한에 걸려 0 지급되면 그 주 상금이 영구 소멸한다 → 면제.
  const CAP_EXEMPT_SOURCES = ["admin_grant", "forum_weekly"];
  try {
    const cfg = await getEconomyConfig();
    if (cfg.dailyEarnCap > 0 && input.minecraftUuid && !CAP_EXEMPT_SOURCES.includes(input.source)) {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const agg = await prisma.coinAward.aggregate({
        _sum: { amount: true },
        where: {
          minecraft_uuid: input.minecraftUuid,
          direction: "in",
          source: { notIn: CAP_EXEMPT_SOURCES },
          created_at: { gte: since },
        },
      });
      const remaining = cfg.dailyEarnCap - (agg._sum.amount ?? 0);
      if (remaining <= 0) return { delivered: false, awarded: 0 }; // 상한 도달 — 지급/기록 없음(초과분 미지급)
      if (amt > remaining) amt = remaining; // 남은 한도까지만 지급(초과분 미지급)
    }
  } catch {
    /* 상한 조회 실패는 무시(정상 지급으로 진행) */
  }

  let ledgerId: string | null = null;
  try {
    const row = await prisma.coinAward.create({
      data: {
        profile_id: input.profileId ?? null,
        minecraft_uuid: input.minecraftUuid ?? null,
        amount: amt,
        source: input.source,
        reason: (input.reason ?? "").slice(0, 200) || null,
        delivered: false,
      },
      select: { id: true },
    });
    ledgerId = row.id;
  } catch {
    /* 원장 실패는 무시 */
  }
  // 원장 생성 실패(DB blip 등) → 멱등키/추적 행 없이 CMI 지급하지 않는다. 키 없이 지급하면 응답 유실 시 재시도도
  // 추적도 안 돼(untracked) 이중지급/유령 크레딧 위험 → 이 경우 지급을 건너뛴다(awarded=0, 호출부 알림 생략).
  if (!ledgerId) return { delivered: false, awarded: 0 };
  if (!input.minecraftUuid) return { delivered: false, awarded: amt }; // 미연동 → 정산 불가(원장만 남김, 금액은 기록됨)
  // 멱등키 = 이 원장 행 id. 지급 응답이 유실돼 flushPendingCoins 가 같은 행을 재시도해도(같은 id) 플러그인이 이중 입금을 차단.
  const r = await awardCoins(input.minecraftUuid, amt, input.reason ?? input.source, ledgerId);
  if (r.success && ledgerId) {
    await prisma.coinAward.update({ where: { id: ledgerId }, data: { delivered: true } }).catch(() => {});
  }
  return { delivered: r.success, awarded: amt };
}

/**
 * 미지급(delivered=false) 코인 정산 — 그 UUID 앞으로 밀린 보상을 합산해 한 번에 지급하고 delivered=true 로 표시.
 * 서버 접속(role-sync) 시 호출 → 미접속/오프라인 동안 쌓인 보상을 접속 순간 안전하게 정산한다. best-effort.
 */
export async function flushPendingCoins(minecraftUuid: string): Promise<void> {
  if (!minecraftUuid) return;
  const pending = await prisma.coinAward.findMany({
    where: { minecraft_uuid: minecraftUuid, delivered: false },
    select: { id: true, amount: true, reason: true },
    orderBy: { created_at: "asc" }, // 오래된 미지급부터 정산
    take: 100, // 로그인 시 순차 HTTP 정산량 상한 — 과다 누적돼도 여러 번 접속으로 분할 정산(접속 경로 폭주/증폭 방지)
  });
  if (pending.length === 0) return;
  // 건별 정산 — 각 행을 그 행 id 를 멱등키로 지급한다.
  //  ⚠ 합산 1회 지급을 쓰면 원 지급 시도와 키가 달라져 멱등이 깨진다: 원 지급이 실제 입금됐는데 응답만 유실된 경우,
  //     같은 행 id 로 재시도해야 플러그인이 중복 입금을 걸러낸다(이중 발행 방지).
  for (const row of pending) {
    if (row.amount <= 0) {
      await prisma.coinAward.update({ where: { id: row.id }, data: { delivered: true } }).catch(() => {}); // 0 이하 행은 지급 대상 아님 — 정리만
      continue;
    }
    const r = await awardCoins(minecraftUuid, row.amount, row.reason ?? "미지급 코인 정산", row.id);
    if (r.success) {
      await prisma.coinAward.update({ where: { id: row.id }, data: { delivered: true } }).catch(() => {});
    }
    // 실패(서버 오프라인 등)면 delivered=false 유지 → 다음 접속에 재시도.
  }
}

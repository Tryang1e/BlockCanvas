"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaff, requireSuperAdmin } from "@/lib/admin-auth";
import { getEconomyConfig, ECONOMY_KEYS, type EconomyConfig } from "@/lib/economyConfig";

// 어드민 경제 관리 — 코인 보상/상점 가격 설정 편집 + 경제순환 분석.

/** 현재 경제 설정값(기본값 병합). 어드민 폼 초기값. */
export async function loadEconomyConfig() {
  try {
    await requireStaff();
    return { success: true as const, config: await getEconomyConfig() };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 경제 설정 저장(최종 관리자 전용). 숫자 검증 후 SiteSetting 일괄 upsert. */
export async function saveEconomyConfig(values: Partial<Record<keyof EconomyConfig, number>>) {
  try {
    const admin = await requireSuperAdmin();
    const rows: { key: string; value: string }[] = [];
    for (const k of Object.keys(ECONOMY_KEYS) as (keyof EconomyConfig)[]) {
      const raw = values[k];
      if (raw == null) continue;
      const n = Math.floor(Number(raw));
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
        return { success: false as const, error: `잘못된 값입니다: ${k}` };
      }
      rows.push({ key: ECONOMY_KEYS[k], value: String(n) });
    }
    if (rows.length === 0) return { success: false as const, error: "저장할 값이 없습니다." };
    for (const r of rows) {
      await prisma.siteSetting.upsert({ where: { key: r.key }, update: { value: r.value }, create: { key: r.key, value: r.value } });
    }
    await prisma.auditLog.create({ data: { admin_name: admin, action: "ECONOMY_CONFIG_UPDATE", details: `${rows.length}개 항목 변경` } }).catch(() => {});
    revalidatePath("/adminpage/economy");
    return { success: true as const, config: await getEconomyConfig() };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 방향별 흐름 요약 — net 통화량 증감 = in − out(이체는 순통화량 불변이라 별도 회전량). */
export interface EconomyFlow {
  in: number; // 유입(발행/보상)
  out: number; // 유출(소각/상점 결제)
  transfer: number; // 유저 간 이체(회전량, 순통화량 불변)
  net: number; // 순통화량 증감 = in − out
}

export interface EconomySourceRow {
  source: string;
  direction: string; // in | out | transfer
  amount: number;
  count: number;
}

export interface EconomyUserRow {
  profileId: string | null;
  name: string; // 마크 닉네임 우선(minecraft_username → display_name → creator_name)
  uuid: string | null; // 마크 UUID(식별용)
  amount: number;
}

export interface EconomyStats {
  flow24: EconomyFlow; // 최근 24h
  flow7d: EconomyFlow; // 최근 7일
  flowAll: EconomyFlow; // 전체 누적
  perHourIn24: number; // 시간당 유입(24h)
  perHourInAll: number; // 시간당 유입(전체 평균)
  spanHours: number; // 원장 시작 이후 경과 시간
  earners24: number; // 24h 유입 받은 고유 유저 수
  avgPerEarner24: number; // 유저당 평균 유입(24h)
  inflowAwards24: number; // 24h 유입 건수
  bySourceIn: EconomySourceRow[]; // 24h 유입 소스별
  bySourceOut: EconomySourceRow[]; // 24h 유출·이체 소스별
  topEarners24: EconomyUserRow[]; // 24h 유입 상위 유저
  topSpenders24: EconomyUserRow[]; // 24h 유출·이체 상위 유저
}

/** 경제순환 분석 — CoinAward 원장 기반. 유입/유출/순증감·소스별·유저별. */
export async function getEconomyStats(): Promise<{ success: true; stats: EconomyStats } | { success: false; error: string }> {
  try {
    await requireStaff();
    const now = Date.now();
    const since24 = new Date(now - 24 * 3600 * 1000);
    const since7d = new Date(now - 7 * 24 * 3600 * 1000);

    // 관리자(admin/manager)의 거래는 경제순환 분석에서 제외 — 운영자 테스트/지급이 실제 유저 경제를 왜곡하지 않게.
    //  프로필 없는(미연동) 행은 유지: NOT(스태프 프로필) 이라 profile_id=null 은 통과. (admin_grant 는 수령자 프로필 기준이라 유저 지급분은 유지됨)
    const notStaff = { NOT: { profile: { role: { in: ["admin", "manager"] } } } };

    const [dir24, dir7d, dirAll, bySrcDir24, earners, first, topIn, topOut] = await Promise.all([
      prisma.coinAward.groupBy({ by: ["direction"], _sum: { amount: true }, where: { created_at: { gte: since24 }, ...notStaff } }),
      prisma.coinAward.groupBy({ by: ["direction"], _sum: { amount: true }, where: { created_at: { gte: since7d }, ...notStaff } }),
      prisma.coinAward.groupBy({ by: ["direction"], _sum: { amount: true }, where: { ...notStaff } }),
      prisma.coinAward.groupBy({ by: ["source", "direction"], _sum: { amount: true }, _count: { _all: true }, where: { created_at: { gte: since24 }, ...notStaff } }),
      prisma.coinAward.findMany({ where: { created_at: { gte: since24 }, direction: "in", profile_id: { not: null }, ...notStaff }, select: { profile_id: true }, distinct: ["profile_id"] }),
      prisma.coinAward.findFirst({ orderBy: { created_at: "asc" }, select: { created_at: true } }),
      prisma.coinAward.groupBy({ by: ["profile_id"], _sum: { amount: true }, where: { created_at: { gte: since24 }, direction: "in", profile_id: { not: null }, ...notStaff }, orderBy: { _sum: { amount: "desc" } }, take: 5 }),
      prisma.coinAward.groupBy({ by: ["profile_id"], _sum: { amount: true }, where: { created_at: { gte: since24 }, direction: { in: ["out", "transfer"] }, profile_id: { not: null }, ...notStaff }, orderBy: { _sum: { amount: "desc" } }, take: 5 }),
    ]);

    const toFlow = (rows: { direction: string; _sum: { amount: number | null } }[]): EconomyFlow => {
      const get = (d: string) => rows.find((r) => r.direction === d)?._sum.amount ?? 0;
      const i = get("in"), o = get("out"), t = get("transfer");
      return { in: i, out: o, transfer: t, net: i - o };
    };
    const flow24 = toFlow(dir24);
    const flowAll = toFlow(dirAll);
    const spanHours = first ? Math.max(1, (now - first.created_at.getTime()) / 3600000) : 1;

    const inRows = bySrcDir24
      .filter((r) => r.direction === "in")
      .map((r) => ({ source: r.source, direction: r.direction, amount: r._sum.amount ?? 0, count: r._count._all }))
      .sort((a, b) => b.amount - a.amount);
    const outRows = bySrcDir24
      .filter((r) => r.direction !== "in")
      .map((r) => ({ source: r.source, direction: r.direction, amount: r._sum.amount ?? 0, count: r._count._all }))
      .sort((a, b) => b.amount - a.amount);

    // 상위 유저 매핑 — 마크 닉네임(minecraft_username) 우선 + UUID(식별용).
    const ids = [...new Set([...topIn, ...topOut].map((r) => r.profile_id).filter((x): x is string => !!x))];
    const profs = ids.length
      ? await prisma.profile.findMany({
          where: { id: { in: ids } },
          select: { id: true, creator_name: true, display_name: true, minecraft_username: true, minecraft_uuid: true },
        })
      : [];
    const infoOf = new Map(
      profs.map((p) => [p.id, { name: p.minecraft_username || p.display_name || p.creator_name, uuid: p.minecraft_uuid }])
    );
    const toUserRow = (r: { profile_id: string | null; _sum: { amount: number | null } }): EconomyUserRow => {
      const info = r.profile_id ? infoOf.get(r.profile_id) : null;
      return {
        profileId: r.profile_id,
        name: r.profile_id ? info?.name ?? "(삭제된 유저)" : "(미연동)",
        uuid: info?.uuid ?? null,
        amount: r._sum.amount ?? 0,
      };
    };

    const earners24 = earners.length;

    return {
      success: true,
      stats: {
        flow24,
        flow7d: toFlow(dir7d),
        flowAll,
        perHourIn24: flow24.in / 24,
        perHourInAll: flowAll.in / spanHours,
        spanHours,
        earners24,
        avgPerEarner24: earners24 ? flow24.in / earners24 : 0,
        inflowAwards24: inRows.reduce((s, r) => s + r.count, 0),
        bySourceIn: inRows,
        bySourceOut: outRows,
        topEarners24: topIn.map(toUserRow),
        topSpenders24: topOut.map(toUserRow),
      },
    };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 코인 원장 CSV 내보내기(회계·감사용) — 기간 내 CoinAward 전체(유입+유출+이체)를 최신순 CSV 로.
 * Excel 한글 호환을 위해 UTF-8 BOM 을 붙인다. 최대 5000행(과다 방지).
 */
export async function exportCoinLedger(
  days: number
): Promise<{ success: true; csv: string; filename: string } | { success: false; error: string }> {
  try {
    await requireStaff();
    const d = Math.min(365, Math.max(1, Math.floor(Number(days)) || 7));
    const since = new Date(Date.now() - d * 24 * 3600 * 1000);
    const rows = await prisma.coinAward.findMany({
      where: { created_at: { gte: since } },
      orderBy: { created_at: "desc" },
      take: 5000,
      select: {
        created_at: true,
        direction: true,
        source: true,
        amount: true,
        delivered: true,
        reason: true,
        minecraft_uuid: true,
        profile: { select: { creator_name: true, minecraft_username: true } },
      },
    });
    // CSV 이스케이프 + 수식 인젝션 방어(=,+,-,@,탭/CR/LF 로 시작하면 앞에 ' 를 붙여 Excel 수식 실행 차단).
    const esc = (v: string) => {
      const s = /^[=+\-@\t\r\n]/.test(v) ? `'${v}` : v;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ["시각", "방향", "소스", "코인", "유저", "UUID", "지급여부", "사유"].join(",");
    const lines = rows.map((r) =>
      [
        esc(r.created_at.toISOString()),
        esc(r.direction),
        esc(r.source),
        String(r.amount),
        esc(r.profile?.minecraft_username || r.profile?.creator_name || r.minecraft_uuid || ""),
        esc(r.minecraft_uuid || ""),
        esc(r.delivered ? "delivered" : "pending"),
        esc(r.reason || ""),
      ].join(",")
    );
    const csv = "﻿" + [header, ...lines].join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    return { success: true, csv, filename: `coin-ledger-${d}d-${stamp}.csv` };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

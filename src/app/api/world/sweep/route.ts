import { NextResponse } from "next/server";
import crypto from "crypto";
import { opsAlert } from "@/lib/opsAlert";
import { sweepWorlds } from "@/lib/worldLifecycle";
import { sweepQuotas } from "@/lib/worldQuotaEnforcement";
import { sweepSchematics } from "@/lib/schematicLifecycle";
import { sweepDataRetention } from "@/lib/dataRetention";
import { sweepExpiredSubscriptions } from "@/lib/subscriptionLifecycle";
import { sweepImportParts } from "@/lib/importParts";
import { sweepWeeklyShowcaseWinner } from "@/lib/forumWeekly";
import { sweepDiscordGuildMembership } from "@/lib/discordGuildSweep";

export const runtime = "nodejs";

// 월드 수명주기 스윕(스케줄러 전용). 30일 미사용 → 아카이브, 90일 미사용 → 영구 삭제.
//   보안: WORLD_SWEEP_SECRET 헤더(x-cron-secret)가 일치해야 한다. 미설정 시 비활성(503).
//   호출: scripts/run-backup.ps1 의 best-effort 단계가 localhost 로 POST.
export async function POST(request: Request) {
  const secret = process.env.WORLD_SWEEP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "WORLD_SWEEP_SECRET 미설정 — 스윕 비활성." }, { status: 503 });
  }
  // 상수시간 비교(타이밍 사이드채널 방지) — 코드베이스의 HMAC 헬퍼와 동일 규약.
  const provided = Buffer.from(request.headers.get("x-cron-secret") || "");
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 각 sweep 을 개별 격리 — 한 단계가 던져도(예: 일시적 SQLITE_BUSY) 나머지 단계는 계속 실행된다.
  // 예전엔 단일 try/catch 라 초기 단계 실패 시 법정 90일 로그 퍼지·구독 강등·조각 정리까지 한 사이클 통째로 스킵됐다.
  const errors: Record<string, string> = {};
  const run = async <T,>(name: string, fn: () => Promise<T>): Promise<T | Record<string, never>> => {
    try {
      return await fn();
    } catch (e) {
      errors[name] = e instanceof Error ? e.message : String(e);
      return {};
    }
  };

  const lifecycle = await run("worlds", sweepWorlds);
  const quota = await run("quotas", sweepQuotas); // 활성 월드 크기 새로고침 + 유저별 쿼터 평가(경고/잠금)
  const schem = (await run("schematics", sweepSchematics)) as { purged?: number }; // 90일 미접속 스키매틱 폴더 정리
  const retention = await run("dataRetention", sweepDataRetention); // 로그 3개월·만료 인증토큰 라이브 DB 정리
  const sub = await run("subscriptions", sweepExpiredSubscriptions); // 구독 만료 → user 로 강등
  const parts = await run("importParts", sweepImportParts); // 미완료 청크 업로드 조각(6h+) 정리
  const weekly = await run("weekly", sweepWeeklyShowcaseWinner); // 전시관 주간 최다 반응 보상(주당 1회·멱등)
  const guild = await run("discordGuild", sweepDiscordGuildMembership); // Discord 길드 이탈/재가입 재조정(건축권한 회수/복구)

  const failed = Object.keys(errors).length > 0;
  if (failed) {
    // 부분 실패를 운영 경보로 통지 — 예전엔 로그만 남아 조용히 드리프트(법정 로그 퍼지·구독 강등 누락)했다.
    await opsAlert("world-sweep", `스윕 부분 실패: ${Object.keys(errors).join(", ")}\n${JSON.stringify(errors).slice(0, 600)}`).catch(() => {});
  }
  return NextResponse.json(
    {
      success: !failed,
      ...lifecycle, ...quota, schemPurged: schem.purged, ...retention, ...sub, ...parts, ...weekly, ...guild,
      ...(failed ? { errors } : {}),
    },
    { status: failed ? 207 : 200 },
  );
}

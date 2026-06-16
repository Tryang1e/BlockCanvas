import { NextResponse } from "next/server";
import { sweepWorlds } from "@/lib/worldLifecycle";
import { sweepQuotas } from "@/lib/worldQuotaEnforcement";

export const runtime = "nodejs";

// 월드 수명주기 스윕(스케줄러 전용). 30일 미사용 → 아카이브, 90일 미사용 → 영구 삭제.
//   보안: WORLD_SWEEP_SECRET 헤더(x-cron-secret)가 일치해야 한다. 미설정 시 비활성(503).
//   호출: scripts/run-backup.ps1 의 best-effort 단계가 localhost 로 POST.
export async function POST(request: Request) {
  const secret = process.env.WORLD_SWEEP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "WORLD_SWEEP_SECRET 미설정 — 스윕 비활성." }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const lifecycle = await sweepWorlds();
    const quota = await sweepQuotas(); // 활성 월드 크기 새로고침 + 유저별 쿼터 평가(경고/잠금)
    return NextResponse.json({ success: true, ...lifecycle, ...quota });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

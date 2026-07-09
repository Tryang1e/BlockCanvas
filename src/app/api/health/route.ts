import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — 경량 라이브니스/레디니스 프로브.
 *  - DB(SQLite) 연결 가능 여부만 확인한다(민감정보 미노출). 실패 시 503.
 *  - 업타임 모니터(UptimeRobot 등)·로드밸런서·배포 후 스모크 체크용.
 *  - 마인크래프트 플러그인 상태는 부하를 줄이려 여기서 확인하지 않는다(별도 /api/minecraft/status).
 */
export async function GET() {
  const startedAt = Date.now();
  let db = false;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    db = true;
  } catch {
    db = false;
  }
  const ok = db;
  return NextResponse.json(
    { ok, db, latency_ms: Date.now() - startedAt, ts: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

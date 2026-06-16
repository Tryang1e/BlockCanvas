import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { syncBridgeFromProfile } from "@/lib/hub";

const DISCORD_API_SECRET = process.env.DISCORD_API_SECRET || "blockcanvas-discord-secret";

// --- 연동코드 brute-force 방지 (discord_id 기준, 인메모리) ---
const MAX_FAILED_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(id: string): boolean {
  const rec = failedAttempts.get(id);
  if (!rec || Date.now() > rec.resetAt) return false;
  return rec.count >= MAX_FAILED_ATTEMPTS;
}
function registerFailure(id: string): void {
  const now = Date.now();
  const rec = failedAttempts.get(id);
  if (!rec || now > rec.resetAt) failedAttempts.set(id, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  else rec.count += 1;
}
function clearFailures(id: string): void {
  failedAttempts.delete(id);
}

/**
 * POST /api/discord/link
 * 디스코드 봇이 사용자의 연동코드 + Discord ID 를 보내 계정을 연동한다.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"), DISCORD_API_SECRET)) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const { code, discord_id, discord_username } = JSON.parse(rawBody) ?? {};
    if (!code || !discord_id) {
      return NextResponse.json({ error: "Bad Request: Missing code or discord_id." }, { status: 400 });
    }

    const discordId = String(discord_id);
    if (isRateLimited(discordId)) {
      return NextResponse.json({ error: "Too Many Requests: 인증 시도가 너무 많습니다." }, { status: 429 });
    }

    const verification = await prisma.discordVerification.findUnique({
      where: { code: String(code).trim() },
      include: { profile: true },
    });

    if (!verification) {
      registerFailure(discordId);
      return NextResponse.json({ error: "Not Found: Invalid or expired verification code." }, { status: 404 });
    }

    const codeAge = Date.now() - new Date(verification.created_at).getTime();
    if (codeAge > 10 * 60 * 1000) {
      await prisma.discordVerification.delete({ where: { id: verification.id } });
      registerFailure(discordId);
      return NextResponse.json({ error: "Gone: Verification code has expired." }, { status: 410 });
    }

    // 이미 다른 웹 계정에 연동된 Discord ID → 409
    const existing = await prisma.profile.findFirst({ where: { discord_id: discordId } });
    if (existing && existing.id !== verification.profile_id) {
      return NextResponse.json(
        { error: "Conflict: 이 디스코드 계정은 이미 다른 웹 계정에 연동되어 있습니다." },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.profile.update({
        where: { id: verification.profile_id },
        data: { discord_id: discordId, discord_username: discord_username ? String(discord_username) : null },
      }),
      prisma.discordVerification.delete({ where: { id: verification.id } }),
    ]);
    await syncBridgeFromProfile(verification.profile_id); // 브리지된 허브 계정에 미러링

    clearFailures(discordId);
    return NextResponse.json({
      success: true,
      message: "Successfully linked Discord account.",
      linkedTo: verification.profile.creator_name,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error linking Discord account:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

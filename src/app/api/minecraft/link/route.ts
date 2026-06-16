import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { syncBridgeFromProfile } from "@/lib/hub";

// --- 인증코드 brute-force 방지 (단일 인스턴스 인메모리 카운터) ---
// 요청은 MC 서버가 HMAC 서명해 보내므로 외부 위조는 불가하나, 악의적 플레이어가
// 인게임 /웹연동 <코드> 를 연타해 6자리(10^6) 공간을 무차별 시도하는 것을 막는다.
const MAX_FAILED_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10분
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(uuid: string): boolean {
  const rec = failedAttempts.get(uuid);
  if (!rec || Date.now() > rec.resetAt) return false;
  return rec.count >= MAX_FAILED_ATTEMPTS;
}
function registerFailure(uuid: string): void {
  const now = Date.now();
  const rec = failedAttempts.get(uuid);
  if (!rec || now > rec.resetAt) {
    failedAttempts.set(uuid, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  } else {
    rec.count += 1;
  }
}
function clearFailures(uuid: string): void {
  failedAttempts.delete(uuid);
}

/**
 * POST /api/minecraft/link
 * Spigot 서버가 인증코드 + 마크 UUID + 닉네임을 보내 계정을 영구 연동한다.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid signature or expired timestamp." },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const { code, uuid, username } = body ?? {};

    if (!code || !uuid || !username) {
      return NextResponse.json(
        { error: "Bad Request: Missing code, uuid, or username." },
        { status: 400 }
      );
    }

    // brute-force 차단
    if (isRateLimited(uuid)) {
      return NextResponse.json(
        { error: "Too Many Requests: 인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요." },
        { status: 429 }
      );
    }

    // code 는 @unique 이므로 findUnique 로 1건만 안전하게 조회
    const verification = await prisma.minecraftVerification.findUnique({
      where: { code: String(code).trim() },
      include: { profile: true },
    });

    if (!verification) {
      registerFailure(uuid);
      return NextResponse.json(
        { error: "Not Found: Invalid or expired verification code." },
        { status: 404 }
      );
    }

    // 만료(10분) 체크 + 정리
    const codeAge = Date.now() - new Date(verification.created_at).getTime();
    if (codeAge > 10 * 60 * 1000) {
      await prisma.minecraftVerification.delete({ where: { id: verification.id } });
      registerFailure(uuid);
      return NextResponse.json({ error: "Gone: Verification code has expired." }, { status: 410 });
    }

    // 이미 다른 웹 계정에 연동된 정품 UUID 인 경우 → 409 (P2002 500 누수 방지)
    const existing = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid } });
    if (existing && existing.id !== verification.profile_id) {
      return NextResponse.json(
        { error: "Conflict: 이 마인크래프트 계정은 이미 다른 웹 계정에 연동되어 있습니다." },
        { status: 409 }
      );
    }

    // 계정 연동 + 사용된 코드 폐기 (원자적)
    await prisma.$transaction([
      prisma.profile.update({
        where: { id: verification.profile_id },
        data: { minecraft_uuid: uuid, minecraft_username: username },
      }),
      prisma.minecraftVerification.delete({ where: { id: verification.id } }),
    ]);
    await syncBridgeFromProfile(verification.profile_id); // 브리지된 허브 계정에 미러링

    clearFailures(uuid);
    console.log(
      `Linked Minecraft account ${username} (${uuid}) -> Profile ${verification.profile_id}`
    );

    return NextResponse.json({
      success: true,
      message: "Successfully linked Minecraft account.",
      linkedTo: verification.profile.creator_name,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error linking Minecraft account:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

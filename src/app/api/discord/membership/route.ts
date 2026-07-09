import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { DISCORD_API_SECRET } from "@/lib/discordApiSecret";
import { applyGuildMembership } from "@/lib/roleSync";

/**
 * POST /api/discord/membership
 * 디스코드 봇이 길드(서버) 멤버의 **이탈/재가입**을 알려 건축 권한을 자동 회수/복구한다.
 *   - Body: { discord_id: string, in_guild: boolean }. HMAC(DISCORD_API_SECRET) 필수(/api/discord/role 과 동일).
 *   - in_guild=false(이탈) → discord_in_guild=false → evaluateBuildAccess 로 builder→default 강등 + 웹 대시보드 회수.
 *   - in_guild=true(재가입) → discord_in_guild=true → 3종 인증 충족 시 default→builder 자동 복구.
 *
 * ⚠ discord_id 는 지우지 않는다(로그인 수단·재가입 자동복구 보존; 개인정보 파기는 계정 탈퇴 경로에서만).
 *    특권 역할(creator/official/manager/admin)은 evaluateBuildAccess 가 건너뛰므로 이 경로로 강등되지 않는다.
 *    연동된 웹 계정이 없으면(봇은 전 멤버 대상으로 호출) 조용히 성공 처리(linked:false) — ID 열거 정보 노출 방지.
 *    경쟁조건(연동 직후 이탈 이벤트가 방금 set 한 true 를 덮어씀)은 강등 방향(fail-safe·user 역할 한정)이고,
 *    정기 재조정 스윕(discordGuildSweep)이 실제 멤버십으로 최종 정정하므로 자가 치유된다.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"), DISCORD_API_SECRET)) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const { discord_id, in_guild } = JSON.parse(rawBody) ?? {};
    if (!discord_id || typeof in_guild !== "boolean") {
      return NextResponse.json({ error: "Bad Request: invalid discord_id or in_guild." }, { status: 400 });
    }

    const profile = await prisma.profile.findFirst({
      where: { discord_id: String(discord_id) },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json({ success: true, linked: false });
    }

    const r = await applyGuildMembership(profile.id, in_guild);
    return NextResponse.json({ success: true, ...r, in_guild });
  } catch (error: unknown) {
    console.error("Discord membership sync error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

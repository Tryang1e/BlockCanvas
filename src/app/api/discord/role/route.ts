import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { DISCORD_API_SECRET } from "@/lib/discordApiSecret";
import { syncRoleFromDiscord } from "@/lib/roleSync";

// Discord 자동화로 부여 가능한 웹 role. **보안상 admin 은 제외** — 어드민 권한은 어드민 패널에서만 부여한다
// (Discord 역할만 얻으면 웹 관리자가 되는 권한 상승을 차단).
const VALID_ROLES = new Set(["user", "creator", "official"]);

/**
 * POST /api/discord/role
 * 디스코드 봇이 멤버의 Discord 역할 변경을 알려 웹 role 을 갱신한다(3중 동기화의 2·3티어).
 * Body: { discord_id: string, role: "user" | "creator" | "official" }. HMAC(DISCORD_API_SECRET) 필수.
 * 실제 적용(승급·강등·Web→MC LuckPerms 푸시·감사)은 syncRoleFromDiscord 가 수행한다.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"), DISCORD_API_SECRET)) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const { discord_id, role } = JSON.parse(rawBody) ?? {};
    const target = String(role ?? "").toLowerCase();
    if (!discord_id || !VALID_ROLES.has(target)) {
      return NextResponse.json({ error: "Bad Request: invalid discord_id or role." }, { status: 400 });
    }

    const r = await syncRoleFromDiscord(String(discord_id), target);
    if (!r.linked) {
      // 연동된 웹 계정이 없으면 조용히 성공 처리(봇이 모든 멤버 대상으로 호출할 수 있으므로 404 아님).
      return NextResponse.json({ success: true, linked: false });
    }
    return NextResponse.json({ success: true, ...r });
  } catch (error: unknown) {
    console.error("Discord role sync error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

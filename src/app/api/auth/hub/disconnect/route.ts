import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyHubSession, HUB_COOKIE } from "@/lib/hubSession";
import { cookieDomain } from "@/lib/publicUrl";

/** POST /api/auth/hub/disconnect { provider } — 허브에서 한 제공자 연결 해제. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const accountId = verifyHubSession(cookieStore.get(HUB_COOKIE)?.value);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const provider = body?.provider;
  if (provider !== "discord" && provider !== "minecraft" && provider !== "web") {
    return NextResponse.json({ error: "Bad provider" }, { status: 400 });
  }

  // 웹(craftopia) 브리지 해제 — 허브 계정은 유지
  if (provider === "web") {
    await prisma.linkedAccount.update({ where: { id: accountId }, data: { profile_id: null } });
    return NextResponse.json({ success: true });
  }

  const data =
    provider === "discord"
      ? { discord_id: null, discord_username: null }
      : { minecraft_uuid: null, minecraft_username: null };

  const updated = await prisma.linkedAccount.update({ where: { id: accountId }, data });

  // 둘 다 비면 계정 삭제 + 세션 종료
  if (!updated.discord_id && !updated.minecraft_uuid) {
    await prisma.linkedAccount.delete({ where: { id: accountId } });
    const res = NextResponse.json({ success: true, loggedOut: true });
    res.cookies.set(HUB_COOKIE, "", { maxAge: 0, path: "/", domain: cookieDomain(req) });
    return res;
  }
  return NextResponse.json({ success: true });
}

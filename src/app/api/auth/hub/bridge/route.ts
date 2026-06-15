import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyHubSession, HUB_COOKIE } from "@/lib/hubSession";
import { verifySession } from "@/lib/session";
import { bridgeProfile } from "@/lib/hub";

/**
 * POST /api/auth/hub/bridge
 * 현재 허브 세션을, 같은 브라우저에 로그인된 craftopia 크리에이터 계정에 연결한다.
 * (허브 세션 + 크리에이터 세션 둘 다 필요)
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const linkedAccountId = verifyHubSession(cookieStore.get(HUB_COOKIE)?.value);
  if (!linkedAccountId) {
    return NextResponse.json({ error: "허브 로그인이 필요합니다." }, { status: 401 });
  }
  const creatorName = verifySession(cookieStore.get("session")?.value);
  if (!creatorName) {
    return NextResponse.json({ error: "craftopia 로그인이 필요합니다." }, { status: 401 });
  }

  const r = await bridgeProfile(linkedAccountId, creatorName);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ success: true, creatorName: r.creatorName });
}

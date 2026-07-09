import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { exchangeCodeForIdentity } from "@/lib/minecraftOAuth";
import { evaluateBuildAccess } from "@/lib/roleSync";
import { oauthRedirectUri, publicUrl, creatorUrl } from "@/lib/publicUrl";
import { isIdentityBlockedStrict } from "@/lib/blocklist";

/**
 * GET /api/auth/minecraft/callback
 * 로그인된 크리에이터 Profile 에 마크(정품 Java) 계정을 연동한다.
 * redirect_uri / 리다이렉트 대상 모두 공개 호스트 기준(터널 대응).
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const savedState = cookieStore.get("mc_oauth_state")?.value;
  const redirectUri = oauthRedirectUri(req, "/api/auth/minecraft/callback");

  const clear = (res: NextResponse) => {
    res.cookies.set("mc_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  const creatorName = verifySession(cookieStore.get("session")?.value);
  if (!creatorName) return clear(NextResponse.redirect(publicUrl(req, "/")));

  // 중앙화: OAuth 가 auth.<base> 에서 처리되므로, 결과는 크리에이터 본인 서브도메인 대시보드로 되돌린다.
  const accountUrl = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return creatorUrl(req, creatorName, `/dashboard/connections${qs ? `?${qs}` : ""}`);
  };

  if (oauthError) return clear(NextResponse.redirect(accountUrl({ mc_error: oauthError })));
  if (!code || !state || !savedState || state !== savedState) {
    return clear(NextResponse.redirect(accountUrl({ mc_error: "invalid_state" })));
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { creator_name: creatorName.toLowerCase() } });
    if (!profile) return clear(NextResponse.redirect(publicUrl(req, "/")));

    const identity = await exchangeCodeForIdentity(code, redirectUri);

    // 접근 차단 목록 대조 — 제재 회피(부계정) 방지. 차단된 마크 계정은 연동을 거부한다.
    // 조회 장애 시 strict 가 throw → 아래 연동(update) 대신 catch 로 빠져 연동을 완료하지 않는다(fail-closed).
    if (await isIdentityBlockedStrict("minecraft_uuid", identity.uuid)) {
      return clear(NextResponse.redirect(accountUrl({ mc_error: "blocked" })));
    }

    const existing = await prisma.profile.findUnique({ where: { minecraft_uuid: identity.uuid } });
    if (existing && existing.id !== profile.id) {
      return clear(NextResponse.redirect(accountUrl({ mc_error: "already_linked" })));
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { minecraft_uuid: identity.uuid, minecraft_username: identity.username },
    });
    // MS OAuth 로 마크 연동했으니 3종 인증 충족 여부 재평가 → 인게임 건축 권한 자동 반영
    await evaluateBuildAccess(profile.id).catch(() => {});
    return clear(NextResponse.redirect(accountUrl({ mc_linked: "1" })));
  } catch (error: unknown) {
    console.error("Minecraft OAuth callback error:", error instanceof Error ? error.message : String(error));
    return clear(NextResponse.redirect(accountUrl({ mc_error: "oauth_failed" })));
  }
}

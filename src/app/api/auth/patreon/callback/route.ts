import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForPatreonMembership } from "@/lib/patreonOAuth";
import { grantPatreonSubscription } from "@/lib/patreonGrant";
import { verifySession } from "@/lib/session";
import { oauthRedirectUri, publicUrl, mainSiteUrl, creatorUrl } from "@/lib/publicUrl";

/**
 * GET /api/auth/patreon/callback — Patreon 은 '후원 연결 전용'(로그인/자동가입 불가, Discord 와 동일).
 *  - 로그인 상태: 현재 Profile 에 patreon_user_id 연결(다른 Profile 이 점유 중이면 거부).
 *    활성 후원자면 구독을 부여한다(멱등, grantPatreonSubscription — 코인 차감 없음).
 *  - 비로그인: 먼저 이메일로 로그인(craftopia.work/login)한 뒤 계정에서 Patreon 을 연결하도록 안내한다.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const savedState = cookieStore.get("pt_oauth_state")?.value;

  const hub = (q: string) => publicUrl(req, `/auth${q}`);
  // 연결을 시작한 그 유저의 대시보드(연동 페이지)로 되돌린다 — 성공/오류를 시작한 자리에서 그대로 보여준다.
  // (콜백은 auth.<base> 에서 돌지만 세션 쿠키가 .<base> 전체 공유라 서브도메인 복귀가 정상 동작.)
  const conn = (creatorName: string, q: string) => creatorUrl(req, creatorName, `/dashboard/connections${q}`);
  const clear = (res: NextResponse) => {
    res.cookies.set("pt_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (oauthError) return clear(NextResponse.redirect(hub(`?error=${encodeURIComponent(oauthError)}`)));
  if (!code || !state || !savedState || state !== savedState) {
    return clear(NextResponse.redirect(hub("?error=invalid_state")));
  }

  try {
    const redirectUri = oauthRedirectUri(req, "/api/auth/patreon/callback");
    const membership = await exchangeCodeForPatreonMembership(code, redirectUri);

    const currentName = verifySession(cookieStore.get("session")?.value);

    // ── 로그인 상태: 현재 Profile 에 Patreon 연결 ──
    if (currentName) {
      const me = await prisma.profile.findUnique({ where: { creator_name: currentName.toLowerCase() } });
      if (me) {
        const owner = await prisma.profile.findFirst({ where: { patreon_user_id: membership.userId } });
        if (owner && owner.id !== me.id) {
          return clear(
            NextResponse.redirect(conn(me.creator_name, `?connected=patreon&error=${encodeURIComponent("이 Patreon 계정은 이미 다른 계정에 연결되어 있습니다.")}`))
          );
        }
        await prisma.profile.update({
          where: { id: me.id },
          data: { patreon_user_id: membership.userId, patreon_full_name: membership.fullName },
        });

        // 활성 후원자면 구독 부여(멱등, 코인 차감 없음). ⚠ 부여가 실제로 성공한 경우에만 sub=1 —
        // 실패를 삼키고 sub=1 로 보내면 UI 가 '구독 적용됨' 거짓 표시를 하게 된다.
        if (membership.isActivePatron) {
          try {
            await grantPatreonSubscription({
              id: me.id,
              creator_name: me.creator_name,
              minecraft_uuid: me.minecraft_uuid,
              role: me.role,
            });
            return clear(NextResponse.redirect(conn(me.creator_name, "?connected=patreon&sub=1")));
          } catch (e) {
            // 연결(patreon_user_id)은 이미 됐지만 구독 부여만 실패 — 재연결 시 멱등 재시도됨(subscriptionUntilAtLeast).
            console.error("Patreon grant error:", e instanceof Error ? e.message : String(e));
            return clear(NextResponse.redirect(conn(me.creator_name, "?connected=patreon&sub=pending")));
          }
        }
        // 연결됐지만 활성 후원자가 아님 — 후원 후 다시 연결하면 구독이 적용됨을 UI 가 안내.
        return clear(NextResponse.redirect(conn(me.creator_name, "?connected=patreon&sub=0")));
      }
      // me 가 없으면(세션 stale) 아래 비로그인 안내로 폴백
    }

    // ── 비로그인: Patreon 은 연결 전용 — 계정 생성/로그인 모두 하지 않는다. ──
    const guideMsg =
      "Patreon은 후원 연결 전용입니다. 먼저 이메일로 로그인한 뒤 계정에서 Patreon을 연결해 주세요.";
    return clear(NextResponse.redirect(mainSiteUrl(req, `/login?message=${encodeURIComponent(guideMsg)}`)));
  } catch (error: unknown) {
    console.error("Patreon callback error:", error instanceof Error ? error.message : String(error));
    return clear(NextResponse.redirect(hub("?error=oauth_failed")));
  }
}

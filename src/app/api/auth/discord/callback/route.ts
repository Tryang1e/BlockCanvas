import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForDiscordIdentity, isDiscordGuildMember, isGuildGateEnabled } from "@/lib/discordOAuth";
import { verifySession } from "@/lib/session";
import { evaluateBuildAccess } from "@/lib/roleSync";
import { oauthRedirectUri, publicUrl, mainSiteUrl } from "@/lib/publicUrl";
import { isIdentityBlockedStrict } from "@/lib/blocklist";

/**
 * GET /api/auth/discord/callback — Discord 는 '계정 연동 전용'(로그인/자동가입 불가).
 *  - 로그인 상태: 현재 Profile 에 discord_id 연결(다른 Profile 이 점유 중이면 거부).
 *  - 비로그인: 계정 생성·Discord 로그인 모두 하지 않고, 메인 도메인 로그인 페이지로 안내한다.
 *    (웹 가입은 이메일로만 — craftopia.work/login)
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const savedState = cookieStore.get("dc_oauth_state")?.value;

  const hub = (q: string) => publicUrl(req, `/auth${q}`);
  const clear = (res: NextResponse) => {
    res.cookies.set("dc_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (oauthError) return clear(NextResponse.redirect(hub(`?error=${encodeURIComponent(oauthError)}`)));
  if (!code || !state || !savedState || state !== savedState) {
    return clear(NextResponse.redirect(hub("?error=invalid_state")));
  }

  try {
    const redirectUri = oauthRedirectUri(req, "/api/auth/discord/callback");
    const identity = await exchangeCodeForDiscordIdentity(code, redirectUri);

    // 접근 차단 목록 대조 — 제재 회피(부계정) 방지. 차단된 Discord 계정은 연동을 거부한다.
    // 조회 장애 시 strict 가 throw → 아래 연동(update) 대신 catch(oauth_failed)로 빠져 연동을 완료하지 않는다(fail-closed).
    if (await isIdentityBlockedStrict("discord_id", identity.id)) {
      return clear(
        NextResponse.redirect(hub(`?error=${encodeURIComponent("이 Discord 계정은 이용이 제한되어 연동할 수 없습니다.")}`))
      );
    }

    const currentName = verifySession(cookieStore.get("session")?.value);

    // ── 로그인 상태: 현재 Profile 에 Discord 연결 ──
    if (currentName) {
      const me = await prisma.profile.findUnique({ where: { creator_name: currentName.toLowerCase() } });
      if (me) {
        const owner = await prisma.profile.findFirst({ where: { discord_id: identity.id } });
        if (owner && owner.id !== me.id) {
          return clear(
            NextResponse.redirect(hub(`?error=${encodeURIComponent("이 Discord 계정은 이미 다른 계정에 연결되어 있습니다.")}`))
          );
        }
        // 길드 게이트: Discord 서버(길드)에 실제 참여 중인 회원만 연동을 허용한다.
        //  - 게이트 켜짐(봇 토큰+길드 ID 설정): 멤버면 통과, 아니면 거부. 조회 장애(429·네트워크)는
        //    fail-closed(연동 보류) — 위 blocklist strict 와 동일 철학.
        //  - 게이트 꺼짐: **운영(production)에서는 설정 누락=misconfig 로 보고 fail-closed(discord_in_guild=false,
        //    미인증)** — 비멤버가 설정 공백을 틈타 인증되는 우회를 막는다(env 설정 후 재연동/스윕이 정상화).
        //    개발/로컬에서는 3종 인증 흐름을 테스트할 수 있도록 통과 처리한다.
        let inGuild: boolean;
        if (isGuildGateEnabled()) {
          try {
            inGuild = await isDiscordGuildMember(identity.id);
          } catch {
            return clear(NextResponse.redirect(hub("?error=guild_check_failed")));
          }
          if (!inGuild) {
            // 미가입자 — 허브가 이 코드를 보고 안내 메시지 + "서버 참여하기" 초대 버튼을 함께 띄운다.
            return clear(NextResponse.redirect(hub("?error=not_guild_member")));
          }
        } else {
          inGuild = process.env.NODE_ENV !== "production";
        }
        await prisma.profile.update({
          where: { id: me.id },
          data: { discord_id: identity.id, discord_username: identity.username, discord_in_guild: inGuild },
        });
        // Discord 연결로 3종 인증이 충족됐는지 재평가 → 인게임 건축 권한 자동 반영
        await evaluateBuildAccess(me.id).catch(() => {});
        return clear(NextResponse.redirect(hub("?connected=discord")));
      }
      // me 가 없으면(세션 stale) 아래 비로그인 안내로 폴백
    }

    // ── 비로그인: Discord 는 연동 전용 — 계정 생성/로그인 모두 하지 않는다. ──
    // 먼저 이메일로 로그인(craftopia.work/login)한 뒤, 계정에서 Discord 를 연동하도록 안내한다.
    const guideMsg =
      "Discord는 계정 연동 전용입니다. 먼저 이메일로 로그인한 뒤 계정에서 Discord를 연동해 주세요.";
    return clear(NextResponse.redirect(mainSiteUrl(req, `/login?message=${encodeURIComponent(guideMsg)}`)));
  } catch (error: unknown) {
    console.error("Discord callback error:", error instanceof Error ? error.message : String(error));
    return clear(NextResponse.redirect(hub("?error=oauth_failed")));
  }
}

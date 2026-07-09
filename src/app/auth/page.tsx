import { cookies, headers } from "next/headers";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { isDiscordOAuthConfigured } from "@/lib/discordOAuth";
import { isOAuthConfigured as isMinecraftOAuthConfigured } from "@/lib/minecraftOAuth";
import HubConnections from "@/components/auth/HubConnections";

export const dynamic = "force-dynamic";

function hubErrorText(code: string): string {
  switch (code) {
    case "invalid_state":
      return "보안 검증에 실패했습니다. 다시 시도해주세요.";
    case "oauth_failed":
      return "인증에 실패했습니다. 다시 시도해주세요.";
    case "discord_not_configured":
      return "Discord 로그인이 아직 설정되지 않았습니다.";
    case "not_guild_member":
      return "먼저 Discord 서버에 참여한 뒤 연동해 주세요.";
    case "guild_check_failed":
      return "Discord 서버 참여 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      try {
        return decodeURIComponent(code);
      } catch {
        return "오류가 발생했습니다.";
      }
  }
}

/** 현재 공개 호스트(auth.craftopia.work)에서 베이스 도메인을 구해 대시보드 절대 URL 생성. */
async function buildDashboardHref(creatorName: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "craftopia.work";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = !isLocal || h.get("x-forwarded-proto") === "https" ? "https" : "http";
  // auth.craftopia.work → craftopia.work / auth.localhost:3000 → localhost:3000
  const baseDomain = isLocal ? host.split(".").slice(-1).join(".") : host.split(".").slice(-2).join(".");
  return `${proto}://${creatorName}.${baseDomain}/dashboard`;
}

/** 메인(루트) 도메인 절대 URL. auth.craftopia.work → craftopia.work 로 가입/로그인을 보낸다. */
async function buildMainUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "craftopia.work";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = !isLocal || h.get("x-forwarded-proto") === "https" ? "https" : "http";
  const baseDomain = isLocal ? host.split(".").slice(-1).join(".") : host.split(".").slice(-2).join(".");
  return `${proto}://${baseDomain}${path}`;
}

/**
 * 마크 OAuth 중앙화: MS 로그인 시작 URL을 단일 호스트(auth.<base>) 기준 절대경로로 만든다.
 * (대시보드 connections 의 buildMsLoginUrl 과 동일 규칙 — Azure redirect_uri 1개를 공유)
 */
async function buildMsLoginUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "craftopia.work";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = !isLocal || h.get("x-forwarded-proto") === "https" ? "https" : "http";
  const base = isLocal ? host : host.split(".").slice(-2).join(".");
  const authHost = isLocal ? host : `auth.${base}`;
  return `${proto}://${authHost}/api/auth/minecraft/start`;
}

export default async function AuthHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const creatorName = verifySession(cookieStore.get("session")?.value);
  const profile = creatorName
    ? await prisma.profile.findUnique({ where: { creator_name: creatorName.toLowerCase() } })
    : null;

  const connectedMsg = sp.connected
    ? sp.connected === "discord"
      ? "Discord 연결 완료"
      : sp.connected === "patreon"
        ? sp.sub === "1"
          ? "Patreon 후원 연결 완료 — 구독이 적용되었습니다."
          : sp.sub === "pending"
            ? "Patreon 계정은 연결됐지만 구독 적용에 일시적으로 실패했습니다. 잠시 후 다시 연결해주세요."
            : "Patreon 계정이 연결되었습니다. (활성 후원자가 아니라 구독 혜택은 적용되지 않았습니다)"
        : "로그인되었습니다"
    : null;
  const errorMsg = sp.error ? hubErrorText(sp.error) : null;
  // 미가입자(not_guild_member) 에러일 때만 "서버 참여하기" 초대 버튼을 노출한다.
  // 초대 링크는 env(DISCORD_INVITE_URL)로 관리(만료·변경 대비)하며, 미설정 시 기본 초대 링크로 폴백.
  const guildInviteUrl =
    sp.error === "not_guild_member" ? (process.env.DISCORD_INVITE_URL || "https://discord.gg/xbA5Y5QWf5") : null;

  const dashboardHref = profile ? await buildDashboardHref(profile.creator_name) : null;
  const msLoginUrl = profile ? await buildMsLoginUrl() : null;
  // 비로그인 시 이메일 로그인/가입은 메인 도메인에서(웹 가입은 이메일 전용).
  const loginHref = profile ? null : await buildMainUrl("/login");

  return (
    // 하우스 디자인: 크림 캔버스(#FAF9F5) + CAD 그리드 — 랜딩/탐색/갤러리와 동일 언어(라이트 고정)
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#FAF9F5] overflow-hidden px-6 py-20">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #E2E2D933 1px, transparent 1px), linear-gradient(to bottom, #E2E2D933 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <a
        href="https://craftopia.work"
        className="absolute left-6 top-6 sm:left-10 sm:top-10 z-50 flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase text-neutral-500 hover:text-black py-2 px-4 rounded-full border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm"
      >
        ← CRAFTOPIA.WORK
      </a>

      {/* 크롭마크 시그니처 카드 — 호버/포커스 시 네 모서리에 도면 재단선 */}
      <div className="bc-cropmark w-full max-w-[460px] bg-white border border-neutral-200 rounded-[24px] p-8 sm:p-10 shadow-[0_24px_80px_rgba(30,32,34,0.06)] relative z-10">
        <div className="flex flex-col items-center text-center mb-8 select-none">
          <p className="text-[9px] font-mono font-bold tracking-[0.25em] text-neutral-400 uppercase mb-5">
            [ AUTH_HUB // ACCOUNT_LINK ]
          </p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/logo_icon.png" alt="BlockCanvas Icon" width={40} height={40} className="h-10 w-auto object-contain" />
            <Image src="/logo_text.png" alt="BLOCK CANVAS" width={140} height={32} className="h-6 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 leading-tight">
            계정 연동<span className="text-[#FF424D]">.</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-2 font-medium tracking-wide">
            Discord · 마인크래프트 계정을 연결하세요
          </p>
        </div>

        {connectedMsg && (
          <div className="mb-5 p-3.5 text-xs font-semibold text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-center">
            {connectedMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 p-3.5 text-xs font-semibold text-rose-600 bg-rose-50/50 border border-rose-100 rounded-2xl text-center">
            {errorMsg}
            {sp.detail && (
              <div className="mt-2 text-[10px] font-mono font-normal text-rose-500/80 break-all">
                {sp.detail}
              </div>
            )}
            {guildInviteUrl && (
              <a
                href={guildInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-xs text-white bg-[#5865F2] hover:bg-[#4752C4] active:scale-[0.99] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
                </svg>
                Discord 서버 참여하기
              </a>
            )}
          </div>
        )}

        {profile ? (
          <HubConnections
            creatorName={profile.creator_name}
            displayName={profile.display_name}
            role={profile.role}
            dashboardHref={dashboardHref || "#"}
            discord={profile.discord_id ? { id: profile.discord_id, username: profile.discord_username } : null}
            minecraft={
              profile.minecraft_uuid ? { uuid: profile.minecraft_uuid, username: profile.minecraft_username } : null
            }
            discordConfigured={isDiscordOAuthConfigured()}
            minecraftConnectHref={msLoginUrl || "#"}
            minecraftConfigured={isMinecraftOAuthConfigured()}
          />
        ) : (
          <div className="space-y-3">
            <a
              href={loginHref || "/login"}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-black border border-black shadow-sm hover:bg-neutral-800 active:scale-[0.99] transition-all"
            >
              이메일로 로그인 / 회원가입
            </a>
            <p className="text-[11px] text-neutral-400 text-center pt-2">
              먼저 이메일로 가입·로그인하세요.<br />
              Discord·마인크래프트는 로그인 후 계정에서 연동할 수 있습니다.
            </p>
            <p className="text-[10px] text-neutral-400 text-center">
              계속하면{" "}
              <a href="/terms" target="_blank" className="underline hover:text-black">
                이용약관
              </a>
              {" "}및{" "}
              <a href="/privacy" target="_blank" className="underline hover:text-black">
                개인정보 처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

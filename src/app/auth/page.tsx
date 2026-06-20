import { cookies, headers } from "next/headers";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { isDiscordOAuthConfigured } from "@/lib/discordOAuth";
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
      : "로그인되었습니다"
    : null;
  const errorMsg = sp.error ? hubErrorText(sp.error) : null;

  const dashboardHref = profile ? await buildDashboardHref(profile.creator_name) : null;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#fafafa] dark:bg-[#070708] overflow-hidden px-6 py-20 transition-colors duration-500">
      {/* 격자 + 은은한 광원 (로그인 페이지와 동일 톤) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-neutral-200/20 to-neutral-100/10 dark:from-neutral-900/20 dark:to-neutral-900/10 blur-[120px] pointer-events-none" />

      <a
        href="https://craftopia.work"
        className="absolute left-6 top-6 sm:left-10 sm:top-10 z-50 flex items-center gap-2 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all py-2 px-4 rounded-full border border-neutral-200/50 dark:border-neutral-800/40 bg-white/40 dark:bg-neutral-900/30 backdrop-blur-sm shadow-sm"
      >
        craftopia.work
      </a>

      <div className="w-full max-w-[460px] bg-white/90 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800/60 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-[0_32px_120px_rgba(0,0,0,0.06)] dark:shadow-[0_32px_120px_rgba(0,0,0,0.35)] relative z-10">
        <div className="flex flex-col items-center text-center mb-8 select-none">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/logo_icon.png" alt="BlockCanvas Icon" width={40} height={40} className="h-10 w-auto object-contain dark:invert" />
            <Image src="/logo_text.png" alt="BlockCanvas" width={140} height={32} className="h-7 w-auto object-contain dark:invert" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">계정 연동</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 font-medium tracking-wide">
            Discord · 마인크래프트 계정을 연결하세요
          </p>
        </div>

        {connectedMsg && (
          <div className="mb-5 p-3.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl text-center">
            {connectedMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 p-3.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl text-center">
            {errorMsg}
            {sp.detail && (
              <div className="mt-2 text-[10px] font-mono font-normal text-rose-500/80 dark:text-rose-400/70 break-all">
                {sp.detail}
              </div>
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
          />
        ) : (
          <div className="space-y-3">
            <a
              href="/api/auth/discord/start"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-sm hover:opacity-90 active:scale-[0.99] transition-all"
              style={{ backgroundColor: "#5865F2" }}
            >
              Discord 로 계속
            </a>
            <a
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-950 active:scale-[0.99] transition-all"
            >
              이메일로 로그인 / 회원가입
            </a>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-600 text-center pt-2">
              Discord 로 로그인하면 계정이 자동으로 만들어집니다.<br />
              마인크래프트는 로그인 후 대시보드에서 Microsoft 로그인 또는 인게임 서버 인증(코드)으로 연동됩니다.
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 text-center">
              계속하면{" "}
              <a href="/privacy" target="_blank" className="underline hover:text-neutral-700 dark:hover:text-neutral-400">
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

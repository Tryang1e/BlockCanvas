import { prisma } from "@/lib/prisma";
import { lpGroupToRole, roleToLpGroup, hasFullVerification } from "@/lib/roles";
import { setMinecraftLuckPermsGroup } from "@/lib/minecraft";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { getEconomyConfig, deliverCoins } from "@/lib/economyConfig";

/**
 * LuckPerms 그룹 → 웹 role 런타임 동기화.
 * 인게임 접속(PlayerJoin) / 계정 연동(/웹연동) 시 플러그인이 플레이어의 LP 그룹을 push 하면 호출된다.
 *
 * 규칙:
 *  - uuid 에 연동된 Profile 이 없으면 no-op (linked:false).
 *  - 매핑 불가 그룹(default 등) 은 변경 안 함 (reason:"unmapped-group").
 *  - LP 그룹을 단일 진실로 삼아 역할을 그대로 따른다(승급·강등·admin 강등 모두).
 *    creator_name='admin' 슈퍼계정은 role 과 무관하게 어드민 접근이 보장돼(server-auth 바이패스) 잠기지 않음.
 *  - 변경 시 CreatorLog 감사 기록 + 쿼터 재평가(역할 변경 = 한도 변동 → 초과 시 잠금/해제 반영).
 */
export async function syncRoleFromLpGroup(
  uuid: string,
  group: string | null | undefined
): Promise<{ linked: boolean; changed: boolean; role?: string; reason?: string }> {
  const profile = await prisma.profile.findUnique({
    where: { minecraft_uuid: uuid },
    select: { id: true, role: true, creator_name: true },
  });
  if (!profile) return { linked: false, changed: false };

  const mapped = lpGroupToRole(group);
  if (!mapped) {
    return { linked: true, changed: false, role: profile.role, reason: "unmapped-group" };
  }

  // 🔒 보안 천장(C-1): 이 경로는 공유 시크릿(MINECRAFT_API_SECRET)·인게임 LP 조작만으로
  // 트리거될 수 있으므로, 특권 역할(admin·manager)을 인게임 동기화로 부여(승격)하거나
  // 기존 특권 계정을 변경(강등/탈취)하는 것을 금지한다. 특권 역할 변경은 어드민 패널에서만
  // 이뤄져야 한다(Discord 경로의 admin 보호와 대칭). 동기화 가능 역할은 user/creator/official 뿐.
  const current = (profile.role || "").toLowerCase();
  const PRIVILEGED = new Set(["admin", "manager"]);
  if (PRIVILEGED.has(mapped) || PRIVILEGED.has(current) || profile.creator_name === "admin") {
    return { linked: true, changed: false, role: profile.role, reason: "privileged-locked" };
  }

  if (current === mapped) {
    return { linked: true, changed: false, role: mapped };
  }

  // LP = 단일 진실(단, 비특권 역할 user/creator/official 한정): 승급·강등 반영.
  await prisma.profile.update({ where: { id: profile.id }, data: { role: mapped } });

  await prisma.creatorLog
    .create({
      data: {
        creator_name: profile.creator_name,
        action: "ROLE_SYNC",
        details: `LuckPerms 그룹(${group}) 기준 역할 ${profile.role} → ${mapped} 자동 동기화`,
      },
    })
    .catch(() => {});

  // 역할 변경 = 쿼터 한도 변동 → 잠금/해제 상태 재평가(베스트에포트).
  await evaluateQuota(profile.id).catch(() => {});

  return { linked: true, changed: true, role: mapped };
}

/**
 * Discord 역할 → 웹 role 동기화 (Discord 를 단일 진실로: 승급·강등 모두 자동).
 * 봇이 멤버의 Discord 역할 변경을 감지하면 `/api/discord/role` 로 알리고, 이 함수가 적용한다.
 *
 * 규칙:
 *  - discord_id 에 연동된 Profile 이 없으면 no-op (linked:false).
 *  - **admin 보호**: 현재 role 이 admin 이거나 creator_name='admin' 인 계정은 Discord 자동화로 변경하지 않는다
 *    (권한 탈취·관리 잠김 방지 — admin 승강은 어드민 패널에서만). 호출부는 애초에 admin 역할을 보내지 않음.
 *  - 변경 시: Profile.role 갱신 + CreatorLog 감사 + (연동된 마크 계정이면) LuckPerms 그룹까지 Web→MC 푸시 + 쿼터 재평가.
 */
export async function syncRoleFromDiscord(
  discordId: string,
  role: string
): Promise<{ linked: boolean; changed: boolean; role?: string; reason?: string }> {
  const target = (role || "").toLowerCase();
  const profile = await prisma.profile.findFirst({
    where: { discord_id: discordId },
    select: { id: true, role: true, creator_name: true, minecraft_uuid: true },
  });
  if (!profile) return { linked: false, changed: false };

  // 🔒 보안 천장(H-5, C-1과 대칭): 특권 역할(admin·manager)은 Discord 자동화로 부여하지 않으며,
  // 기존 admin/manager/슈퍼 계정도 이 경로로 변경하지 않는다(권한 상승 + 매니저 무단 강등 방지).
  // 특권 역할 변경은 어드민 패널에서만. (라우트 VALID_ROLES 허용목록에 더한 심층 방어.)
  const current = (profile.role || "").toLowerCase();
  if (
    target === "admin" || target === "manager" ||
    current === "admin" || current === "manager" ||
    profile.creator_name === "admin"
  ) {
    return { linked: true, changed: false, role: profile.role, reason: "privileged-locked" };
  }
  if (current === target) {
    return { linked: true, changed: false, role: target };
  }

  await prisma.profile.update({ where: { id: profile.id }, data: { role: target } });

  await prisma.creatorLog
    .create({
      data: {
        creator_name: profile.creator_name,
        action: "ROLE_SYNC",
        details: `Discord 역할 기준 역할 ${profile.role} → ${target} 자동 동기화`,
      },
    })
    .catch(() => {});

  // Web → 인게임: 연동된 마크 계정이면 LuckPerms 그룹도 맞춘다(베스트에포트).
  if (profile.minecraft_uuid) {
    const group = roleToLpGroup(target);
    if (group) {
      await setMinecraftLuckPermsGroup(profile.minecraft_uuid, group).catch((e) =>
        console.warn("discord→ingame role sync failed:", e instanceof Error ? e.message : String(e))
      );
    }
  }

  // 역할 변경 = 쿼터 한도 변동 → 재평가(베스트에포트).
  await evaluateQuota(profile.id).catch(() => {});

  return { linked: true, changed: true, role: target };
}

/**
 * 인증 완료(3종: 웹 이메일/비번 + Discord + 마크) → 인게임 건축 권한(LP `builder`) 자동 부여/회수.
 * 사용자 요청(2026-06-20): 모든 인증이 끝나면 건축 가능, 하나라도 깨지면 방문객으로 회수. 웹 role 은 바꾸지 않는다.
 *
 * 규칙:
 *  - role 이 'user' 가 아니면(creator/official/admin = 유료·어드민 영역) 건너뛴다(이 게이트가 강등하지 않음).
 *  - minecraft_uuid 가 없으면 인게임 푸시 대상이 없어 no-op.
 *  - 3종(discord_id + minecraft_uuid + email + password) 모두면 LP `builder`, 아니면 `default`(방문객).
 * 연동/해제 직후 + **접속 시**(role-sync) 호출. 접속 때 재조정하면 "웹에서 먼저 인증하고 접속한 유저"도 역할을 받는다.
 * currentGroup 을 주면 이미 목표 그룹이면 재푸시·로그를 생략한다(접속마다 스팸/불필요 푸시 방지).
 * LP 푸시는 베스트에포트(실패는 비치명적).
 */
/**
 * 3종 인증(디스코드 + 마인크래프트 + 웹가입 이메일/비밀번호) 최초 완료 시 가입 보너스 코인을 1회 지급한다.
 * 연동/인증 3경로가 모두 거쳐 가는 evaluateBuildAccess 상단에서 호출 → 어느 연동이 마지막이든 완료 순간 지급.
 *
 * 멱등성: signup_bonus_at 을 원자적(updateMany where null)으로 먼저 선점해 동시/중복 호출의 이중지급을 막는다.
 * deliverCoins 는 CMI 오프라인이어도 미전달 원장을 남겨 접속 시 flushPendingCoins 로 정산되므로,
 * 선점 후 지급이 실패해도 코인은 유실되지 않는다(다음 접속에 지급). best-effort — 실패는 로그만.
 */
export async function maybeAwardSignupBonus(profileId: string): Promise<void> {
  const p = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      creator_name: true,
      discord_id: true,
      discord_in_guild: true,
      minecraft_uuid: true,
      email: true,
      password: true,
      signup_bonus_at: true,
    },
  });
  if (!p || p.signup_bonus_at) return; // 없음/이미 지급
  if (!hasFullVerification(p)) return; // 3종 미완료

  const cfg = await getEconomyConfig();
  if (cfg.signupBonusCoin <= 0) return; // 보상 비활성(관리자 0 설정)

  // 원자적 선점 — 다른 동시 호출이 이미 표시했으면 count=0 → 지급하지 않는다(이중지급 방지).
  const claimed = await prisma.profile.updateMany({
    where: { id: p.id, signup_bonus_at: null },
    data: { signup_bonus_at: new Date() },
  });
  if (claimed.count !== 1) return;

  try {
    await deliverCoins({
      profileId: p.id,
      minecraftUuid: p.minecraft_uuid,
      amount: cfg.signupBonusCoin,
      source: "signup_verification",
      reason: "3종 인증 완료 보너스",
    });
  } catch (e) {
    // 지급 실패(예외)여도 deliverCoins 가 미전달 원장을 남겨 접속 시 정산됨 — 선점은 유지.
    console.warn("가입 보너스 지급 실패(접속 시 정산 예정):", e instanceof Error ? e.message : String(e));
  }

  await prisma.creatorLog
    .create({
      data: {
        creator_name: p.creator_name,
        action: "SIGNUP_BONUS",
        details: `3종 인증 완료 → 가입 보너스 +${cfg.signupBonusCoin}코인`,
      },
    })
    .catch(() => {});
}

export async function evaluateBuildAccess(
  profileId: string,
  currentGroup?: string | null
): Promise<{ changed: boolean; group?: string; reason?: string }> {
  // 3종 인증이 이번에 완성됐다면(어느 연동이 마지막이든) 가입 보너스를 1회 지급한다.
  // 역할 게이트(managed-tier)·미연동 조기반환보다 앞서 실행해 모든 완료 케이스를 포괄한다. best-effort.
  await maybeAwardSignupBonus(profileId).catch(() => {});

  const p = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      role: true,
      creator_name: true,
      discord_id: true,
      discord_in_guild: true,
      minecraft_uuid: true,
      email: true,
      password: true,
    },
  });
  if (!p) return { changed: false, reason: "no-profile" };
  // 유료/어드민 등급은 인증 게이트가 관리하지 않는다(creator/official/admin).
  if ((p.role || "").toLowerCase() !== "user") return { changed: false, reason: "managed-tier" };
  if (!p.minecraft_uuid) return { changed: false, reason: "no-mc" };

  const verified = hasFullVerification(p);
  const target = verified ? "builder" : "default";

  // 이미 목표 그룹이면(접속 시 현재 그룹 전달됨) 재푸시·로그 생략 — 접속마다 스팸/무의미 푸시 방지.
  if (currentGroup && currentGroup.toLowerCase() === target) {
    return { changed: false, group: target, reason: "already-correct" };
  }

  try {
    await setMinecraftLuckPermsGroup(p.minecraft_uuid, target);
  } catch (e) {
    console.warn("build-access LP push 실패:", e instanceof Error ? e.message : String(e));
    return { changed: false, reason: "lp-push-failed" };
  }

  await prisma.creatorLog
    .create({
      data: {
        creator_name: p.creator_name,
        action: "BUILD_ACCESS",
        details: `3종 인증 ${verified ? "완료 → 건축권한(builder)" : "미완료 → 방문객(default)"}`,
      },
    })
    .catch(() => {});

  return { changed: true, group: target };
}

/**
 * Discord 길드(서버) 멤버십 상태를 Profile.discord_in_guild 에 반영하고 건축 권한을 재평가한다.
 * 봇의 이탈/재가입 통지(POST /api/discord/membership)와 정기 재조정 스윕(discordGuildSweep)이 공유한다.
 *
 * 규칙:
 *  - **discord_id 는 절대 지우지 않는다** — 로그인 수단·재가입 자동복구를 보존한다(개인정보 파기는
 *    계정 탈퇴 경로에서만; 길드 이탈 ≠ 계정 탈퇴). 이탈은 discord_in_guild=false 로만 표시한다.
 *  - 상태 변경 시 CreatorLog 감사 + evaluateBuildAccess 재평가(3종 게이트가 discord_in_guild 를 보므로,
 *    이탈=builder→default 강등, 재가입=default→builder 복구가 자동으로 일어난다).
 *  - 특권 역할(creator/official/manager/admin)은 evaluateBuildAccess 가 'managed-tier' 로 건너뛰므로
 *    이 경로로 강등되지 않는다(플래그만 사실대로 갱신). best-effort — 예외는 비치명적.
 */
export async function applyGuildMembership(
  profileId: string,
  inGuild: boolean
): Promise<{ linked: boolean; changed: boolean }> {
  const p = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, creator_name: true, discord_in_guild: true },
  });
  if (!p) return { linked: false, changed: false };

  const flagChanged = p.discord_in_guild !== inGuild;
  if (flagChanged) {
    await prisma.profile.update({ where: { id: p.id }, data: { discord_in_guild: inGuild } });
    await prisma.creatorLog
      .create({
        data: {
          creator_name: p.creator_name,
          action: "DISCORD_GUILD",
          details: inGuild
            ? "Discord 서버 재가입 감지 → 건축권한 복구 재평가"
            : "Discord 서버 이탈 감지 → 건축권한 회수 재평가",
        },
      })
      .catch(() => {});
  }

  const r = await evaluateBuildAccess(p.id).catch(() => null);
  return { linked: true, changed: flagChanged || !!r?.changed };
}

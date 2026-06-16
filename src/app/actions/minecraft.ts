"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import {
  trustPlayerOnPlot,
  untrustPlayerOnPlot,
  transferPlotOwnership,
  getPlayerPlots,
} from "@/lib/minecraft";

/**
 * 로그인된 크리에이터 프로필을 가져온다. 미인증 시 throw.
 */
async function getAuthenticatedProfile() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  const creatorName = verifySession(sessionToken);

  if (!creatorName) {
    throw new Error("Unauthorized: Please log in first.");
  }

  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorName.toLowerCase() },
  });

  if (!profile) {
    throw new Error("Profile not found.");
  }

  return profile;
}

function safeParseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 현재 사용자의 마인크래프트 연동 상태와 대기 중인 인증코드를 조회.
 */
export async function getMinecraftStatus() {
  try {
    const profile = await getAuthenticatedProfile();

    const verification = await prisma.minecraftVerification.findUnique({
      where: { profile_id: profile.id },
    });

    return {
      success: true,
      linked: !!profile.minecraft_uuid,
      minecraftUuid: profile.minecraft_uuid,
      minecraftUsername: profile.minecraft_username,
      verificationCode: verification?.code || null,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 마인크래프트 연동용 6자리 인증코드를 새로 발급.
 *  - crypto.randomInt 로 예측 불가능한 난수 생성(000000~999999 전 범위)
 *  - code 는 @unique 이므로 다른 사용자와 충돌하지 않는 값을 골라 재시도
 *  - 발급 시 만료된(10분 경과) 코드들을 정리
 */
export async function generateVerificationCode() {
  try {
    const profile = await getAuthenticatedProfile();

    // housekeeping: 만료 코드 정리
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.minecraftVerification.deleteMany({ where: { created_at: { lt: cutoff } } });

    // @unique 충돌을 피해 미사용 코드 확보
    let code = "";
    for (let i = 0; i < 12; i++) {
      const candidate = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
      const clash = await prisma.minecraftVerification.findUnique({ where: { code: candidate } });
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return { success: false, error: "코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
    }

    await prisma.minecraftVerification.upsert({
      where: { profile_id: profile.id },
      update: { code, created_at: new Date() },
      create: { profile_id: profile.id, code },
    });

    return { success: true, code };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 마인크래프트 계정 연동 해제 — DB 필드 및 플롯/양도 캐시 정리.
 */
export async function unlinkMinecraftAccount() {
  try {
    const profile = await getAuthenticatedProfile();

    await prisma.$transaction([
      prisma.profile.update({
        where: { id: profile.id },
        data: { minecraft_uuid: null, minecraft_username: null },
      }),
      prisma.minecraftVerification.deleteMany({ where: { profile_id: profile.id } }),
      prisma.minecraftPlot.deleteMany({ where: { owner_id: profile.id } }),
      prisma.pendingTransfer.deleteMany({ where: { from_id: profile.id } }),
    ]);

    return { success: true, message: "Minecraft account unlinked successfully." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 내 플롯 캐시를 Spigot 서버에서 동기화(§2-A 해소).
 * 더 이상 소유하지 않는 캐시는 정리하고, 현재 소유 플롯은 upsert.
 */
export async function syncMyPlots() {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) {
      return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    }

    const res = await getPlayerPlots(profile.minecraft_uuid);
    if (!res.success) {
      return {
        success: false,
        error: res.message || "마인크래프트 서버에서 플롯 정보를 가져오지 못했습니다.",
      };
    }

    const incomingIds = res.plots.map((p) => p.id);
    await prisma.$transaction([
      // 더 이상 소유하지 않는(인게임에서 양도/삭제된) 캐시 제거
      prisma.minecraftPlot.deleteMany({
        where: { owner_id: profile.id, id: { notIn: incomingIds.length ? incomingIds : ["__none__"] } },
      }),
      ...res.plots.map((p) =>
        prisma.minecraftPlot.upsert({
          where: { id: p.id },
          update: {
            owner_id: profile.id,
            world: p.world || "world",
            alias: p.alias || null,
            center_x: p.x,
            center_z: p.z,
            members: JSON.stringify(p.members || []),
            trusted_players: JSON.stringify(p.trusted || []),
          },
          create: {
            id: p.id,
            owner_id: profile.id,
            world: p.world || "world",
            alias: p.alias || null,
            center_x: p.x,
            center_z: p.z,
            members: JSON.stringify(p.members || []),
            trusted_players: JSON.stringify(p.trusted || []),
          },
        })
      ),
    ]);

    return { success: true, count: res.plots.length };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 캐시된 내 플롯 목록 조회(대시보드 렌더용).
 */
export async function getMyPlots() {
  try {
    const profile = await getAuthenticatedProfile();
    const plots = await prisma.minecraftPlot.findMany({
      where: { owner_id: profile.id },
      orderBy: { id: "asc" },
    });

    return {
      success: true,
      plots: plots.map((p) => ({
        id: p.id,
        world: p.world,
        alias: p.alias,
        centerX: p.center_x,
        centerZ: p.center_z,
        members: safeParseJsonArray(p.members),
        trusted: safeParseJsonArray(p.trusted_players),
        updatedAt: p.updated_at,
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), plots: [] };
  }
}

/**
 * 내가 trust(초대)된 다른 사람의 플롯 목록(웹 캐시 기준 — 소유자가 sync 한 경우 노출).
 */
export async function getInvitedPlots() {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: true, plots: [] };

    const plots = await prisma.minecraftPlot.findMany({
      where: {
        owner_id: { not: profile.id },
        trusted_players: { contains: profile.minecraft_uuid },
      },
      include: { owner: { select: { creator_name: true, minecraft_username: true } } },
      orderBy: { id: "asc" },
    });

    return {
      success: true,
      plots: plots.map((p) => ({
        id: p.id,
        world: p.world,
        alias: p.alias,
        centerX: p.center_x,
        centerZ: p.center_z,
        members: safeParseJsonArray(p.members),
        trusted: safeParseJsonArray(p.trusted_players),
        ownerName: p.owner?.minecraft_username || p.owner?.creator_name || "?",
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), plots: [] };
  }
}

/**
 * 소유한 플롯에 멤버 trust 추가.
 */
export async function trustPlotMemberAction(plotId: string, playerName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = playerName?.trim();
    if (!name) return { success: false, error: "닉네임을 입력해주세요." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotId } });
    if (!plot || plot.owner_id !== profile.id) {
      throw new Error("해당 플롯의 소유자가 아니거나 캐시가 오래되었습니다. 먼저 동기화해주세요.");
    }

    const res = await trustPlayerOnPlot(plotId, name);
    if (!res.success) {
      throw new Error(res.message || "Spigot API returned an error.");
    }

    // 낙관적 캐시 갱신: 즉시 UI 반영(역방향 webhook 이 도착하면 uuid 까지 보정됨)
    try {
      const trusted = safeParseJsonArray(plot.trusted_players) as { uuid: string; name: string }[];
      if (!trusted.some((t) => (t?.name || "").toLowerCase() === name.toLowerCase())) {
        trusted.push({ uuid: "", name });
        await prisma.minecraftPlot.update({
          where: { id: plotId },
          data: { trusted_players: JSON.stringify(trusted) },
        });
      }
    } catch {
      /* 낙관적 갱신 실패는 치명적이지 않음 — 다음 sync/webhook 에서 정정됨 */
    }

    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_trust", target_id: plotId, details: name },
    });

    return { success: true, message: `${name} 님을 플롯 ${plotId} 에 초대했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 소유한 플롯에서 멤버 trust 회수.
 */
export async function untrustPlotMemberAction(plotId: string, playerName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = playerName?.trim();
    if (!name) return { success: false, error: "닉네임을 입력해주세요." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotId } });
    if (!plot || plot.owner_id !== profile.id) {
      throw new Error("해당 플롯의 소유자가 아니거나 캐시가 오래되었습니다. 먼저 동기화해주세요.");
    }

    const res = await untrustPlayerOnPlot(plotId, name);
    if (!res.success) {
      throw new Error(res.message || "Spigot API returned an error.");
    }

    // 낙관적 캐시 갱신: 해당 이름을 즉시 목록에서 제거
    try {
      const trusted = (safeParseJsonArray(plot.trusted_players) as { uuid: string; name: string }[]).filter(
        (t) => (t?.name || "").toLowerCase() !== name.toLowerCase()
      );
      await prisma.minecraftPlot.update({
        where: { id: plotId },
        data: { trusted_players: JSON.stringify(trusted) },
      });
    } catch {
      /* 낙관적 갱신 실패는 치명적이지 않음 */
    }

    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_untrust", target_id: plotId, details: name },
    });

    return { success: true, message: `${name} 님을 플롯 ${plotId} 에서 제외했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 소유권 양도 신청(2단계 수락). 실제 변경은 인게임 /웹연동 수락 으로 완료된다.
 * 웹측에는 PendingTransfer 로 기록해 UI 상태 표시 + 분쟁 증빙(감사)을 남긴다.
 */
export async function transferPlotOwnerAction(plotId: string, targetName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = targetName?.trim();
    if (!name) return { success: false, error: "양도 대상 닉네임을 입력해주세요." };
    if (!profile.minecraft_uuid) {
      return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    }

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotId } });
    if (!plot || plot.owner_id !== profile.id) {
      throw new Error("해당 플롯의 소유자가 아니거나 캐시가 오래되었습니다. 먼저 동기화해주세요.");
    }

    // requester_uuid 를 함께 보내 마크 서버가 "현재 소유자 == 신청자" 를 검증한다(탈취 차단)
    const res = await transferPlotOwnership(plotId, name, profile.minecraft_uuid);
    if (!res.success) {
      throw new Error(res.message || "Spigot API returned an error.");
    }

    // 동일 플롯의 기존 pending 신청은 정리 후 새로 기록
    await prisma.$transaction([
      prisma.pendingTransfer.deleteMany({ where: { from_id: profile.id, plot_id: plotId, status: "pending" } }),
      prisma.pendingTransfer.create({
        data: { plot_id: plotId, from_id: profile.id, target_name: name, status: "pending" },
      }),
      prisma.creatorLog.create({
        data: { creator_name: profile.creator_name, action: "mc_plot_transfer_request", target_id: plotId, details: name },
      }),
    ]);

    return {
      success: true,
      message: "양도 신청이 전송되었습니다. 대상 유저가 인게임에서 /웹연동 수락 을 입력해야 최종 완료됩니다.",
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 내가 신청한 양도 대기 목록(UI 표시용).
 */
export async function getMyPendingTransfers() {
  try {
    const profile = await getAuthenticatedProfile();
    const transfers = await prisma.pendingTransfer.findMany({
      where: { from_id: profile.id, status: "pending" },
      orderBy: { created_at: "desc" },
    });
    return { success: true, transfers };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), transfers: [] };
  }
}

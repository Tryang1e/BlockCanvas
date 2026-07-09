"use server";

import { prisma } from "@/lib/prisma";
import { sessionProfile, resolveViewProfile } from "@/lib/server-auth";
import {
  trustPlayerOnPlot,
  untrustPlayerOnPlot,
  transferPlotOwnership,
  acceptPlotTransfer,
  rejectPlotTransfer,
  getPlayerPlots,
  claimPlot,
  getPlotClaimInfo,
  deletePlot,
  getEconomyBalance,
  transferCoins,
  listAuction,
  cancelAuction,
  buyAuction,
  setMinecraftLuckPermsGroup,
  plotCacheId,
} from "@/lib/minecraft";
import { resolveInvitedPlotIds, isInviteBlockedByName } from "@/lib/worldInvites";
import { resolveMinecraftUuid } from "@/lib/minecraftResolve";
import { canUseBuildDashboard } from "@/lib/roles";
import { logCoinSpend } from "@/lib/economyConfig";

/**
 * 로그인된 크리에이터 프로필을 가져온다. 미인증 시 throw.
 */
async function getAuthenticatedProfile() {
  const profile = await sessionProfile(); // 서명·만료·token_version 대조까지 (무효화 세션 거부)
  if (!profile) {
    throw new Error("Unauthorized: Please log in first.");
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
 * 현재 사용자의 마인크래프트 연동 상태를 조회.
 * (연동은 auth.craftopia.work 의 Microsoft 정품 로그인 단일 경로 — 인게임 코드 방식은 폐지)
 */
export async function getMinecraftStatus() {
  try {
    const profile = await getAuthenticatedProfile();
    return {
      success: true,
      linked: !!profile.minecraft_uuid,
      minecraftUuid: profile.minecraft_uuid,
      minecraftUsername: profile.minecraft_username,
    };
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
    const oldUuid = profile.minecraft_uuid;

    await prisma.$transaction([
      prisma.profile.update({
        where: { id: profile.id },
        data: { minecraft_uuid: null, minecraft_username: null },
      }),
      prisma.minecraftPlot.deleteMany({ where: { owner_id: profile.id } }),
      prisma.pendingTransfer.deleteMany({ where: { from_id: profile.id } }),
    ]);

    // 마크 연동 해제 = 3종 인증 붕괴 → 인게임 건축 권한 회수(일반 user 한정, 유료/어드민 등급은 미관여)
    if (oldUuid && (profile.role || "").toLowerCase() === "user") {
      await setMinecraftLuckPermsGroup(oldUuid, "default").catch(() => {});
    }

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

    // 캐시 키는 (world, plotId) 복합 — 같은 plotId 가 여러 플롯월드에 있어도 충돌하지 않게.
    const incomingIds = res.plots.map((p) => plotCacheId(p.world, p.id));
    await prisma.$transaction([
      // 더 이상 소유하지 않는(인게임에서 양도/삭제된) 캐시 제거. (레거시 바레 plotId 행도 notIn 으로 함께 정리됨)
      prisma.minecraftPlot.deleteMany({
        where: { owner_id: profile.id, id: { notIn: incomingIds.length ? incomingIds : ["__none__"] } },
      }),
      ...res.plots.map((p) =>
        prisma.minecraftPlot.upsert({
          where: { id: plotCacheId(p.world, p.id) },
          update: {
            owner_id: profile.id,
            plot_id: p.id,
            world: p.world || "world",
            alias: p.alias || null,
            center_x: p.x,
            center_z: p.z,
            members: JSON.stringify(p.members || []),
            trusted_players: JSON.stringify(p.trusted || []),
          },
          create: {
            id: plotCacheId(p.world, p.id),
            plot_id: p.id,
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
export async function getMyPlots(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    const plots = await prisma.minecraftPlot.findMany({
      where: { owner_id: profile.id },
      orderBy: { plot_id: "asc" },
    });

    return {
      success: true,
      plots: plots.map((p) => ({
        id: p.plot_id || p.id, // 바레 plotId(레거시 행은 plot_id 가 비어 id 로 폴백)
        world: p.world,
        alias: p.alias,
        centerX: p.center_x,
        centerZ: p.center_z,
        members: safeParseJsonArray(p.members),
        trusted: safeParseJsonArray(p.trusted_players),
        auctionPrice: p.auction_price,
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
export async function getInvitedPlots(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    if (!profile.minecraft_uuid) return { success: true, plots: [] };

    // uuid 또는 닉네임(초대 직후 낙관적 캐시는 uuid 가 빈 값)으로 매칭 + 빈 uuid 자가치유
    const ids = await resolveInvitedPlotIds({
      profileId: profile.id,
      uuid: profile.minecraft_uuid,
      username: profile.minecraft_username,
    });
    if (ids.size === 0) return { success: true, plots: [] };

    const plots = await prisma.minecraftPlot.findMany({
      where: { id: { in: [...ids] } },
      include: { owner: { select: { creator_name: true, minecraft_username: true } } },
      orderBy: { plot_id: "asc" },
    });

    return {
      success: true,
      plots: plots.map((p) => ({
        id: p.plot_id || p.id, // 바레 plotId(레거시 폴백)
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
export async function trustPlotMemberAction(plotId: string, playerName: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = playerName?.trim();
    if (!name) return { success: false, error: "닉네임을 입력해주세요." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, plotId) } });
    if (!plot || plot.owner_id !== profile.id) {
      throw new Error("해당 플롯의 소유자가 아니거나 캐시가 오래되었습니다. 먼저 동기화해주세요.");
    }

    if (await isInviteBlockedByName(name)) {
      return { success: false, error: "해당 플레이어는 초대할 수 없습니다." };
    }

    const res = await trustPlayerOnPlot(plotId, name, world);
    if (!res.success) {
      throw new Error(res.message || "Spigot API returned an error.");
    }

    // 낙관적 캐시 갱신: 즉시 UI 반영(역방향 webhook 이 도착하면 uuid 까지 보정됨)
    try {
      const trusted = safeParseJsonArray(plot.trusted_players) as { uuid: string; name: string }[];
      if (!trusted.some((t) => (t?.name || "").toLowerCase() === name.toLowerCase())) {
        trusted.push({ uuid: "", name });
        await prisma.minecraftPlot.update({
          where: { id: plotCacheId(world, plotId) },
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
export async function untrustPlotMemberAction(plotId: string, playerName: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = playerName?.trim();
    if (!name) return { success: false, error: "닉네임을 입력해주세요." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, plotId) } });
    if (!plot || plot.owner_id !== profile.id) {
      throw new Error("해당 플롯의 소유자가 아니거나 캐시가 오래되었습니다. 먼저 동기화해주세요.");
    }

    const res = await untrustPlayerOnPlot(plotId, name, world);
    if (!res.success) {
      throw new Error(res.message || "Spigot API returned an error.");
    }

    // 낙관적 캐시 갱신: 해당 이름을 즉시 목록에서 제거
    try {
      const trusted = (safeParseJsonArray(plot.trusted_players) as { uuid: string; name: string }[]).filter(
        (t) => (t?.name || "").toLowerCase() !== name.toLowerCase()
      );
      await prisma.minecraftPlot.update({
        where: { id: plotCacheId(world, plotId) },
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
 * 초대 차단 on/off (본인 설정). 켜면 누구도 나(=내 마크 닉네임)를 플롯/월드에 초대(trust)할 수 없다.
 * 판정은 닉네임 기준(isInviteBlockedByName)이라 웹·인게임 양쪽에서 동일하게 적용된다.
 */
export async function setInviteBlock(enabled: boolean) {
  try {
    const profile = await getAuthenticatedProfile();
    await prisma.profile.update({ where: { id: profile.id }, data: { block_invites: enabled } });
    return { success: true as const, blocked: enabled };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 초대받은(trusted/member) 플롯에서 본인이 스스로 나간다(원치 않은 초대 탈퇴). 소유자는 사용 불가.
 * 플러그인 untrust(PlotSquared removeTrusted+removeMember)로 권한을 회수한 뒤 캐시를 정리한다.
 */
export async function leavePlotAction(plotId: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_username) return { success: false, error: "마인크래프트 계정 연동이 필요합니다." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, plotId) } });
    if (!plot) return { success: false, error: "플롯을 찾을 수 없습니다. 캐시가 오래되었을 수 있습니다." };
    if (plot.owner_id === profile.id) return { success: false, error: "소유한 플롯은 나갈 수 없습니다." };

    const myName = profile.minecraft_username.toLowerCase();
    const isMe = (m: { uuid?: string; name?: string }) =>
      (!!m?.uuid && m.uuid === profile.minecraft_uuid) || ((m?.name || "").toLowerCase() === myName);
    const trusted = safeParseJsonArray(plot.trusted_players) as { uuid?: string; name?: string }[];
    const members = safeParseJsonArray(plot.members) as { uuid?: string; name?: string }[];
    if (!trusted.some(isMe) && !members.some(isMe)) return { success: false, error: "초대된 플롯이 아닙니다." };

    // 플러그인에 본인 untrust 요청(권위 = PlotSquared). untrust 는 멱등이라 캐시가 약간 stale 해도 안전.
    const res = await untrustPlayerOnPlot(plotId, profile.minecraft_username, world);
    if (!res.success) throw new Error(res.message || "Spigot API returned an error.");

    // 낙관적 캐시 갱신: 내 항목을 trusted/members 에서 즉시 제거
    try {
      await prisma.minecraftPlot.update({
        where: { id: plotCacheId(world, plotId) },
        data: { trusted_players: JSON.stringify(trusted.filter((m) => !isMe(m))), members: JSON.stringify(members.filter((m) => !isMe(m))) },
      });
    } catch {
      /* 낙관적 갱신 실패는 치명적이지 않음 — 다음 sync/webhook 에서 정정됨 */
    }

    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_leave", target_id: plotId, details: profile.minecraft_username },
    });
    return { success: true, message: `플롯 ${plotId} 에서 나갔습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 소유권 양도 신청(2단계 수락). 실제 변경은 양수인이 인게임 /플롯 수락 또는 웹 대시보드에서 수락할 때 완료된다.
 * 웹측에는 PendingTransfer 로 기록해 UI 상태 표시 + 분쟁 증빙(감사)을 남긴다.
 */
export async function transferPlotOwnerAction(plotId: string, targetName: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = targetName?.trim();
    if (!name) return { success: false, error: "양도 대상 닉네임을 입력해주세요." };
    if (!profile.minecraft_uuid) {
      return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    }

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, plotId) } });
    if (!plot || plot.owner_id !== profile.id) {
      throw new Error("해당 플롯의 소유자가 아니거나 캐시가 오래되었습니다. 먼저 동기화해주세요.");
    }

    // requester_uuid 를 함께 보내 마크 서버가 "현재 소유자 == 신청자" 를 검증한다(탈취 차단)
    const res = await transferPlotOwnership(plotId, name, profile.minecraft_uuid, world);
    if (!res.success) {
      throw new Error(res.message || "Spigot API returned an error.");
    }

    // 동일 플롯(월드)의 기존 pending 신청은 정리 후 새로 기록
    await prisma.$transaction([
      prisma.pendingTransfer.deleteMany({ where: { from_id: profile.id, plot_id: plotId, world, status: "pending" } }),
      prisma.pendingTransfer.create({
        data: { plot_id: plotId, world, from_id: profile.id, target_name: name, status: "pending" },
      }),
      prisma.creatorLog.create({
        data: { creator_name: profile.creator_name, action: "mc_plot_transfer_request", target_id: plotId, details: name },
      }),
    ]);

    return {
      success: true,
      message: "양도 신청이 전송되었습니다. 대상 유저가 /플롯 수락(인게임) 또는 웹 대시보드에서 수락하면 최종 완료됩니다.",
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 빈 플롯 claim(구매) — Dynmap 마켓플레이스의 "구매(claim)" 버튼이 호출.
 * 연동 계정의 uuid 로 마크 서버에 claim 을 요청한다(서버가 미소유·한도·가격을 재검증).
 * 성공 시 새로 소유하게 된 플롯을 내 캐시에 동기화한다.
 */
export async function claimPlotAction(plotId: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const id = plotId?.trim();
    if (!id) return { success: false, error: "플롯 ID가 없습니다." };
    if (!profile.minecraft_uuid) {
      return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    }
    if (!canUseBuildDashboard(profile)) {
      return { success: false, error: "플롯 구매는 디스코드·마인크래프트·웹 회원가입(이메일/비밀번호) 3종 인증을 모두 완료해야 가능합니다." };
    }

    const res = await claimPlot(id, profile.minecraft_uuid, world, profile.plot_slot_bonus);
    if (!res.success) {
      // 마크 서버 상태코드를 사용자 친화 메시지로 변환
      const msg =
        res.status === 403 ? "플롯 구매 권한이 없습니다." :
        res.status === 409 ? "이미 소유된 플롯입니다." :
        res.status === 429 ? "claim 가능한 플롯 수 한도에 도달했습니다." :
        res.status === 402 ? "코인이 부족하거나 결제할 수 없습니다." :
        res.status === 404 ? "플롯을 찾을 수 없습니다." :
        (res.message || "구매에 실패했습니다. (서버 연결을 확인해주세요)");
      return { success: false, error: msg };
    }

    // 새로 소유한 플롯을 캐시에 반영(실패해도 다음 동기화/webhook 에서 정정됨)
    await syncMyPlots();
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_claim", target_id: id, details: profile.minecraft_username || "" },
    });

    return { success: true, message: `플롯 ${id} 을(를) 구매했습니다! 이제 내 영토입니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 본인 소유 플롯 삭제(건축 초기화 + 소유권 해제). 초대된(소유 아님) 플롯은 거부.
 * 캐시에서 본인 소유를 먼저 검증하고, 마크 서버도 소유자 재검증한다(이중 방어).
 */
export async function deletePlotAction(plotId: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const id = plotId?.trim();
    if (!id) return { success: false, error: "플롯 ID가 없습니다." };
    if (!profile.minecraft_uuid) {
      return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    }

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, id) } });
    if (!plot || plot.owner_id !== profile.id) {
      return { success: false, error: "본인 소유 플롯만 삭제할 수 있습니다." };
    }

    const res = await deletePlot(id, profile.minecraft_uuid, world);
    if (!res.success) {
      const msg =
        res.status === 403 ? "본인 소유 플롯만 삭제할 수 있습니다." :
        res.status === 404 ? "플롯을 찾을 수 없습니다." :
        (res.message || "삭제에 실패했습니다. (서버 연결을 확인해주세요)");
      return { success: false, error: msg };
    }

    // 소유권이 사라졌으므로 캐시에서 제거(본인 소유 한정)
    await prisma.minecraftPlot.deleteMany({ where: { id: plotCacheId(world, id), owner_id: profile.id } });
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_delete", target_id: id, details: profile.minecraft_username || "" },
    });

    return { success: true, message: `플롯 ${id} 을(를) 삭제했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 플롯 경매 등록 — 본인 소유 플롯을 매물로(가격). 초대/타인 플롯 불가. 마크 서버도 소유자 재검증.
 */
export async function listAuctionAction(plotId: string, price: number, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const id = plotId?.trim();
    if (!id) return { success: false, error: "플롯 ID가 없습니다." };
    if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    const amount = Math.floor(price);
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "가격은 1 이상이어야 합니다." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, id) } });
    if (!plot || plot.owner_id !== profile.id) {
      return { success: false, error: "본인 소유 플롯만 경매 등록할 수 있습니다." };
    }

    const res = await listAuction(id, profile.minecraft_uuid, amount, world);
    if (!res.success) {
      const msg = res.status === 403 ? "본인 소유 플롯만 경매 등록할 수 있습니다." :
        res.status === 404 ? "플롯을 찾을 수 없습니다." : (res.message || "경매 등록에 실패했습니다.");
      return { success: false, error: msg };
    }
    // 낙관적 캐시 갱신(역방향 webhook 이 곧 확정)
    await prisma.minecraftPlot.update({ where: { id: plotCacheId(world, id) }, data: { auction_price: amount } }).catch(() => {});
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_auction_list", target_id: id, details: String(amount) },
    });
    return { success: true, message: `플롯 ${id} 을(를) ${amount}코인에 경매 등록했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 플롯 경매 취소 — 본인 소유만. */
export async function cancelAuctionAction(plotId: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const id = plotId?.trim();
    if (!id) return { success: false, error: "플롯 ID가 없습니다." };
    if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };

    const plot = await prisma.minecraftPlot.findUnique({ where: { id: plotCacheId(world, id) } });
    if (!plot || plot.owner_id !== profile.id) {
      return { success: false, error: "본인 소유 플롯만 취소할 수 있습니다." };
    }

    const res = await cancelAuction(id, profile.minecraft_uuid, world);
    if (!res.success) {
      const msg = res.status === 403 ? "본인 소유 플롯만 취소할 수 있습니다." :
        res.status === 404 ? "플롯을 찾을 수 없습니다." : (res.message || "경매 취소에 실패했습니다.");
      return { success: false, error: msg };
    }
    await prisma.minecraftPlot.update({ where: { id: plotCacheId(world, id) }, data: { auction_price: null } }).catch(() => {});
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_auction_cancel", target_id: id, details: "" },
    });
    return { success: true, message: `플롯 ${id} 경매를 취소했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 경매 플롯 구매(낙찰) — Dynmap 주황 마커 우클릭. 코인 이체(구매자→판매자) + 소유권 이전. */
export async function buyAuctionAction(plotId: string, world: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const id = plotId?.trim();
    if (!id) return { success: false, error: "플롯 ID가 없습니다." };
    if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };

    const res = await buyAuction(id, profile.minecraft_uuid, world, profile.plot_slot_bonus);
    if (!res.success) {
      const msg =
        res.status === 403 ? "플롯 구매 권한이 없습니다." :
        res.status === 402 ? "코인이 부족하거나 결제할 수 없습니다." :
        res.status === 409 ? "이미 판매되었거나 종료된 경매입니다." :
        res.status === 429 ? "claim 가능한 플롯 수 한도에 도달했습니다." :
        res.status === 400 ? "본인이 등록한 매물은 구매할 수 없습니다." :
        res.status === 404 ? "플롯을 찾을 수 없습니다." :
        (res.message || "구매에 실패했습니다.");
      return { success: false, error: msg };
    }
    await syncMyPlots(); // 새로 소유한 플롯 캐시 반영
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_plot_auction_buy", target_id: id, details: profile.minecraft_username || "" },
    });
    return { success: true, message: `경매 플롯 ${id} 을(를) 구매했습니다!` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 내 코인(CMI) 잔액 조회 — 헤더 🪙 실값 표시용. balance=null 이면 경제 미연동(웹은 "—" 표시).
 */
export async function getMyBalance(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    if (!profile.minecraft_uuid) return { success: false, balance: null };
    const res = await getEconomyBalance(profile.minecraft_uuid);
    return { success: res.success, balance: res.balance };
  } catch {
    return { success: false, balance: null };
  }
}

/**
 * 코인(CMI) 유저 간 송금 — 받는 사람 닉네임 + 금액. 양쪽 모두 마크 연동 필수.
 * 서버에서 원자적으로 출금→입금(잔액 부족 시 402). 성공 시 보낸 후 내 잔액을 함께 반환.
 */
export async function transferCoinsAction(targetName: string, amount: number) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) {
      return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    }
    const name = (targetName || "").trim();
    if (!name) return { success: false, error: "받는 사람 닉네임을 입력해주세요." };

    // 정수 코인만 허용(소수/음수/0 거부).
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      return { success: false, error: "보낼 코인은 1 이상의 정수여야 합니다." };
    }

    const targetUuid = await resolveMinecraftUuid(name);
    if (!targetUuid) {
      return { success: false, error: "받는 사람을 찾을 수 없습니다. (마인크래프트 연동된 유저여야 합니다)" };
    }
    if (targetUuid === profile.minecraft_uuid) {
      return { success: false, error: "자기 자신에게는 보낼 수 없습니다." };
    }

    const res = await transferCoins(profile.minecraft_uuid, targetUuid, amt);
    if (!res.success) {
      const msg =
        res.status === 402 ? "코인이 부족합니다." :
        res.status === 503 ? "경제 시스템이 비활성 상태입니다. (관리자 문의)" :
        res.status === 409 ? "받는 사람에게 지급하지 못했습니다. (송금 취소됨)" :
        res.status === 400 ? "잘못된 송금 요청입니다." :
        "송금에 실패했습니다.";
      return { success: false, error: msg };
    }

    await prisma.creatorLog.create({
      data: {
        creator_name: profile.creator_name,
        action: "mc_coin_transfer",
        target_id: targetUuid,
        details: `${name} ← ${amt}코인`,
      },
    });
    // 경제 원장 — 웹발 유저 간 이체(순통화량 불변). 인게임 /돈 보내기는 플러그인이 별도 보고.
    await logCoinSpend({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: amt, source: "coin_transfer", reason: `→ ${name}`, transfer: true });
    return {
      success: true,
      message: `${name} 님에게 ${amt}코인을 보냈습니다.`,
      balance: res.fromBalance ?? null,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 내 구매 가능 횟수(역할별 한도 − 현재 보유 플롯 수) 조회 — 마켓 헤더 "구매 가능 N회" 표시용.
 * remaining: -1 = 무제한.
 */
export async function getMyClaimInfo(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    if (!profile.minecraft_uuid) return { success: false };
    const info = await getPlotClaimInfo(profile.minecraft_uuid, profile.plot_slot_bonus);
    if (!info.success) return { success: false };
    return { success: true, limit: info.limit, owned: info.owned, remaining: info.remaining };
  } catch {
    return { success: false };
  }
}

/**
 * 내가 신청한 양도 대기 목록(UI 표시용).
 */
export async function getMyPendingTransfers(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    const transfers = await prisma.pendingTransfer.findMany({
      where: { from_id: profile.id, status: "pending" },
      orderBy: { created_at: "desc" },
    });
    return { success: true, transfers };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), transfers: [] };
  }
}

/**
 * 나에게 들어온(내가 양수인) 소유권 양도 대기 목록 — 웹에서 직접 수락/거절할 수 있도록 표시.
 * target_name 은 신청자가 입력한 닉네임이므로 내 minecraft_username 과 대소문자 무시로 비교한다.
 */
export async function getIncomingTransfers(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    if (!profile.minecraft_username) return { success: true, transfers: [] };
    const uname = profile.minecraft_username.toLowerCase();

    const pendings = await prisma.pendingTransfer.findMany({
      where: { status: "pending" },
      include: { from: { select: { creator_name: true, minecraft_username: true } } },
      orderBy: { created_at: "desc" },
    });
    const mine = pendings
      .filter((t) => t.target_name.toLowerCase() === uname)
      .map((t) => ({
        id: t.id,
        plot_id: t.plot_id,
        from_name: t.from?.minecraft_username || t.from?.creator_name || "?",
      }));
    return { success: true, transfers: mine };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), transfers: [] };
  }
}

/** transferId 가 현재 로그인 양수인 본인 대상의 pending 인지 검증 후 그 레코드를 돌려준다. */
async function loadOwnIncomingTransfer(transferId: string) {
  const profile = await getAuthenticatedProfile();
  if (!profile.minecraft_uuid || !profile.minecraft_username) {
    return { error: "먼저 마인크래프트 계정을 연동해주세요." as const };
  }
  const transfer = await prisma.pendingTransfer.findUnique({ where: { id: transferId } });
  if (!transfer || transfer.status !== "pending") {
    return { error: "이미 처리되었거나 존재하지 않는 양도 요청입니다." as const };
  }
  // 양수인 본인 확인 — 양도 대상 닉네임이 내 연동 닉네임과 일치해야 한다(마크 서버가 UUID 로 한 번 더 검증).
  if (transfer.target_name.toLowerCase() !== profile.minecraft_username.toLowerCase()) {
    return { error: "이 양도 요청의 대상이 아닙니다." as const };
  }
  return { profile, transfer };
}

/**
 * 양수인이 웹에서 소유권 양도를 수락 — 마크 서버가 UUID(accepter) ↔ 양도 대기 target 일치를 권위 검증한 뒤 setOwner.
 * 성공 시 PendingTransfer 를 accepted 로 갱신(역방향 webhook 도 동일 처리)하고 내 플롯 캐시를 동기화한다.
 */
export async function acceptIncomingTransferAction(transferId: string) {
  try {
    const loaded = await loadOwnIncomingTransfer(transferId);
    if ("error" in loaded) return { success: false, error: loaded.error };
    const { profile, transfer } = loaded;

    const res = await acceptPlotTransfer(transfer.plot_id, profile.minecraft_uuid!, transfer.world);
    if (!res.success) {
      // 409(소유자 변경)·410(만료)만 터미널 상태로 정리한다.
      // ⚠️ 404 는 파괴적 정리 금지 — 마크 서버가 일시적으로 못 찾거나(미배포/재시작/엔드포인트 부재) 네트워크 문제일 수 있는데,
      //    pending 을 rejected 로 날리면 양수인이 영영 수락 못 하게 된다. pending 유지 → 재시도 가능하게.
      if (res.status === 410 || res.status === 409) {
        await prisma.pendingTransfer.updateMany({
          where: { id: transferId, status: "pending" },
          data: { status: res.status === 410 ? "expired" : "rejected" },
        });
      }
      const msg =
        res.status === 404 ? "마크 서버에서 이 양도를 처리하지 못했습니다(엔드포인트/연결 확인). 인게임 /플롯 수락 으로 받거나 잠시 후 다시 시도해주세요." :
        res.status === 409 ? "플롯 소유자가 변경되어 양도가 취소되었습니다." :
        res.status === 410 ? "양도 요청이 만료되었습니다. 양도자에게 다시 신청을 요청하세요." :
        (res.message || "양도 수락에 실패했습니다. (서버 연결을 확인해주세요)");
      return { success: false, error: msg };
    }

    // 성공: UI 즉시성을 위해 웹 상태를 직접 갱신(webhook 도 동일 처리하지만 비동기) + 내 플롯 캐시 동기화.
    await prisma.$transaction([
      prisma.pendingTransfer.updateMany({
        where: { id: transferId, status: "pending" },
        data: { status: "accepted" },
      }),
      prisma.creatorLog.create({
        data: { creator_name: profile.creator_name, action: "mc_plot_transfer_accept", target_id: transfer.plot_id, details: profile.minecraft_username },
      }),
    ]);
    await syncMyPlots();

    return { success: true, message: `플롯 ${transfer.plot_id} 의 소유권을 넘겨받았습니다!` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 양수인이 웹에서 소유권 양도를 거절 — 마크 서버에서 양도 대기를 제거하고 웹 기록을 rejected 로 갱신한다.
 */
export async function rejectIncomingTransferAction(transferId: string) {
  try {
    const loaded = await loadOwnIncomingTransfer(transferId);
    if ("error" in loaded) return { success: false, error: loaded.error };
    const { profile, transfer } = loaded;

    const res = await rejectPlotTransfer(transfer.plot_id, profile.minecraft_uuid!, transfer.world);
    // 404(플러그인에 이미 없음)도 거절로 간주해 웹 기록을 정리한다. 그 외 실패는 전송하지 않은 것으로 취급.
    if (!res.success && res.status !== 404) {
      return { success: false, error: res.message || "양도 거절에 실패했습니다. (서버 연결을 확인해주세요)" };
    }

    await prisma.$transaction([
      prisma.pendingTransfer.updateMany({
        where: { id: transferId, status: "pending" },
        data: { status: "rejected" },
      }),
      prisma.creatorLog.create({
        data: { creator_name: profile.creator_name, action: "mc_plot_transfer_reject", target_id: transfer.plot_id, details: profile.minecraft_username },
      }),
    ]);

    return { success: true, message: "양도 요청을 거절했습니다." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

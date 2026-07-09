"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaff, requireSuperAdmin, assertCanActOn } from "@/lib/admin-auth";
import { computePunishment, fmtUntil, type Severity, type CustomPunishment } from "@/lib/moderation";
import {
  muteMinecraftPlayer,
  unmuteMinecraftPlayer,
  banMinecraftPlayer,
  unbanMinecraftPlayer,
} from "@/lib/minecraft";

// 어드민/스태프 처벌 액션. 웹 DB(Profile 상태 + ModerationAction 이력)가 원장이며,
// 마크 전파는 best-effort(실패해도 웹 처벌은 유효). 모든 액션은 AuditLog + 대상자 Notification 을 남긴다.

async function audit(adminName: string, action: string, targetId: string, details: string) {
  await prisma.auditLog
    .create({ data: { admin_name: adminName, action, target_id: targetId, details } })
    .catch(() => {});
}

async function notifyUser(
  recipientId: string,
  senderName: string,
  category: string,
  title: string,
  body: string,
) {
  await prisma.notification
    .create({ data: { recipient_id: recipientId, sender_name: senderName, category, title, body } })
    .catch(() => {});
}

function warn(label: string) {
  return (e: unknown) => console.warn(`${label} 전파 실패:`, e instanceof Error ? e.message : String(e));
}

/**
 * 처벌 적용 — 프리셋(low/medium/high) 또는 custom.
 *  - 뮤트/정지 만료 시각 환산 → Profile 비정규화 갱신 + ModerationAction 이력 + 대상자 알림 + MC 전파.
 *  - 무기한 이용정지(high/permanent)는 status='suspended', suspended_until=null. (영구차단 banned 와는 다름)
 */
export async function applyPunishmentAction(
  targetId: string,
  severity: Severity,
  custom?: CustomPunishment,
  reason?: string,
) {
  try {
    const admin = await requireStaff();
    const target = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { id: true, creator_name: true, minecraft_uuid: true, status: true, role: true },
    });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };
    await assertCanActOn(target);
    if ((target.status || "").toLowerCase() === "banned") {
      return { error: "이미 영구 차단된 회원입니다. 차단 해제(unban) 후 다시 처벌하세요." };
    }

    const comp = computePunishment(severity, custom);
    if (!comp.muteUntil && !comp.suspend) {
      return { error: "적용할 제재 내용이 없습니다(뮤트/정지 기간을 확인하세요)." };
    }

    const data: { moderation_reason: string | null; muted_until?: Date; status?: string; suspended_until?: Date | null; token_version?: { increment: number } } = {
      moderation_reason: reason || null,
    };
    if (comp.muteUntil) data.muted_until = comp.muteUntil;
    if (comp.suspend) {
      data.status = "suspended";
      data.suspended_until = comp.suspendUntil; // null = 무기한
      // 정지 시 token_version 증가 → 이미 로그인된 세션을 즉시 무효화(로그인 시점에만 검사하던 제재 우회 차단).
      data.token_version = { increment: 1 };
    }
    await prisma.profile.update({ where: { id: targetId }, data });

    await prisma.moderationAction.create({
      data: {
        target_id: targetId,
        moderator_name: admin,
        type: comp.suspend ? "suspend" : "mute",
        severity,
        reason: reason || null,
        mute_until: comp.muteUntil,
        suspend_until: comp.suspendUntil,
        permanent: false,
      },
    });

    // 대상자 알림
    const lines: string[] = [];
    if (comp.muteUntil) lines.push(`• 채팅/작성 제한(뮤트): ${fmtUntil(comp.muteUntil)} 까지`);
    if (comp.suspend) lines.push(`• 이용정지: ${comp.suspendUntil ? `${fmtUntil(comp.suspendUntil)} 까지` : "무기한"}`);
    await notifyUser(
      targetId,
      admin,
      "moderation",
      "계정 제재 안내",
      `회원님 계정에 다음 제재가 적용되었습니다.\n${lines.join("\n")}\n사유: ${reason || "—"}\n\n이의가 있으시면 관리자에게 문의(항소)해 주세요.`,
    );

    // MC 전파 (best-effort)
    if (target.minecraft_uuid) {
      if (comp.muteUntil) muteMinecraftPlayer(target.minecraft_uuid, comp.muteUntil, reason).catch(warn("mute"));
      if (comp.suspend) banMinecraftPlayer(target.minecraft_uuid, comp.suspendUntil, reason).catch(warn("ban"));
    }

    await audit(admin, "PUNISH", targetId, `${target.creator_name}: ${severity}${comp.suspend ? " (정지)" : " (뮤트)"} · ${reason || "사유없음"}`);
    revalidatePath("/adminpage");
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 뮤트 해제. */
export async function liftMuteAction(targetId: string) {
  try {
    const admin = await requireStaff();
    const target = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { creator_name: true, minecraft_uuid: true, role: true },
    });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };
    await assertCanActOn(target);

    await prisma.profile.update({ where: { id: targetId }, data: { muted_until: null } });
    await prisma.moderationAction.create({
      data: { target_id: targetId, moderator_name: admin, type: "lift_mute" },
    });
    await notifyUser(targetId, admin, "moderation", "뮤트 해제 안내", "회원님의 채팅/작성 제한(뮤트)이 해제되었습니다.");
    if (target.minecraft_uuid) unmuteMinecraftPlayer(target.minecraft_uuid).catch(warn("unmute"));

    await audit(admin, "LIFT_MUTE", targetId, `${target.creator_name} 뮤트 해제`);
    revalidatePath("/adminpage");
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 이용정지 해제(active 로 복귀). 영구차단(banned)은 unbanAction 으로만 해제. */
export async function liftSuspensionAction(targetId: string) {
  try {
    const admin = await requireStaff();
    const target = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { creator_name: true, minecraft_uuid: true, status: true, role: true },
    });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };
    await assertCanActOn(target);
    if ((target.status || "").toLowerCase() === "banned") {
      return { error: "영구 차단(banned) 상태는 차단 해제(unban)로만 풀 수 있습니다." };
    }

    await prisma.profile.update({
      where: { id: targetId },
      data: { status: "active", suspended_until: null },
    });
    await prisma.moderationAction.create({
      data: { target_id: targetId, moderator_name: admin, type: "lift_suspend" },
    });
    await notifyUser(targetId, admin, "moderation", "이용정지 해제 안내", "회원님의 이용정지가 해제되어 정상 이용이 가능합니다.");
    if (target.minecraft_uuid) unbanMinecraftPlayer(target.minecraft_uuid).catch(warn("unban"));

    await audit(admin, "LIFT_SUSPEND", targetId, `${target.creator_name} 이용정지 해제`);
    revalidatePath("/adminpage");
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 영구 차단(banned) 승격 — 항소 종료 후 최종관리자만. 이후 회원 영구삭제(deleteUserAction)가 가능해진다. */
export async function escalateToBanAction(targetId: string, reason?: string) {
  try {
    const admin = await requireSuperAdmin();
    const target = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { creator_name: true, minecraft_uuid: true, role: true },
    });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };
    if (target.creator_name === "admin") return { error: "슈퍼 관리자 계정은 차단할 수 없습니다." };

    await prisma.profile.update({
      where: { id: targetId },
      // token_version 증가 → 영구차단 즉시 기존 세션 무효화.
      data: { status: "banned", suspended_until: null, moderation_reason: reason || null, token_version: { increment: 1 } },
    });
    await prisma.moderationAction.create({
      data: { target_id: targetId, moderator_name: admin, type: "ban", severity: "high", reason: reason || null, permanent: true },
    });
    await notifyUser(
      targetId,
      admin,
      "moderation",
      "계정 영구 차단 안내",
      `회원님 계정이 영구 차단되었습니다.\n사유: ${reason || "—"}`,
    );
    if (target.minecraft_uuid) banMinecraftPlayer(target.minecraft_uuid, null, reason).catch(warn("ban"));

    await audit(admin, "BAN_USER", targetId, `${target.creator_name} 영구차단 · ${reason || "사유없음"}`);
    revalidatePath("/adminpage");
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 영구 차단 해제(active 복귀) — 최종관리자만. */
export async function unbanAction(targetId: string) {
  try {
    const admin = await requireSuperAdmin();
    const target = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { creator_name: true, minecraft_uuid: true },
    });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };

    await prisma.profile.update({
      where: { id: targetId },
      data: { status: "active", suspended_until: null, muted_until: null },
    });
    await prisma.moderationAction.create({
      data: { target_id: targetId, moderator_name: admin, type: "unban" },
    });
    await notifyUser(targetId, admin, "moderation", "차단 해제 안내", "회원님의 계정 차단이 해제되었습니다.");
    if (target.minecraft_uuid) unbanMinecraftPlayer(target.minecraft_uuid).catch(warn("unban"));

    await audit(admin, "UNBAN_USER", targetId, `${target.creator_name} 차단 해제`);
    revalidatePath("/adminpage");
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

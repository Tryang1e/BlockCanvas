"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { requireStaff, requireSuperAdmin } from "@/lib/admin-auth";
import { awardCoins } from "@/lib/minecraft";
import { logCoinAward } from "@/lib/economyConfig";

// 알림/공지 + 코인 지급. 발송계열은 requireStaff(admin|manager), 읽음처리는 수신자 본인.
// 전체공지는 대상 유저별 1행으로 fan-out 해 통합 인박스/읽음추적을 단순화한다(단일 인스턴스·소규모 가정).

async function audit(adminName: string, action: string, targetId: string | null, details: string) {
  await prisma.auditLog
    .create({ data: { admin_name: adminName, action, target_id: targetId, details } })
    .catch(() => {});
}

/** 개인 메시지(DM) 발송 — 특정 유저의 알림함에 1건. */
export async function sendDirectMessageAction(targetId: string, title: string, body: string) {
  try {
    const admin = await requireStaff();
    const t = (title || "").trim();
    const b = (body || "").trim();
    if (!t || !b) return { error: "제목과 내용을 입력해 주세요." };
    if (t.length > 200) return { error: "제목은 200자 이하로 입력해 주세요." };
    if (b.length > 5000) return { error: "내용은 5000자 이하로 입력해 주세요." };

    const target = await prisma.profile.findUnique({ where: { id: targetId }, select: { creator_name: true } });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };

    await prisma.notification.create({
      data: { recipient_id: targetId, sender_name: admin, category: "dm", title: t, body: b },
    });
    await audit(admin, "SEND_DM", targetId, `${target.creator_name} 에게 DM: ${t}`);
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/**
 * 전체 공지 발송 — audience('all' | 역할명) 대상 모든 유저의 알림함에 fan-out.
 * 차단(banned) 유저는 제외.
 */
export async function sendBroadcastAction(title: string, body: string, audience: string = "all") {
  try {
    const admin = await requireStaff();
    const t = (title || "").trim();
    const b = (body || "").trim();
    if (!t || !b) return { error: "제목과 내용을 입력해 주세요." };
    if (t.length > 200) return { error: "제목은 200자 이하로 입력해 주세요." };
    if (b.length > 5000) return { error: "내용은 5000자 이하로 입력해 주세요." };

    const roleFilter =
      audience && audience !== "all" ? { role: audience } : {};
    const recipients = await prisma.profile.findMany({
      where: { ...roleFilter, status: { not: "banned" } },
      select: { id: true },
    });
    if (recipients.length === 0) return { error: "발송 대상이 없습니다." };

    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        recipient_id: r.id,
        sender_name: admin,
        category: "notice",
        title: t,
        body: b,
      })),
    });
    await audit(admin, "BROADCAST", null, `공지 발송(${audience}, ${recipients.length}명): ${t}`);
    return { success: true, count: recipients.length };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 코인 지급 — CMI 경제(awardCoins)로 직접 입금 + 알림 + 감사로그. 마크 미연동/오프라인 시 실패. */
export async function grantCoinsAction(targetId: string, amount: number, reason?: string) {
  try {
    // 🔒 C-2: 코인(진짜 돈) 발행은 최종 관리자 전용 — 매니저의 무제한 자가발행 차단.
    const admin = await requireSuperAdmin();
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return { error: "지급할 코인 수량이 올바르지 않습니다." };
    if (amt > 1_000_000) return { error: "1회 지급 한도(1,000,000)를 초과했습니다." };

    const target = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { creator_name: true, minecraft_uuid: true },
    });
    if (!target) return { error: "대상 회원을 찾을 수 없습니다." };
    if (!target.minecraft_uuid) return { error: "마인크래프트 미연동 회원입니다. 코인(CMI)은 연동된 계정에만 지급할 수 있습니다." };

    const res = await awardCoins(target.minecraft_uuid, amt, reason || "관리자 지급");
    if (!res.success) return { error: "코인 지급에 실패했습니다(서버 오프라인 또는 경제 미연동)." };
    await logCoinAward({ profileId: targetId, minecraftUuid: target.minecraft_uuid, amount: amt, source: "admin_grant", reason: reason || "관리자 지급" });

    await prisma.notification.create({
      data: {
        recipient_id: targetId,
        sender_name: admin,
        category: "coin",
        title: "코인이 지급되었습니다",
        body: `${amt.toLocaleString()} 코인이 지급되었습니다.${reason ? `\n사유: ${reason}` : ""}`,
        meta: JSON.stringify({ coin: amt }),
      },
    });
    await audit(admin, "GRANT_COINS", targetId, `${target.creator_name} +${amt}코인 · ${reason || "사유없음"}`);
    revalidatePath(`/adminpage/users/${targetId}`);
    return { success: true, balance: res.balance };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 수신자 본인이 알림 1건 읽음 처리. */
export async function markNotificationReadAction(id: string) {
  try {
    const session = verifySession((await cookies()).get("session")?.value);
    if (!session || session === "admin") return { error: "로그인이 필요합니다." };
    const me = await prisma.profile.findUnique({ where: { creator_name: session }, select: { id: true } });
    if (!me) return { error: "계정을 찾을 수 없습니다." };

    const notif = await prisma.notification.findUnique({ where: { id }, select: { recipient_id: true } });
    if (!notif || notif.recipient_id !== me.id) return { error: "권한이 없습니다." };

    await prisma.notification.update({ where: { id }, data: { is_read: true } });
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/** 수신자 본인의 모든 알림 읽음 처리. */
export async function markAllNotificationsReadAction() {
  try {
    const session = verifySession((await cookies()).get("session")?.value);
    if (!session || session === "admin") return { error: "로그인이 필요합니다." };
    const me = await prisma.profile.findUnique({ where: { creator_name: session }, select: { id: true } });
    if (!me) return { error: "계정을 찾을 수 없습니다." };

    await prisma.notification.updateMany({ where: { recipient_id: me.id, is_read: false }, data: { is_read: true } });
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-auth";
import { banMinecraftPlayer } from "@/lib/minecraft";
import {
  type BlockType,
  normalizeIdentity,
  isValidIdentity,
  hashIdentity,
  identityHint,
  uuidLookupVariants,
} from "@/lib/blocklist";

// 접근 차단 목록(blocklist) 관리 액션 — 어드민/스태프. 인증 게이트(마크/Discord/이메일)가 이 목록과 대조한다.
//  - 자의적 차단 방지: reason 필수. 비례성: expiresDays 로 유기 차단 지원.
//  - 차단 등록 시 이미 연동된 '살아있는 계정'이 있으면 무기한 이용정지(suspended)로 접근을 막는다.
//    ※ 영구차단(banned=삭제 대상, 최종관리자 전용)이 아니라 '무기한 이용정지'를 쓴다: 되돌릴 수 있고(오탐 구제),
//      이의제기 창구가 유지되며(비례성·적법절차), 스태프 권한 범위에 부합한다. 최종 banned 는 기존 유저 상세에서 별도 승격.
//  - 유료가치 정산은 차단과 분리(settlementNote) — 전액 무보상 몰수 금지, 실손해 상계 후 환급 원칙.

const DAY_MS = 24 * 60 * 60 * 1000;

async function audit(adminName: string, action: string, targetId: string, details: string) {
  await prisma.auditLog
    .create({ data: { admin_name: adminName, action, target_id: targetId, details } })
    .catch(() => {});
}

async function notifyUser(recipientId: string, senderName: string, title: string, body: string) {
  await prisma.notification
    .create({ data: { recipient_id: recipientId, sender_name: senderName, category: "moderation", title, body } })
    .catch(() => {});
}

const VALID_TYPES: BlockType[] = ["minecraft_uuid", "discord_id", "email"];
const VALID_CATEGORIES = ["abuse", "exploit", "griefing", "cheat", "payment_fraud", "evasion", "other"];

interface LinkedProfile {
  id: string;
  creator_name: string;
  display_name: string | null;
  status: string;
  minecraft_uuid: string | null;
  subscription_until: Date | null;
}

/** 이 식별자에 현재 연동된 살아있는 회원을 찾는다(대시 유무/이메일 대소문자 흡수). */
async function findLinkedProfile(type: BlockType, raw: string): Promise<LinkedProfile | null> {
  const select = {
    id: true,
    creator_name: true,
    display_name: true,
    status: true,
    minecraft_uuid: true,
    subscription_until: true,
  } as const;
  if (type === "minecraft_uuid") {
    return prisma.profile.findFirst({ where: { minecraft_uuid: { in: uuidLookupVariants(raw) } }, select });
  }
  if (type === "discord_id") {
    return prisma.profile.findFirst({ where: { discord_id: normalizeIdentity("discord_id", raw) }, select });
  }
  const email = normalizeIdentity("email", raw);
  return prisma.profile.findFirst({ where: { email: { in: [email, (raw || "").trim()] } }, select });
}

/** 유료가치 스냅샷 — 정산(환급/상계) 판단 근거. 구독 잔여만 산출(코인은 외부 CMI·비현금 포인트라 별도). */
function paidSnapshot(p: LinkedProfile) {
  const until = p.subscription_until;
  const daysLeft = until && until.getTime() > Date.now() ? Math.ceil((until.getTime() - Date.now()) / DAY_MS) : 0;
  return { subscriptionUntil: until ? until.toISOString() : null, subscriptionDaysLeft: daysLeft };
}

/**
 * 차단 등록 전 조회 — 형식 검증 + 연동된 살아있는 계정/유료가치 스냅샷을 반환한다.
 * 관리자가 '누구를·무엇을' 차단하는지, 정산할 유료가치가 있는지 확인한 뒤 결정하도록(정산 분리) 돕는다.
 */
export async function lookupIdentityAction(type: BlockType, value: string) {
  try {
    await requireStaff();
    if (!VALID_TYPES.includes(type)) return { error: "식별자 유형이 올바르지 않습니다." };
    const normalized = normalizeIdentity(type, value);
    if (!isValidIdentity(type, normalized)) {
      return { success: true as const, valid: false as const, hint: "", alreadyBlocked: false, matched: null };
    }
    const value_hash = hashIdentity(type, value);
    const existing = await prisma.blockedIdentity.findUnique({ where: { type_value_hash: { type, value_hash } } });
    const linked = await findLinkedProfile(type, value);
    return {
      success: true as const,
      valid: true as const,
      hint: identityHint(type, value),
      alreadyBlocked: !!existing,
      matched: linked
        ? {
            id: linked.id,
            creatorName: linked.creator_name,
            displayName: linked.display_name,
            status: linked.status,
            paid: paidSnapshot(linked),
          }
        : null,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "조회 중 문제가 발생했습니다." };
  }
}

export interface AddBlockInput {
  type: BlockType;
  value: string;
  reason: string;
  category?: string;
  expiresDays?: number | null; // null/0 = 영구
  settlementNote?: string;
}

/** 차단 등록 + (연동 계정 존재 시) 무기한 이용정지 + 알림 + MC 접속차단 전파(best-effort). */
export async function addBlockAction(input: AddBlockInput) {
  try {
    const admin = await requireStaff();
    const type = input.type;
    if (!VALID_TYPES.includes(type)) return { error: "식별자 유형이 올바르지 않습니다." };

    const normalized = normalizeIdentity(type, input.value);
    if (!isValidIdentity(type, normalized)) return { error: "식별자 형식이 올바르지 않습니다." };

    const reason = (input.reason || "").trim();
    if (!reason) return { error: "차단 사유는 필수입니다(자의적 차단 방지)." };

    const category = VALID_CATEGORIES.includes(input.category || "") ? input.category! : "other";
    const expires_at =
      input.expiresDays && input.expiresDays > 0 ? new Date(Date.now() + input.expiresDays * DAY_MS) : null;

    const value_hash = hashIdentity(type, input.value);
    const dup = await prisma.blockedIdentity.findUnique({ where: { type_value_hash: { type, value_hash } } });
    if (dup) {
      const expired = !!dup.expires_at && dup.expires_at.getTime() <= Date.now();
      if (!expired) return { error: "이미 차단 목록에 등록된 식별자입니다." };
      // 만료된 유기(기간제) 차단은 아래 upsert 로 재활성한다(delete 하지 않아 최초 created_at·이력 보존).
    }

    // 연동된 살아있는 계정 판정(무기한 이용정지 대상). 최종 banned/슈퍼계정은 건드리지 않는다.
    const linked = await findLinkedProfile(type, input.value);
    const willSuspend =
      !!linked && linked.creator_name !== "admin" && (linked.status || "").toLowerCase() !== "banned";
    const hint = identityHint(type, input.value);
    const settlement = (input.settlementNote || "").trim() || null;

    // 원자성(#2): 이용정지(+이력)와 차단 등록을 한 트랜잭션(batch)으로 묶어 부분 실패를 막는다.
    //   - upsert 로 재등록 시 created_at 미갱신(#3 최초 시점 보존) + linked_profile_id 는 현재 연동 계정이 있을 때만 갱신(이전 연결 승계).
    await prisma.$transaction([
      ...(willSuspend
        ? [
            prisma.profile.update({
              where: { id: linked!.id },
              data: { status: "suspended", suspended_until: null, moderation_reason: reason },
            }),
            prisma.moderationAction.create({
              data: {
                target_id: linked!.id,
                moderator_name: admin,
                type: "suspend",
                severity: "high",
                reason: `[접근차단 목록] ${reason}`,
                suspend_until: null,
                permanent: false,
              },
            }),
          ]
        : []),
      prisma.blockedIdentity.upsert({
        where: { type_value_hash: { type, value_hash } },
        create: {
          type,
          value_hash,
          value_hint: hint,
          reason,
          category,
          blocked_by: admin,
          linked_profile_id: linked?.id ?? null,
          settlement_note: settlement,
          expires_at,
        },
        update: {
          value_hint: hint,
          reason,
          category,
          blocked_by: admin,
          settlement_note: settlement,
          expires_at,
          ...(linked ? { linked_profile_id: linked.id } : {}), // 현재 연동 계정이 있을 때만 갱신(이전 연결 보존)
        },
      }),
    ]);

    // best-effort 후처리(트랜잭션 밖) — 알림·MC 전파는 실패해도 차단은 유효.
    if (willSuspend) {
      await notifyUser(
        linked!.id,
        admin,
        "계정 이용정지 안내",
        `회원님 계정이 무기한 이용정지되었습니다.\n사유: ${reason}\n\n이의가 있으시면 운영진에게 문의(항소)해 주세요.`
      );
      if (linked!.minecraft_uuid) {
        banMinecraftPlayer(linked!.minecraft_uuid, null, reason).catch((e) =>
          console.warn("[blocklist] MC ban 전파 실패:", e instanceof Error ? e.message : String(e))
        );
      }
    }

    await audit(
      admin,
      "BLOCKLIST_ADD",
      linked?.id ?? "",
      `${type}:${hint} · ${category} · ${reason}${expires_at ? ` · ~${expires_at.toLocaleDateString("ko-KR")}` : " · 영구"}${willSuspend ? ` · 연동계정(${linked!.creator_name}) 이용정지` : ""}`
    );
    revalidatePath("/adminpage/blocklist");
    revalidatePath("/adminpage");
    return { success: true as const, suspendedLinked: willSuspend };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "차단 등록 중 문제가 발생했습니다." };
  }
}

/** 차단 해제(목록에서 제거). 연동 계정의 이용정지는 자동 해제하지 않는다(별도 판단·해제). */
export async function removeBlockAction(id: string) {
  try {
    const admin = await requireStaff();
    const row = await prisma.blockedIdentity.findUnique({ where: { id } });
    if (!row) return { error: "차단 항목을 찾을 수 없습니다." };
    await prisma.blockedIdentity.delete({ where: { id } });
    await audit(admin, "BLOCKLIST_REMOVE", row.linked_profile_id ?? "", `${row.type}:${row.value_hint ?? "?"} 차단 해제`);
    revalidatePath("/adminpage/blocklist");
    revalidatePath("/adminpage");
    return { success: true as const };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "차단 해제 중 문제가 발생했습니다." };
  }
}

/** 차단 목록 조회(관리 화면). 각 항목의 연동 계정 현재 상태를 함께 반환한다. */
export async function listBlocksAction() {
  try {
    await requireStaff();
    const rows = await prisma.blockedIdentity.findMany({ orderBy: { created_at: "desc" }, take: 500 });
    const linkedIds = Array.from(new Set(rows.map((r) => r.linked_profile_id).filter((v): v is string => !!v)));
    const linked = linkedIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: linkedIds } },
          select: { id: true, creator_name: true, status: true },
        })
      : [];
    const byId = new Map(linked.map((p) => [p.id, p]));
    const now = Date.now();
    const THREE_YEARS_MS = 3 * 365 * DAY_MS; // 방침상 보관 상한(정기 재검토·파기 기준)
    return {
      success: true as const,
      blocks: rows.map((r) => {
        const lp = r.linked_profile_id ? byId.get(r.linked_profile_id) : null;
        return {
          id: r.id,
          type: r.type,
          category: r.category,
          hint: r.value_hint,
          reason: r.reason,
          blockedBy: r.blocked_by,
          settlementNote: r.settlement_note,
          createdAt: r.created_at.getTime(),
          expiresAt: r.expires_at ? r.expires_at.getTime() : null,
          expired: !!r.expires_at && r.expires_at.getTime() <= now,
          needsReview: now - r.created_at.getTime() > THREE_YEARS_MS, // 등록 3년 초과 = 방침상 재검토 대상
          linked: lp ? { creatorName: lp.creator_name, status: lp.status } : null,
        };
      }),
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "목록을 불러오지 못했습니다." };
  }
}

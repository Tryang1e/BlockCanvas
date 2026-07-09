import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionFull } from "@/lib/session";
import { isAdminPanelAccess, isSuperAdmin } from "@/lib/roles";

// 어드민 영역 권한 게이트의 단일 출처(서버 액션 공용).
//   - requireStaff()      = admin | manager (조정성 액션: 처벌·메시지/공지·코인·유저정보 열람)
//   - requireSuperAdmin() = admin 전용 (회원 삭제·역할변경·사이트설정·관리자 임명)
// creator_name='admin' 슈퍼계정은 role 과 무관하게 최종관리자로 취급(server-auth 와 동일 바이패스).

export interface AdminIdentity {
  name: string; // 관리 식별자(creator_name 또는 'admin')
  role: string; // 웹 role
}

/** 현재 세션의 관리 신원 + role. 비로그인/미존재 시 null. */
export async function currentAdminIdentity(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get("session")?.value;
  const full = verifySessionFull(token);
  if (!full) return null;
  // 서명·만료뿐 아니라 DB token_version 까지 대조 → 비밀번호 변경/재설정·제재로 무효화된 세션은 거부한다
  // (server-auth 의 sessionProfile/requireAuth 와 동일 기준). 예전엔 verifySession 만 써 무효화 세션이 스태프로 남았음.
  const profile = await prisma.profile.findUnique({
    where: { creator_name: full.name },
    select: { creator_name: true, role: true, token_version: true },
  });
  if (!profile || profile.token_version !== full.version) return null;
  if (profile.creator_name === "admin") return { name: "admin", role: "admin" }; // 슈퍼계정 바이패스
  return { name: profile.creator_name, role: profile.role || "user" };
}

/** 조정 권한(admin|manager) 요구. 통과 시 관리 식별자 반환, 아니면 throw. */
export async function requireStaff(): Promise<string> {
  const id = await currentAdminIdentity();
  if (!id || !isAdminPanelAccess(id.role)) {
    throw new Error("권한이 없습니다: 관리자 또는 스태프만 가능합니다.");
  }
  return id.name;
}

/** 최종 관리자(admin) 전용 요구. 통과 시 관리 식별자 반환, 아니면 throw. */
export async function requireSuperAdmin(): Promise<string> {
  const id = await currentAdminIdentity();
  if (!id || !isSuperAdmin(id.role)) {
    throw new Error("권한이 없습니다: 최종 관리자만 가능한 작업입니다.");
  }
  return id.name;
}

/** UI 분기용 — 현재 세션 role(없으면 null). */
export async function currentAdminRole(): Promise<string | null> {
  const id = await currentAdminIdentity();
  return id?.role ?? null;
}

/**
 * 특권 대상 보호 가드 — 스태프(manager)가 상위/동급 관리자를 대상으로 특권 조치
 * (제재·비밀번호 재설정·2FA 해제·코인/구독 지급 등)를 하지 못하게 하는 단일 공용 가드.
 *  - 슈퍼 계정(creator_name='admin')은 어떤 스태프도 조치 대상으로 삼을 수 없다.
 *  - 관리자·스태프(admin·manager) 계정은 최종 관리자(admin)만 조치할 수 있다.
 * 통과하지 못하면 throw 한다(호출부는 try/catch 로 { error } 를 반환).
 * ⚠ 특권 액션을 새로 추가할 때는 반드시 대상 조회 직후 이 가드를 호출할 것(권한상승 방지).
 */
export async function assertCanActOn(target: { creator_name: string; role?: string | null }): Promise<void> {
  if (target.creator_name === "admin") {
    throw new Error("슈퍼 관리자 계정은 이 작업의 대상이 될 수 없습니다.");
  }
  if (isAdminPanelAccess(target.role)) {
    const me = await currentAdminIdentity();
    if (!isSuperAdmin(me?.role)) {
      throw new Error("관리자·스태프 계정은 최종 관리자만 조치할 수 있습니다.");
    }
  }
}

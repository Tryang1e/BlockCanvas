// 접근 차단 목록(blocklist) — 인증(마크/Discord 연동·이메일 가입) 게이트와 관리 액션이 공유하는 단일 출처.
// 개인정보 최소수집(개인정보보호법 제3조): 식별자 원문(UUID/Discord ID/이메일)을 저장하지 않고 HMAC-SHA256 해시만 저장한다.
// 무염(no-salt) 단순 SHA-256 은 값 공간이 좁은 식별자(UUID/숫자 ID)를 무차별 대입으로 재식별할 수 있어,
// 서버 고정 키 기반 HMAC(keyed-hash)로 저장한다(재식별 방지). 관계법령 검토: dev_notes/legal_blocklist_review.md
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type BlockType = "minecraft_uuid" | "discord_id" | "email";

const DEFAULT_KEY = "blockcanvas-blocklist-dev";
// 전용 키가 없으면 인게임 API 키(운영에서 이미 강력한 무작위 값 필수)를 재사용한다.
const HASH_KEY =
  process.env.BLOCKLIST_HASH_SECRET || process.env.MINECRAFT_API_SECRET || DEFAULT_KEY;

if (HASH_KEY === DEFAULT_KEY || HASH_KEY.length < 16) {
  if (process.env.NODE_ENV === "production") {
    // 약한 키면 해시가 무차별 대입에 취약 → 운영에서는 기동 차단.
    throw new Error(
      "BLOCKLIST_HASH_SECRET(또는 MINECRAFT_API_SECRET)이 미설정/기본값/너무 짧습니다 — 운영에서는 강력한 무작위 키(>=16자)가 필수입니다."
    );
  }
  console.warn("[blocklist] 해시 키가 기본값/짧음 — 개발 전용. 운영에선 강력한 무작위 키(>=16자) 필수.");
}

/** 식별자 정규화 — 대소문자/구분자 차이를 흡수해 대조 일관성을 보장한다. */
export function normalizeIdentity(type: BlockType, raw: string): string {
  const v = (raw || "").trim();
  if (type === "minecraft_uuid") return v.toLowerCase().replace(/[^0-9a-f]/g, ""); // 32-hex(대시 제거)
  if (type === "discord_id") return v.replace(/[^0-9]/g, ""); // 숫자만(snowflake)
  return v.toLowerCase(); // email
}

/** 정규화된 값이 형식상 유효한지(관리자 입력 검증용). */
export function isValidIdentity(type: BlockType, normalized: string): boolean {
  if (!normalized) return false;
  if (type === "minecraft_uuid") return /^[0-9a-f]{32}$/.test(normalized);
  if (type === "discord_id") return /^[0-9]{5,25}$/.test(normalized);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized); // email
}

/** HMAC-SHA256(key, "<type>:<정규화 값>") — 저장·대조에 쓰는 단방향 해시(원문 미보관). */
export function hashIdentity(type: BlockType, raw: string): string {
  const normalized = normalizeIdentity(type, raw);
  return crypto.createHmac("sha256", HASH_KEY).update(`${type}:${normalized}`).digest("hex");
}

/** 관리 화면 표시용 마스킹 힌트 — 재식별 위험을 최소화하면서 관리자가 알아볼 수 있게 일부만 노출. */
export function identityHint(type: BlockType, raw: string): string {
  const n = normalizeIdentity(type, raw);
  if (type === "email") {
    const [user, domain] = (raw || "").trim().toLowerCase().split("@");
    if (!domain) return "***";
    const head = user.slice(0, 2);
    return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
  }
  if (n.length <= 8) return `${n.slice(0, 2)}…`;
  return `${n.slice(0, 4)}…${n.slice(-4)}`;
}

/** 마크 UUID 를 Profile.minecraft_uuid 대조용 변형들로 확장(대시 유무 모두 시도). */
export function uuidLookupVariants(raw: string): string[] {
  const hex = normalizeIdentity("minecraft_uuid", raw);
  if (hex.length !== 32) return Array.from(new Set([raw, raw.toLowerCase()].filter(Boolean)));
  const dashed = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return Array.from(new Set([hex, dashed, hex.toUpperCase(), dashed.toUpperCase()]));
}

/**
 * 이 식별자가 현재 차단 상태인지 판정한다(만료된 유기 차단은 무시).
 * 인증 게이트 핫패스 — DB 오류 시 fail-open(false, 로그만)으로 전체 인증 마비를 막는다.
 */
export async function isIdentityBlocked(type: BlockType, raw: string): Promise<boolean> {
  return (await findActiveBlock(type, raw)) !== null;
}

/**
 * 인증/가입 게이트용 — DB 조회 실패 시 예외를 그대로 던진다(fail-closed).
 * 호출측(연동 콜백·가입)이 catch 해 '완료를 거부'하도록 하여, 조회 장애 창에 차단 우회로 영속 계정이 생기는 것을 막는다.
 */
export async function isIdentityBlockedStrict(type: BlockType, raw: string): Promise<boolean> {
  return (await findActiveBlock(type, raw, true)) !== null;
}

/** 현재 유효한 차단 레코드(만료 안 됨)를 반환. 없으면 null. strict=true 면 DB 오류를 삼키지 않고 던진다(게이트용 fail-closed). */
export async function findActiveBlock(type: BlockType, raw: string, strict = false) {
  try {
    const value_hash = hashIdentity(type, raw);
    const row = await prisma.blockedIdentity.findUnique({ where: { type_value_hash: { type, value_hash } } });
    if (!row) return null;
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) return null; // 유기 차단 만료
    return row;
  } catch (e) {
    console.error("[blocklist] 차단 조회 실패:", e instanceof Error ? e.message : String(e));
    if (strict) throw e; // 게이트: fail-closed(우회 방지)
    return null; // 플러그인 접속 판정 등: fail-open(가용성)
  }
}

export const BLOCK_CATEGORY_LABEL: Record<string, string> = {
  abuse: "욕설/혐오",
  exploit: "시스템 악용",
  griefing: "테러/그리핑",
  cheat: "핵/치트",
  payment_fraud: "결제 사기",
  evasion: "제재 회피",
  other: "기타",
};

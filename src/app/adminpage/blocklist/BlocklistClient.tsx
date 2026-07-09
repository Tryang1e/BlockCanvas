"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Ban,
  Trash2,
  Search,
  ShieldAlert,
  CheckCircle2,
  UserX,
  Clock,
  Info,
} from "lucide-react";
import {
  lookupIdentityAction,
  addBlockAction,
  removeBlockAction,
  listBlocksAction,
  type AddBlockInput,
} from "@/app/actions/blocklist";

type BlockType = "minecraft_uuid" | "discord_id" | "email";

const TYPE_LABEL: Record<string, string> = {
  minecraft_uuid: "마크 UUID",
  discord_id: "Discord ID",
  email: "이메일",
};

// 게임 이용 저해행위 유형(제재 사유 범주) — lib/blocklist 는 서버 전용이라 라벨을 클라에 재정의.
const CATEGORY_LABEL: Record<string, string> = {
  abuse: "욕설/혐오",
  exploit: "시스템 악용",
  griefing: "테러/그리핑",
  cheat: "핵/치트",
  payment_fraud: "결제 사기",
  evasion: "제재 회피",
  other: "기타",
};

const STATUS_LABEL: Record<string, string> = {
  active: "정상",
  suspended: "이용정지",
  banned: "영구차단",
};

interface Block {
  id: string;
  type: string;
  category: string;
  hint: string | null;
  reason: string;
  blockedBy: string;
  settlementNote: string | null;
  createdAt: number;
  expiresAt: number | null;
  expired: boolean;
  needsReview: boolean;
  linked: { creatorName: string; status: string } | null;
}

interface Matched {
  id: string;
  creatorName: string;
  displayName: string | null;
  status: string;
  paid: { subscriptionUntil: string | null; subscriptionDaysLeft: number };
}

interface Lookup {
  valid: boolean;
  hint: string;
  alreadyBlocked: boolean;
  matched: Matched | null;
}

function fmt(ms: number | null) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("ko-KR");
  } catch {
    return "—";
  }
}

export default function BlocklistClient() {
  const [type, setType] = useState<BlockType>("minecraft_uuid");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("evasion");
  const [reason, setReason] = useState("");
  const [expiryMode, setExpiryMode] = useState<"permanent" | "days">("permanent");
  const [expiryDays, setExpiryDays] = useState("30");
  const [settlementNote, setSettlementNote] = useState("");

  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listBlocksAction();
    if ("success" in r && r.success) setBlocks(r.blocks as Block[]);
    else setToast({ type: "error", text: ("error" in r && r.error) || "목록을 불러오지 못했습니다." });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doLookup = async () => {
    if (!value.trim()) return;
    setLooking(true);
    setToast(null);
    const r = await lookupIdentityAction(type, value);
    if ("error" in r) setToast({ type: "error", text: r.error || "조회에 실패했습니다." });
    else setLookup({ valid: r.valid, hint: r.hint, alreadyBlocked: r.alreadyBlocked, matched: r.matched });
    setLooking(false);
  };

  const submit = async () => {
    if (!value.trim()) return setToast({ type: "error", text: "식별자를 입력해 주세요." });
    if (!reason.trim()) return setToast({ type: "error", text: "차단 사유는 필수입니다." });
    setSubmitting(true);
    setToast(null);
    const input: AddBlockInput = {
      type,
      value: value.trim(),
      reason: reason.trim(),
      category,
      expiresDays: expiryMode === "days" ? Math.max(1, parseInt(expiryDays, 10) || 0) : null,
      settlementNote: settlementNote.trim() || undefined,
    };
    const r = await addBlockAction(input);
    if ("error" in r && r.error) {
      setToast({ type: "error", text: r.error });
    } else {
      setToast({
        type: "success",
        text: "success" in r && r.suspendedLinked ? "차단 등록 완료 — 연동 계정을 이용정지했습니다." : "차단 목록에 등록했습니다.",
      });
      setValue("");
      setReason("");
      setSettlementNote("");
      setLookup(null);
      await load();
    }
    setSubmitting(false);
  };

  const remove = async (id: string) => {
    if (!confirm("이 항목을 차단 목록에서 제거하시겠습니까? (연동 계정의 이용정지는 자동 해제되지 않습니다)")) return;
    setBusy(id);
    setToast(null);
    const r = await removeBlockAction(id);
    if ("error" in r && r.error) setToast({ type: "error", text: r.error });
    else {
      setToast({ type: "success", text: "차단을 해제했습니다." });
      await load();
    }
    setBusy(null);
  };

  const paid = lookup?.matched?.paid;
  const hasPaidValue = !!paid && paid.subscriptionDaysLeft > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ban size={22} className="text-rose-600" /> 접근 차단 목록
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          제재 회피(부계정 재가입)를 막기 위해 마크 UUID·Discord ID·이메일을 차단합니다. 식별자는 단방향 해시로 저장되며(원문 미보관),
          차단 시 연동된 계정은 무기한 이용정지됩니다.
        </p>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={15} className="mt-px" /> : <ShieldAlert size={15} className="mt-px" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* 등록 폼 */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-neutral-800">차단 등록</h2>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as BlockType);
              setLookup(null);
            }}
            className="rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500 sm:w-40"
          >
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setLookup(null);
            }}
            placeholder={type === "email" ? "user@example.com" : type === "discord_id" ? "숫자 Discord ID" : "마크 UUID (대시 유무 무관)"}
            className="flex-1 rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500 font-mono"
          />
          <button
            onClick={doLookup}
            disabled={looking || !value.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-neutral-300 hover:border-black text-neutral-700 text-sm font-bold rounded-xl disabled:opacity-50"
          >
            {looking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} 조회
          </button>
        </div>

        {/* 조회 결과 — 연동 계정 + 유료가치 스냅샷(정산 분리 판단 근거) */}
        {lookup && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[13px] space-y-1.5">
            {!lookup.valid ? (
              <p className="text-rose-600 font-medium flex items-center gap-1.5">
                <ShieldAlert size={14} /> 식별자 형식이 올바르지 않습니다.
              </p>
            ) : (
              <>
                <p className="text-neutral-600">
                  대상: <span className="font-mono font-bold">{lookup.hint}</span>
                  {lookup.alreadyBlocked && <span className="ml-2 text-rose-600 font-bold">· 이미 차단됨</span>}
                </p>
                {lookup.matched ? (
                  <>
                    <p className="text-neutral-700">
                      연동 계정: <b>{lookup.matched.displayName || lookup.matched.creatorName}</b> (@{lookup.matched.creatorName}) ·
                      현재 상태 <b>{STATUS_LABEL[lookup.matched.status] || lookup.matched.status}</b>
                    </p>
                    <p className={`flex items-center gap-1.5 ${hasPaidValue ? "text-amber-700 font-semibold" : "text-neutral-500"}`}>
                      <Info size={13} />
                      {hasPaidValue
                        ? `유료가치 있음 — 구독 잔여 약 ${paid!.subscriptionDaysLeft}일 (~${fmt(paid!.subscriptionUntil ? new Date(paid!.subscriptionUntil).getTime() : null)}). 아래 정산 메모를 기록하세요.`
                        : "유상 구독 잔여 없음. (코인은 비현금 포인트 — CMI 별도)"}
                    </p>
                  </>
                ) : (
                  <p className="text-neutral-500">현재 이 식별자와 연동된 계정 없음(사전 차단).</p>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 mb-1">사유 범주(게임이용 저해행위)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500"
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 mb-1">차단 기간</label>
            <div className="flex gap-2">
              <select
                value={expiryMode}
                onChange={(e) => setExpiryMode(e.target.value as "permanent" | "days")}
                className="rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500"
              >
                <option value="permanent">영구</option>
                <option value="days">기간제(일)</option>
              </select>
              {expiryMode === "days" && (
                <input
                  type="number"
                  min={1}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-24 rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500"
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-500 mb-1">
            차단 사유 <span className="text-rose-500">*필수</span>
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 반복적 욕설·시스템 악용으로 이용정지 후 부계정 재가입 시도"
            className="w-full rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-500 mb-1">
            유료가치 정산 메모 {hasPaidValue && <span className="text-amber-600">· 유료 잔여 있음</span>}
          </label>
          <input
            value={settlementNote}
            onChange={(e) => setSettlementNote(e.target.value)}
            placeholder="예: 구독 잔여 12일 — 위반 실손해와 상계 후 환급 없음 / 또는 환급 처리함"
            className="w-full rounded-xl px-3 py-2.5 bg-neutral-50 border border-neutral-200 text-sm outline-none focus:border-rose-500"
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            차단과 정산은 별개입니다. 유료 잔여가 있으면 &lsquo;전액 소멸&rsquo;이 아니라 실손해 상계 후 환급 여부를 기록하세요.
          </p>
        </div>

        <button
          onClick={submit}
          disabled={submitting || !value.trim() || !reason.trim()}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} 차단 목록에 등록
        </button>
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-800">차단 항목 ({blocks.length})</h2>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-neutral-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> 불러오는 중...
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-neutral-200 rounded-2xl">
            <Ban className="mx-auto text-neutral-300 mb-2" size={30} />
            <p className="text-sm text-neutral-500">차단된 식별자가 없습니다.</p>
          </div>
        ) : (
          blocks.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white text-[11px] font-bold">{TYPE_LABEL[b.type] || b.type}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">{CATEGORY_LABEL[b.category] || b.category}</span>
                    {b.expired ? (
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 text-[11px] font-bold">만료됨</span>
                    ) : b.expiresAt ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center gap-1">
                        <Clock size={10} /> ~{fmt(b.expiresAt)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-bold">영구</span>
                    )}
                    {b.needsReview && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">재검토 필요(3년+)</span>
                    )}
                    <span className="font-mono text-[12px] text-neutral-500">{b.hint}</span>
                  </div>
                  <p className="text-sm text-neutral-800 mt-1.5">{b.reason}</p>
                  <p className="text-[12px] text-neutral-500 mt-0.5">
                    등록 {b.blockedBy} · {fmt(b.createdAt)}
                    {b.linked && (
                      <>
                        {" · "}
                        <span className="inline-flex items-center gap-1">
                          <UserX size={11} /> 연동계정 @{b.linked.creatorName} ({STATUS_LABEL[b.linked.status] || b.linked.status})
                        </span>
                      </>
                    )}
                  </p>
                  {b.settlementNote && (
                    <p className="text-[12px] text-amber-700 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                      정산: {b.settlementNote}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(b.id)}
                  disabled={busy === b.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-200 text-neutral-600 hover:border-rose-300 hover:text-rose-600 text-[11px] font-bold rounded-lg disabled:opacity-50 shrink-0"
                >
                  {busy === b.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} 해제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Mail, CheckCircle2, ShieldAlert } from "lucide-react";
import { addEmailToAccount } from "@/app/actions/auth";
import { validatePassword, PASSWORD_POLICY_HINT } from "@/lib/password-policy";

/**
 * Discord 로 가입해 이메일/비번이 없는 계정이 '웹 인증'을 추가하는 폼.
 * 제출 → 인증 메일 발송 → 링크 클릭 시 기존 계정에 이메일/비번 설정(+3종 충족 시 건축 권한).
 * 연동 페이지에서 profile.email 이 없을 때만 렌더된다.
 */
export default function AddEmailCredential() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setMsg(null);

    const fd = new FormData(form);
    const pw = (fd.get("password") as string) || "";
    const pwc = (fd.get("password_confirm") as string) || "";
    const pc = validatePassword(pw);
    if (!pc.ok) return setMsg({ type: "error", text: pc.error || "비밀번호 형식을 확인해 주세요." });
    if (pw !== pwc) return setMsg({ type: "error", text: "비밀번호와 비밀번호 확인이 일치하지 않습니다." });

    setPending(true);
    try {
      const res = await addEmailToAccount(fd);
      if ("error" in res) {
        setMsg({ type: "error", text: res.error ?? "처리에 실패했습니다." });
      } else {
        setMsg({ type: "success", text: res.message ?? "" });
        form.reset();
      }
    } catch {
      setMsg({ type: "error", text: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-neutral-200 p-8 mt-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 bg-neutral-900 text-white rounded-xl">
          <Mail size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">웹 계정 인증 (이메일·비밀번호 추가)</h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium leading-relaxed">
            Discord 로 가입한 계정은 이메일/비밀번호가 없습니다. 추가하면 이메일 로그인·비밀번호 찾기를 쓸 수 있고,
            <b className="text-neutral-700"> 3종 인증(웹·Discord·마크)을 완성해 건축 권한</b>을 받습니다.
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium mb-6 flex items-start gap-2.5 ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {msg.type === "success" ? <CheckCircle2 size={16} className="mt-0.5" /> : <ShieldAlert size={16} className="mt-0.5" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="add_email" className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 tracking-wider">
            이메일
          </label>
          <input
            id="add_email"
            name="email"
            type="email"
            required
            placeholder="name@example.com"
            className="w-full rounded-xl px-4 py-3 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 outline-none text-sm transition-all"
          />
        </div>
        <div>
          <label htmlFor="add_pw" className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 tracking-wider">
            비밀번호
          </label>
          <input
            id="add_pw"
            name="password"
            type="password"
            required
            placeholder="••••••••"
            className="w-full rounded-xl px-4 py-3 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 outline-none text-sm transition-all"
          />
          <p className="text-[11px] text-neutral-400 mt-1.5">{PASSWORD_POLICY_HINT}</p>
        </div>
        <div>
          <label htmlFor="add_pwc" className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5 tracking-wider">
            비밀번호 확인
          </label>
          <input
            id="add_pwc"
            name="password_confirm"
            type="password"
            required
            placeholder="••••••••"
            className="w-full rounded-xl px-4 py-3 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 outline-none text-sm transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50"
        >
          {pending ? "전송 중..." : "인증 메일 받기"}
        </button>
      </form>
    </section>
  );
}

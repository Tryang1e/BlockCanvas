"use client";

import { useState } from "react";
import { X } from "lucide-react";

// 마인크래프트 머리 아바타(헬멧 레이어 포함). uuid 가 있으면 uuid, 없으면 닉네임으로 렌더한다.
// mc-heads.net 는 uuid/닉네임 둘 다 허용하고 CORS 없이 <img> 로 바로 쓸 수 있어 next/image 설정이 불필요하다.
export default function McAvatar({
  id,
  name,
  size = 22,
}: {
  id?: string | null;
  name: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  const key = id && id.length > 0 ? id : name || "MHF_Steve";

  if (err || !key) {
    return (
      <span
        className="inline-flex items-center justify-center rounded bg-neutral-200 text-[10px] font-bold text-neutral-500 shrink-0"
        style={{ width: size, height: size }}
      >
        {(name || "?").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://mc-heads.net/avatar/${encodeURIComponent(key)}/${size * 2}`}
      alt={name}
      onError={() => setErr(true)}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      className="rounded shrink-0"
    />
  );
}

// 초대된 멤버 칩(머리 + 닉네임). 첨부 스크린샷 스타일. onRemove 가 있으면 제외 버튼 표시.
export function McMemberChip({
  id,
  name,
  onRemove,
  disabled,
}: {
  id?: string | null;
  name: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-neutral-100 rounded-full text-[11px] font-medium text-neutral-700">
      <McAvatar id={id} name={name} size={20} />
      <span className="truncate max-w-[120px]">{name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={disabled}
          className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40"
          title="제외"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

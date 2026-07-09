"use client";

import { useState } from "react";
import { X } from "lucide-react";

// 마인크래프트 머리 아바타(헬멧 레이어 포함). uuid 가 있으면 uuid, 없으면 닉네임으로 렌더한다.
// ⚠ mc-heads.net 가 가끔 '전체를 기본 스티브'로 내려보내는 장애가 있어(HTTP 200 이라 onError 도 안 걸림),
//   Mojang 에서 직접 신선하게 렌더하는 crafatar(uuid 필요) → minotar 를 우선하고 mc-heads 는 마지막 폴백으로 둔다.
//   세 서비스 모두 CORS 없이 <img> 로 바로 쓸 수 있어 next/image 설정이 불필요하다.
function avatarUrls(id: string | null | undefined, name: string, px: number): string[] {
  const dashless = (id || "").replace(/-/g, "");
  const uuid = dashless.length === 32 ? dashless : null;
  const key = id && id.length > 0 ? id : name || "MHF_Steve";
  const urls: string[] = [];
  // minotar: Mojang 최신 스킨을 신선하게 렌더, 현재 안정적. uuid(대시 제거)/닉네임 모두 허용 → 1순위.
  urls.push(`https://minotar.net/helm/${encodeURIComponent(uuid || key)}/${px}.png`);
  // crafatar: uuid 전용 폴백(가끔 521 다운).
  if (uuid) urls.push(`https://crafatar.com/avatars/${uuid}?size=${px}&overlay`);
  // mc-heads: 마지막 폴백(가끔 전체 스티브로 다운됨).
  urls.push(`https://mc-heads.net/avatar/${encodeURIComponent(key)}/${px}`);
  return urls;
}

export default function McAvatar({
  id,
  name,
  size = 22,
}: {
  id?: string | null;
  name: string;
  size?: number;
}) {
  const key = id && id.length > 0 ? id : name || "MHF_Steve";
  const urls = avatarUrls(id, name, size * 2);
  // 공급원 폴백 인덱스. key 가 바뀌면(다른 멤버 렌더) 0 으로 자동 리셋(props 파생 상태 — effect 불필요).
  const [failover, setFailover] = useState<{ key: string; idx: number }>({ key, idx: 0 });
  const idx = failover.key === key ? failover.idx : 0;

  if (!key || idx >= urls.length) {
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
      src={urls[idx]}
      alt={name}
      onError={() => setFailover({ key, idx: idx + 1 })}
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

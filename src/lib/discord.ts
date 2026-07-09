// Discord 웹훅 게시 유틸 — 갤러리 공유 등 자동 알림. 봇/discord.js 의존 없이 raw fetch + 임베드 JSON.
// best-effort: 실패해도 호출측 본동작(게시 등)을 막지 않는다. (worldQuotaEnforcement.postDiscord 패턴 일반화)

/** 임베드 페이로드를 웹훅으로 전송. ?wait=true 로 게시 메시지 id 를 회수(저장용). 실패 시 ok:false. */
export async function postToDiscordWebhook(
  url: string,
  payload: object
): Promise<{ ok: boolean; messageId?: string }> {
  try {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false };
    try {
      const j = (await res.json()) as { id?: unknown };
      return { ok: true, messageId: typeof j?.id === "string" ? j.id : undefined };
    } catch {
      return { ok: true };
    }
  } catch {
    return { ok: false };
  }
}

/**
 * 웹에서 갤러리 게시물 삭제/제거 시 Discord 게시글도 삭제(동기화). best-effort.
 *  1) 봇 토큰(DISCORD_BOT_TOKEN)이 있으면 → 포럼 게시글=스레드째 삭제(DELETE /channels/{threadId}).
 *     (포럼은 스레드 id == 시작 메시지 id 라 messageId 를 그대로 사용. 봇은 대상 채널에 Manage Threads 권한 필요.)
 *     ⚠ 웹훅만으로는 스레드를 못 지운다(메시지만 지워져 "원본 메시지 삭제됨" 빈 스레드가 남음) → 봇 토큰 필요.
 *  2) 봇 토큰이 없거나 대상이 스레드가 아니면(일반 채널) → 웹훅 메시지 삭제로 폴백.
 */
export async function deleteBlueprintDiscordMessage(messageId: string | null | undefined): Promise<boolean> {
  if (!messageId) return false;

  // 1) 봇 토큰으로 포럼 스레드(=게시글)째 삭제.
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (botToken) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return true; // 스레드(포럼 게시글) 삭제 성공
      // 스레드가 아님(일반 채널 메시지)·권한 없음 등 → 아래 웹훅 삭제로 폴백
    } catch {
      /* fall through */
    }
  }

  // 2) 웹훅 메시지 삭제(일반 채널 / 봇 토큰 미설정). 포럼이면 메시지만 지워지고 빈 스레드가 남을 수 있음.
  const url = process.env.DISCORD_GALLERY_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  const base = url.split("?")[0];
  try {
    let res = await fetch(`${base}/messages/${messageId}?thread_id=${messageId}`, { method: "DELETE", signal: AbortSignal.timeout(6000) });
    if (!res.ok) res = await fetch(`${base}/messages/${messageId}`, { method: "DELETE", signal: AbortSignal.timeout(6000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Discord 마크다운 깨짐/링크·멘션 주입 방지 — 사용자 입력 정제. 링크 문법([]()) 과 개행도 제거해 임베드 구조/피싱 링크 주입 차단. */
function sanitize(s: string | null | undefined, max = 240): string {
  return (s || "").replace(/[*_~`|>@[\]()]/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

/** 사람이 읽기 쉬운 바이트 표기(KB/MB). */
function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export interface BlueprintShareEmbedInput {
  origin: string; // 예: https://{author}.craftopia.work
  postId: string;
  title: string;
  description?: string | null;
  ext: string; // .bp | .schem
  fileBytes: number;
  authorName: string;
  faceUrl?: string | null; // 작성자 얼굴(마크 머리) 공개 URL — Discord 가 직접 fetch (minotar 등)
  coverWebp?: Buffer | null; // 표지 webp — 첨부로 직접 업로드(localhost 에서도 표시됨)
  tags?: string[];
  price?: number; // 판매가(코인). 0/미지정 = 무료.
}

/**
 * 새 블루프린트 공유를 갤러리 채널에 게시. DISCORD_GALLERY_WEBHOOK_URL(없으면 DISCORD_WEBHOOK_URL) 사용.
 * 표지는 멀티파트 첨부(attachment://cover.webp)로 직접 올려 공개 URL 없이도 임베드에 표시된다.
 * 얼굴(마크 머리)은 공개 URL(icon_url)로 Discord 가 직접 가져온다. 웹훅 미설정 시 조용히 패스(ok:false).
 */
export async function postBlueprintShare(
  input: BlueprintShareEmbedInput
): Promise<{ ok: boolean; messageId?: string }> {
  const url = process.env.DISCORD_GALLERY_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { ok: false };

  const link = `${input.origin}/gallery/${input.postId}`;
  const price = Math.max(0, Math.floor(input.price ?? 0));
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "형식", value: input.ext === ".bp" ? "Axiom 블루프린트 (.bp)" : "WorldEdit 스키매틱 (.schem)", inline: true },
    { name: "크기", value: fmtBytes(input.fileBytes), inline: true },
    { name: "가격", value: price > 0 ? `🪙 ${price.toLocaleString()} 코인` : "무료", inline: true },
  ];
  const tags = (input.tags || []).map((t) => sanitize(t, 24)).filter(Boolean).slice(0, 6);
  if (tags.length) fields.push({ name: "태그", value: tags.map((t) => `#${t}`).join(" "), inline: false });

  const desc = sanitize(input.description, 300);
  const authorName = sanitize(input.authorName, 80) || "익명"; // 마크 닉네임
  const embed: Record<string, unknown> = {
    title: `📦 ${sanitize(input.title, 100)}`,
    url: link,
    description: `${desc ? desc + "\n\n" : ""}[갤러리에서 보기](${link})`,
    color: 0x6366f1, // indigo — 사이트 primary
    author: {
      name: authorName,
      ...(input.faceUrl ? { icon_url: input.faceUrl } : {}),
    },
    fields,
    footer: { text: "BlockCanvas 블루프린트 갤러리" },
    timestamp: new Date().toISOString(),
  };
  if (input.coverWebp && input.coverWebp.length) embed.image = { url: "attachment://cover.webp" };

  // 메시지 표시 이름/아바타 = 마크 닉네임/머리(웹훅 기본 디스코드 이름 대신 override).
  // 포럼 채널은 thread_name 필수 → 1차에 포함, 일반 채널이 거부하면 thread_name 없이 재시도(자동 적응).
  const base: Record<string, unknown> = {
    username: authorName,
    ...(input.faceUrl ? { avatar_url: input.faceUrl } : {}),
    embeds: [embed],
  };
  const threadName = sanitize(input.title, 90) || "블루프린트";
  return sendWebhookAdaptive(url, base, threadName, input.coverWebp);
}

/** payload 를 멀티파트(표지 첨부) 또는 JSON 으로 1회 전송. */
async function sendWebhookOnce(url: string, payload: Record<string, unknown>, coverWebp?: Buffer | null): Promise<Response> {
  const sep = url.includes("?") ? "&" : "?";
  const target = `${url}${sep}wait=true`;
  if (coverWebp && coverWebp.length) {
    const fd = new FormData();
    fd.append("payload_json", JSON.stringify(payload));
    fd.append("files[0]", new Blob([new Uint8Array(coverWebp)], { type: "image/webp" }), "cover.webp");
    return fetch(target, { method: "POST", body: fd, signal: AbortSignal.timeout(8000) });
  }
  return fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
}

/** 포럼 채널(thread_name 필수)·일반 채널 모두 대응 — thread_name 포함 1차, 실패 시 제외 재시도. */
async function sendWebhookAdaptive(
  url: string,
  base: Record<string, unknown>,
  threadName: string,
  coverWebp?: Buffer | null
): Promise<{ ok: boolean; messageId?: string }> {
  try {
    let res = await sendWebhookOnce(url, { ...base, thread_name: threadName }, coverWebp);
    if (!res.ok) res = await sendWebhookOnce(url, base, coverWebp); // 일반 채널이 thread_name 거부 시
    if (!res.ok) return { ok: false };
    try {
      const j = (await res.json()) as { id?: unknown };
      return { ok: true, messageId: typeof j?.id === "string" ? j.id : undefined };
    } catch {
      return { ok: true };
    }
  } catch {
    return { ok: false };
  }
}

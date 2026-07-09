// 운영 경보(operational alert) — 크리티컬 운영 이벤트(스윕 실패·백업 실패·디스크 부족·결제 미정산·플러그인 다운 등)를
// 로그로 남기고, 설정 시 Discord 채널로 통지한다. 자체호스팅 단일 인스턴스라 별도 APM 없이 최소 관측을 제공.
//
//  - DISCORD_OPS_WEBHOOK_URL (없으면 DISCORD_WEBHOOK_URL) 미설정 시 로그만(no-op 통지).
//  - 동일 key 는 debounce(기본 1h) 로 스팸 방지 — 인메모리(프로세스당), 재시작 시 초기화(best-effort).
//  - fire-and-forget 로 호출하고 실패를 삼킨다 — 경보 자체가 본동작을 막으면 안 된다.
const lastSent = new Map<string, number>();

export async function opsAlert(
  key: string,
  message: string,
  opts?: { debounceMs?: number; level?: "warn" | "error" | "critical" }
): Promise<void> {
  const level = opts?.level ?? "error";
  // 항상 서버 로그에는 남긴다(웹훅 미설정이어도 관측 가능).
  (level === "warn" ? console.warn : console.error)(`[ops:${level}] ${key}: ${message}`);

  const url = process.env.DISCORD_OPS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const debounceMs = opts?.debounceMs ?? 60 * 60 * 1000;
  const now = Date.now();
  const prev = lastSent.get(key);
  if (prev && now - prev < debounceMs) return; // 디바운스 — 같은 이벤트 반복 통지 억제
  lastSent.set(key, now);
  // 맵 비대화 방지(경보 종류는 소수이나 안전장치)
  if (lastSent.size > 500) {
    for (const [k, t] of lastSent) if (now - t > debounceMs) lastSent.delete(k);
  }

  const emoji = level === "critical" ? "🔴" : level === "warn" ? "🟡" : "🟠";
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `${emoji} **[BlockCanvas ops] ${key}**\n${message}`.slice(0, 1900) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* best-effort — 통지 실패는 무시(로그는 이미 남김) */
  }
}

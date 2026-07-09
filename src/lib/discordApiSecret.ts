// Discord 연동(HMAC) 인바운드 라우트가 공유하는 시크릿 — /api/discord/*, /api/gallery/reaction.
// 웹↔봇 간 요청을 HMAC-SHA256 으로 검증하는 데 쓰이며, verifyInboundSignature 의 secret 인자로 전달된다.
//
// ⚠ 기본(공개) 시크릿/너무 짧은 키는 HMAC 보호를 무력화한다(누구나 역할 승격·코인 발행 API 를 위조 가능).
//    MINECRAFT_API_SECRET(lib/minecraft.ts)과 동일하게, 운영(production)에서는 fail-closed(throw)로 막아
//    위조 가능한 상태로 기동하지 않게 한다. 개발에서는 로컬 편의를 위해 경고만 하고 통과한다.
const DEFAULT_DISCORD_API_SECRET = "blockcanvas-discord-secret";

export const DISCORD_API_SECRET =
  process.env.DISCORD_API_SECRET || DEFAULT_DISCORD_API_SECRET;

if (DISCORD_API_SECRET === DEFAULT_DISCORD_API_SECRET || DISCORD_API_SECRET.length < 16) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DISCORD_API_SECRET 이 미설정/기본값/너무 짧습니다 — 운영에서는 강력한 무작위 키(>=16자)가 필수입니다. " +
        ".env 에 설정하고 재시작하세요. (기본값을 쓰면 누구나 HMAC 으로 디스코드 연동 API 를 위조해 역할 승격·코인 발행이 가능합니다)"
    );
  }
  console.warn(
    "[discord] DISCORD_API_SECRET 이 기본값/미설정/짧음입니다 — 개발 전용. 운영에선 강력한 무작위 키(>=16자) 필수."
  );
}

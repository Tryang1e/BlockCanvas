import crypto from "crypto";

// 월드의 서버 폴더명은 "{플레이어닉네임}_{월드이름}" 을 sha256 해시한 값으로 만든다.
// → 서버 디스크에 닉네임/월드이름이 평문으로 노출되지 않게 하고(난독화), 충돌·경로이탈을 차단한다.
// 표시 이름(name)은 DB 에 그대로 보관하고, world_key(해시 hex)와 mv_world(폴더명)를 파생 저장한다.

/** "{nick}_{name}" 의 sha256 hex. 닉/이름은 소문자·trim 정규화 후 해시(대소문자 차이로 중복 폴더 방지). */
export function computeWorldKey(nick: string, worldName: string): string {
  const norm = `${(nick || "").trim().toLowerCase()}_${(worldName || "").trim().toLowerCase()}`;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}

/** world_key(hex) → 서버 폴더명. sanitizeWorldName([A-Za-z0-9_-]) 규칙을 만족하도록 접두사+24자. */
export function worldFolderFromKey(worldKey: string): string {
  return "w_" + worldKey.slice(0, 24);
}

/** 닉+이름으로 폴더명을 한 번에 구한다. */
export function computeWorldFolder(nick: string, worldName: string): string {
  return worldFolderFromKey(computeWorldKey(nick, worldName));
}

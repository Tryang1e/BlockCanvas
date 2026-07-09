import path from "path";
import { promises as fs } from "fs";
import { MC_SERVER_DIR } from "@/lib/mcServerDir";

/**
 * 스키매틱 클라우드 — 플레이어별 개인 .schem/.bp 저장 + 사용자 폴더(서브디렉토리) 관리.
 * 경로: <MC서버>/plugins/FastAsyncWorldEdit/schematics/<raw-uuid>/[사용자 폴더…]/파일
 *   (FAWE per-player-schematics 와 동일 폴더 → 인게임 //schem save/load 와 웹이 폴더째 양방향 동기화.
 *    FAWE 도 `//schem save 폴더/이름` 서브폴더를 지원하므로 호환.)
 * 웹이 같은 머신 디스크에 직접 접근(itemsadder-pack 패턴). 백업 없음. 90일 미접속 시 폴더 정리.
 * NFT(파일 추적기)의 동적 경로 과추적 경고는 next.config.ts turbopack.ignoreIssue 에서 억제(매직코멘트는 fs 엔 무효).
 */
const SCHEMATICS_ROOT =
  process.env.SCHEMATICS_DIR ||
  path.join(MC_SERVER_DIR, "plugins", "FastAsyncWorldEdit", "schematics");

export const ALLOWED_EXT = [".schem", ".schematic", ".bp"]; // .bp = Axiom 블루프린트(웹 변환/저장 지원)
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 파일당 25MB
export const MAX_FILES = 200; // 플레이어당 최대 개수(전 폴더 합산)
const MAX_DEPTH = 8; // 사용자 폴더 최대 깊이
const SEG_RE = /^[\w가-힣 .()\-]+$/; // 경로 세그먼트(폴더명/파일명) 허용 문자

/** 확장자별 매직바이트 검증(위장 파일 차단). .schem/.schematic = gzip NBT(1f 8b), .bp = Axiom(0a e5 bb 36). */
export function hasValidMagic(name: string, buf: Buffer): boolean {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".bp") {
    return buf.length >= 4 && buf[0] === 0x0a && buf[1] === 0xe5 && buf[2] === 0xbb && buf[3] === 0x36;
  }
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b; // gzip
}

/** UUID → 폴더명. FAWE per-player 와 동일하게 raw UUID(소문자·대시). hex/대시만 허용(트래버설 차단). */
export function schemFolder(uuid: string): string {
  return uuid.toLowerCase().replace(/[^0-9a-f-]/g, "");
}

/** 플레이어 스키매틱 루트 폴더 절대경로. */
export function playerSchemDir(uuid: string): string {
  return path.join(SCHEMATICS_ROOT, schemFolder(uuid));
}

/** 파일명(basename) 정제 — 업로드 파일명 검증용. 디렉토리 부분 제거 + 허용 확장자. 부적합 시 null. */
export function safeSchemName(name: string): string | null {
  if (!name) return null;
  const base = path.basename(name.replace(/\\/g, "/")); // 디렉토리 부분 제거(트래버설 차단)
  if (!base || base === "." || base === "..") return null;
  if (base.length > 100 || !SEG_RE.test(base)) return null;
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return null;
  return base;
}

/** 폴더 상대경로 정규화·검증("" = 루트). 트래버설(.. / 절대 / 위험문자 / 과도한 깊이) 차단. 부적합 시 null. */
export function safeRelFolder(rel: string | null | undefined): string | null {
  if (rel == null || rel === "") return "";
  const parts = String(rel).replace(/\\/g, "/").split("/").filter((p) => p !== "");
  if (parts.length > MAX_DEPTH) return null;
  for (const p of parts) {
    if (p === "." || p === ".." || p.length > 64 || !SEG_RE.test(p)) return null;
  }
  return parts.join("/");
}

/** 파일 상대경로 정규화·검증(폴더…/파일.ext). 부적합 시 null. */
export function safeRelFile(rel: string | null | undefined): string | null {
  if (!rel) return null;
  const parts = String(rel).replace(/\\/g, "/").split("/").filter((p) => p !== "");
  if (parts.length === 0 || parts.length > MAX_DEPTH + 1) return null;
  const name = safeSchemName(parts[parts.length - 1]);
  if (!name) return null;
  const folder = safeRelFolder(parts.slice(0, -1).join("/"));
  if (folder === null) return null;
  return folder ? `${folder}/${name}` : name;
}

/** 폴더(상대) + basename → 검증된 파일 상대경로. 부적합 시 null. */
export function joinRel(folder: string | null | undefined, name: string): string | null {
  const f = safeRelFolder(folder);
  const n = safeSchemName(name);
  if (f === null || !n) return null;
  return f ? `${f}/${n}` : n;
}

/** uuid 폴더 내 상대경로 → 절대경로(루트 밖이면 null — 트래버설 2차 방어). */
export function resolveSchemAbs(uuid: string, rel: string): string | null {
  const root = path.resolve(playerSchemDir(uuid));
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

export interface SchematicFile {
  name: string; // basename
  path: string; // 루트 기준 상대경로(폴더 포함). 작업(다운/삭제/변환)은 이 값으로.
  bytes: number;
  mtime: number;
}
export interface SchemListing {
  folders: string[]; // subPath 즉시 하위 폴더명
  files: SchematicFile[]; // subPath 에 직접 있는 파일
}

/** subPath 폴더의 즉시 하위(폴더 + 파일) 목록. 폴더/경로 없으면 빈 목록. */
export async function listSchemDir(uuid: string, subPath = ""): Promise<SchemListing> {
  const result: SchemListing = { folders: [], files: [] };
  const folder = safeRelFolder(subPath);
  if (folder === null) return result;
  const dirAbs = resolveSchemAbs(uuid, folder);
  if (!dirAbs) return result;
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      result.folders.push(e.name);
    } else if (e.isFile() && ALLOWED_EXT.includes(path.extname(e.name).toLowerCase())) {
      try {
        const st = await fs.stat(path.join(dirAbs, e.name));
        result.files.push({ name: e.name, path: folder ? `${folder}/${e.name}` : e.name, bytes: st.size, mtime: st.mtimeMs });
      } catch {
        /* skip */
      }
    }
  }
  result.folders.sort((a, b) => a.localeCompare(b));
  result.files.sort((a, b) => b.mtime - a.mtime);
  return result;
}

/** 전체 파일 재귀 수집(쿼터·개수·공유 목록용). path = 루트 기준 상대경로. 심볼릭링크는 무시. */
export async function walkSchematics(uuid: string): Promise<SchematicFile[]> {
  const out: SchematicFile[] = [];
  async function walk(absDir: string, relDir: string, depth: number) {
    if (depth > MAX_DEPTH) return;
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(path.join(absDir, e.name), childRel, depth + 1);
      } else if (e.isFile() && ALLOWED_EXT.includes(path.extname(e.name).toLowerCase())) {
        try {
          const st = await fs.stat(path.join(absDir, e.name));
          out.push({ name: e.name, path: childRel, bytes: st.size, mtime: st.mtimeMs });
        } catch {
          /* skip */
        }
      }
    }
  }
  await walk(playerSchemDir(uuid), "", 0);
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

/** 전 폴더 총 용량(바이트). 월드 클라우드와 공동 쿼터 계산용. */
export async function playerSchematicsBytes(uuid: string): Promise<number> {
  const files = await walkSchematics(uuid);
  return files.reduce((sum, f) => sum + f.bytes, 0);
}

/** 전 폴더 총 파일 수(개수 제한 검사용). */
export async function countSchematics(uuid: string): Promise<number> {
  return (await walkSchematics(uuid)).length;
}

/** 상대경로 존재 여부(파일/폴더 공용). */
export async function schemPathExists(uuid: string, rel: string): Promise<boolean> {
  const abs = resolveSchemAbs(uuid, rel);
  if (!abs) return false;
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/** 상대경로 파일 저장(부모 폴더 자동 생성). relPath 는 검증된 값이어야 함. */
export async function savePlayerSchematic(uuid: string, relPath: string, data: Buffer): Promise<void> {
  const abs = resolveSchemAbs(uuid, relPath);
  if (!abs) throw new Error("Invalid schematic path");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
}

/** 상대경로 파일 삭제. 성공 시 true. */
export async function deletePlayerSchematic(uuid: string, relPath: string): Promise<boolean> {
  const abs = resolveSchemAbs(uuid, relPath);
  if (!abs) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch {
    return false;
  }
}

/** 폴더 생성(부모 자동). 루트 자체는 거부. relFolder 는 검증된 값이어야 함. */
export async function createSchemFolder(uuid: string, relFolder: string): Promise<boolean> {
  const root = path.resolve(playerSchemDir(uuid));
  const abs = resolveSchemAbs(uuid, relFolder);
  if (!abs || abs === root) return false;
  await fs.mkdir(abs, { recursive: true });
  return true;
}

/** 폴더 재귀 삭제(루트 자체는 거부 — 그 안의 파일들도 함께 삭제됨). 성공 시 true. */
export async function deleteSchemFolder(uuid: string, relFolder: string): Promise<boolean> {
  const root = path.resolve(playerSchemDir(uuid));
  const abs = resolveSchemAbs(uuid, relFolder);
  if (!abs || abs === root) return false; // 루트 삭제 금지
  try {
    await fs.rm(abs, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** 모든 폴더(재귀) 상대경로 목록 — 이동 대상 폴더 선택용. 정렬됨. */
export async function listAllFolders(uuid: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(absDir: string, relDir: string, depth: number) {
    if (depth > MAX_DEPTH) return;
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const childRel = relDir ? `${relDir}/${e.name}` : e.name;
        out.push(childRel);
        await walk(path.join(absDir, e.name), childRel, depth + 1);
      }
    }
  }
  await walk(playerSchemDir(uuid), "", 0);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/** 파일/폴더 이동(rename). 두 경로 모두 검증된 값이어야 하고 루트 내부. 대상 부모 자동 생성. 성공 시 true. */
export async function moveSchemPath(uuid: string, srcRel: string, destRel: string): Promise<boolean> {
  const srcAbs = resolveSchemAbs(uuid, srcRel);
  const destAbs = resolveSchemAbs(uuid, destRel);
  if (!srcAbs || !destAbs) return false;
  try {
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.rename(srcAbs, destAbs);
    return true;
  } catch {
    return false;
  }
}

export { SCHEMATICS_ROOT };

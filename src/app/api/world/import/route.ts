import { NextResponse } from "next/server";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionFull } from "@/lib/session";
import { formatBytes } from "@/lib/worldQuota";
import { getQuotaUsage } from "@/lib/worldQuotaEnforcement";
import { importWorld } from "@/app/actions/worlds";
import { UPLOAD_CHUNK_SIZE } from "@/lib/uploadChunk";
import { IMPORT_PARTS_DIR, MAX_CONCURRENT_UPLOADS, partPath, countOwnerParts, sweepImportParts } from "@/lib/importParts";
import { openUploadSession, type ThrottleGate } from "@/lib/uploadThrottle";
import { qosWeight } from "@/lib/qosPolicy";
import { uploadAllocator } from "@/lib/qosUpload";

export const runtime = "nodejs";

// 절대 상한(쿼터와 별개로 비정상 업로드 차단). 2GB.
const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

// 수신 스트림을 디스크로 흘려보낸다(백프레셔 유지). Node 의 pipeline 이 백프레셔·에러 전파·스트림 정리
// (모든 실패 경로에서 fd 누수 방지)를 모두 보장한다. 중간 Transform(meter)이 세 가지를 담당:
//   (1) 누적 바이트가 limit 을 넘으면 즉시 overflowError 로 중단(→ pipeline 이 전 스트림 destroy·reject),
//   (2) gate 가 있으면 각 데이터 청크를 통과시키기 전 토큰을 소비(속도 제한). gate 콜백을 미룰수록
//       pipeline 이 소스 소비를 늦춰 백프레셔가 cloudflared 까지 전파 → 서버 회선이 포화되지 않는다.
//   (3) tick 이 있으면 데이터 진행마다 호출 — QoS 할당기 세션 생존 신고(느린 전송이 TTL 로 퇴출되지 않게).
// ⚠ pipeline 은 ws 가 완전히 끝난(finish) 뒤에야 resolve 하므로, 반환 바이트 수 = 실제 디스크 기록 바이트다.
//   (직접 짠 event 루프에서 마지막 스로틀 write 가 ws.end 이후로 밀려 조용히 유실되던 버그를 원천 차단.)
async function streamToDisk(
  rs: Readable,
  ws: ReturnType<typeof createWriteStream>,
  limit: number,
  overflowError: string,
  gate: ThrottleGate | null,
  tick?: () => void
): Promise<number> {
  let written = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      if (written > limit) {
        cb(new Error(overflowError));
        return;
      }
      tick?.();
      if (!gate) {
        cb(null, chunk);
        return;
      }
      gate(chunk.length).then(() => cb(null, chunk), (e: unknown) => cb(e instanceof Error ? e : new Error(String(e))));
    },
  });
  await pipeline(rs, meter, ws);
  return written;
}

// ZIP 매직바이트(PK) 확인 — 월드맵이 아닌 파일(이미지·문서 등)을 조기 거부. level.dat 최종 검증은 플러그인이 수행.
async function isZipFile(p: string): Promise<boolean> {
  try {
    const fh = await fs.open(p, "r");
    const head = Buffer.alloc(2);
    await fh.read(head, 0, 2, 0);
    await fh.close();
    return head[0] === 0x50 && head[1] === 0x4b; // "PK"
  } catch {
    return true; // 검사 실패 시 통과시켜 플러그인이 최종 판단
  }
}

// (owner, uploadId) 단위 직렬화 — 같은 업로드의 조각/재시도가 서로 겹쳐 조각 파일에서 경쟁하지 않도록 한다.
// 단일 노드 프로세스(자체호스팅 단일 인스턴스)라 인프로세스 체인으로 충분하다. 다른 uploadId 는 다른 키 → 병렬.
const uploadChains = new Map<string, Promise<unknown>>();
function serializeUpload<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = uploadChains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn); // 선행 요청이 끝난 뒤 실행(선행의 성공/실패 무시)
  const guard = run.then(() => {}, () => {}); // 절대 reject 하지 않는 꼬리
  uploadChains.set(key, guard);
  void guard.then(() => {
    if (uploadChains.get(key) === guard) uploadChains.delete(key); // 마지막이면 맵에서 제거(무한 성장 방지)
  });
  return run;
}

// 월드 .zip 업로드(월드 삽입).
//   • 단일샷:  POST /api/world/import?name=&icon=            body: zip 전체(≤ 80MB)  → 디스크로 스트리밍
//   • 청크:    POST /api/world/import?name=&icon=&uploadId=&chunkIndex=&chunkCount=&chunkStart=&totalSize=
//              body: zip 조각(정확히 CHUNK 크기)  → 유저별 조각파일에 위치지정 기록, 마지막 조각에서 조립·삽입
// 대용량(>80MB)은 Cloudflare Tunnel 요청본문 한도(100MB)에 걸려 커넥션이 리셋되므로 클라이언트가 조각내 보낸다.
// QoS(qosUpload): 업로드 시작은 전역 admission 을 거치고, 중간 청크 응답마다 rateBps(이 세션의 현재 몫)를
// 내려보내 클라이언트 케이던스가 실시간 재배분을 따르게 한다(혼자면 총 대역 전체, 혼잡 시 역할 가중 1/n).
export async function POST(request: Request) {
  // ---- 공통 인증/게이트 ----
  const full = verifySessionFull((await cookies()).get("session")?.value);
  if (!full) return json({ success: false, error: "로그인이 필요합니다." }, 401);
  const session = full.name;
  const profile = await prisma.profile.findUnique({ where: { creator_name: session.toLowerCase() } });
  if (!profile) return json({ success: false, error: "프로필을 찾을 수 없습니다." }, 403);
  // token_version 대조 — 비밀번호 변경/제재로 무효화된 세션 거부(갤러리 라우트와 동일 기준).
  if (profile.token_version !== full.version) return json({ success: false, error: "세션이 만료되었습니다. 다시 로그인해 주세요." }, 401);
  if (profile.world_quota_state === "locked") {
    return json({ success: false, error: "클라우드 용량 초과로 잠겨 있습니다. 월드를 삭제해 용량을 확보하세요." }, 423);
  }

  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();
  const icon = url.searchParams.get("icon") || undefined;
  if (!name) return json({ success: false, error: "월드 이름이 필요합니다." }, 400);

  // 청크 업로드(대용량, CF 100MB 본문 한도 우회) — uploadId 가 있으면 조각 조립 경로.
  const uploadId = url.searchParams.get("uploadId");
  if (uploadId) return handleChunk(request, url, profile.id, qosWeight(profile.role), name, icon, uploadId);

  // ---- 단일샷 업로드(소용량, raw body 를 디스크로 스트리밍) ----
  if (!request.body) return json({ success: false, error: "업로드 파일이 없습니다." }, 400);
  // QoS 동적 할당 세션(전역 admission + 분모 등록) — 단일샷은 요청 본문이 이미 송신 중이라 rateBps
  // 피드백은 못 받지만, 등록만으로 동시 청크 업로더들의 몫 계산이 정확해진다(전송 중 tick 으로 생존 신고).
  const alloc = uploadAllocator();
  const allocKey = randomUUID();
  const weight = qosWeight(profile.role);
  if (alloc && !alloc.tryAdmit(profile.id, allocKey, weight)) {
    return json({ success: false, error: "지금 업로드가 몰려 있습니다. 잠시 후 다시 시도해 주세요." }, 429);
  }
  let stagingPath: string | null = null;
  try {
    // 남은 쿼터 = 공동 풀(월드 size_bytes 합 + 스키매틱, 비활성 포함). admin = 무제한(null).
    const { usedBytes: used, totalBytes } = await getQuotaUsage(profile.id);
    const remaining = totalBytes === null ? Number.POSITIVE_INFINITY : Math.max(0, totalBytes - used);
    const cap = Math.min(MAX_IMPORT_BYTES, remaining);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength) {
      if (totalBytes !== null && contentLength > totalBytes) {
        return json({ success: false, error: `이 파일(${formatBytes(contentLength)})이 회원님의 클라우드 총 용량(${formatBytes(totalBytes)})보다 큽니다.` }, 413);
      }
      if (contentLength > MAX_IMPORT_BYTES) {
        return json({ success: false, error: `업로드 크기 상한(${formatBytes(MAX_IMPORT_BYTES)})을 초과합니다.` }, 413);
      }
      if (contentLength > remaining) {
        return json({ success: false, error: `클라우드 용량이 부족합니다 (${formatBytes(used)} / ${formatBytes(totalBytes as number)} 사용 중, 월드와 공동). 월드나 스키매틱을 정리하세요.` }, 413);
      }
    }

    const stagingDir = path.join(process.cwd(), "world-imports");
    await fs.mkdir(stagingDir, { recursive: true });
    stagingPath = path.join(stagingDir, `${randomUUID()}.zip`);

    const nodeStream = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
    const ws = createWriteStream(stagingPath);
    // 수신 속도 제한(공평 큐잉 세션) — cloudflared 가 회선을 포화시켜 MC 서버를 끊지 않도록 백프레셔로 소비.
    // 동시 업로드끼리 총합(env) 안에서 균등 배분. 스트림 종료 시(성공/실패) end() 로 지분 반환.
    const up = openUploadSession(weight, profile.id);
    let written: number;
    try {
      written = await streamToDisk(
        nodeStream, ws, cap, "QUOTA",
        up ? up.gate : null,
        alloc ? () => alloc.touch(profile.id, allocKey, weight) : undefined
      );
    } finally {
      up?.end();
    }

    if (!(await isZipFile(stagingPath))) {
      return json({ success: false, error: "올바른 .zip 파일이 아닙니다. 월드 폴더를 압축한 .zip 을 올려주세요." }, 400);
    }

    // importWorld 가 스테이징 파일을 정리(성공/실패 무관)하므로 이후 finally 에서 중복 정리 안 함.
    const consumedPath = stagingPath;
    stagingPath = null;
    const res = await importWorld(name, icon, consumedPath, written);
    return json(res, res.success ? 200 : 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "QUOTA") return json({ success: false, error: "클라우드 용량을 초과합니다." }, 413);
    return json({ success: false, error: `업로드 실패: ${msg}` }, 500);
  } finally {
    alloc?.release(profile.id, allocKey); // QoS 지분 즉시 반환(성공/실패 무관)
    if (stagingPath) await fs.unlink(stagingPath).catch(() => {});
  }
}

// 청크 업로드 진입 — 파라미터 검증(순수) 후 (owner, uploadId) 직렬화 하에 조각을 처리한다.
async function handleChunk(
  request: Request,
  url: URL,
  ownerId: string,
  weight: number,
  name: string,
  icon: string | undefined,
  uploadId: string
) {
  if (!UUID_RE.test(uploadId)) return json({ success: false, error: "잘못된 업로드 식별자." }, 400);

  const chunkIndex = Number(url.searchParams.get("chunkIndex"));
  const chunkCount = Number(url.searchParams.get("chunkCount"));
  const chunkStart = Number(url.searchParams.get("chunkStart"));
  const totalSize = Number(url.searchParams.get("totalSize"));
  if (
    ![chunkIndex, chunkCount, chunkStart, totalSize].every(Number.isInteger) ||
    chunkCount < 1 ||
    chunkIndex < 0 ||
    chunkIndex >= chunkCount ||
    chunkStart < 0 ||
    totalSize <= 0
  ) {
    return json({ success: false, error: "잘못된 청크 파라미터." }, 400);
  }
  if (totalSize > MAX_IMPORT_BYTES) {
    return json({ success: false, error: `업로드 크기 상한(${formatBytes(MAX_IMPORT_BYTES)})을 초과합니다.` }, 413);
  }

  // 오프셋을 청킹 규약에 고정 — 임의 chunkStart 로 파일을 희소/거대하게 만드는 공격(zero-fill DoS) 차단.
  const expectedCount = Math.ceil(totalSize / UPLOAD_CHUNK_SIZE);
  const expectedStart = chunkIndex * UPLOAD_CHUNK_SIZE;
  const expectedLen = Math.min(UPLOAD_CHUNK_SIZE, totalSize - expectedStart);
  if (chunkCount !== expectedCount || chunkStart !== expectedStart || expectedLen <= 0) {
    return json({ success: false, error: "청크 정렬이 올바르지 않습니다. 처음부터 다시 시도해 주세요." }, 400);
  }

  const file = partPath(ownerId, uploadId);
  const isLast = chunkIndex === chunkCount - 1;
  return serializeUpload(file, () =>
    processChunk(request, { ownerId, weight, name, icon, file, uploadId, chunkIndex, chunkStart, totalSize, expectedLen, isLast })
  );
}

type ChunkCtx = {
  ownerId: string;
  weight: number; // QoS 배분 가중치(qosWeight — user 1 / creator+ 2)
  name: string;
  icon: string | undefined;
  file: string;
  uploadId: string;
  chunkIndex: number;
  chunkStart: number;
  totalSize: number;
  expectedLen: number;
  isLast: boolean;
};

// 예기치 못한 예외도 항상 JSON 응답으로 — 직렬화 체인에 unhandled rejection 이 새지 않도록 감싼다.
async function processChunk(request: Request, ctx: ChunkCtx) {
  try {
    return await runChunk(request, ctx);
  } catch (e) {
    return json({ success: false, error: `업로드 실패: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
}

async function runChunk(request: Request, ctx: ChunkCtx) {
  const { ownerId, weight, name, icon, file, uploadId, chunkIndex, chunkStart, totalSize, expectedLen, isLast } = ctx;
  const alloc = uploadAllocator(); // QoS 동적 할당기(null=비활성)

  // (A) 마지막 조각 재시도 멱등 — 이 uploadId 로 이미 삽입된 월드가 있으면 재삽입 없이 그 결과를 반환한다(중복/오탐 방지).
  //     DB(import_key) 를 진실원본으로 사용(파일 마커보다 견고 — 마커 쓰기 실패·크래시 창에 영향받지 않음).
  if (isLast) {
    const done = await prisma.minecraftWorld.findFirst({ where: { import_key: uploadId, owner_id: ownerId } });
    // 완료된(active/archived) 월드만 멱등 반환. provisioning(크래시 잔여)이면 아래 finalize 가 정리 후 재삽입.
    if (done && done.status !== "provisioning") {
      alloc?.release(ownerId, uploadId); // 이미 끝난 업로드 — 지분 반환
      return json({ success: true, worldId: done.id, name: done.name }, 200);
    }
  }

  // (B) 첫 조각: 쿼터 사전검사 + 동시 업로드 상한 + 조각파일 새로 시작.
  if (chunkIndex === 0) {
    const { usedBytes: used, totalBytes } = await getQuotaUsage(ownerId);
    const remaining = totalBytes === null ? Number.POSITIVE_INFINITY : Math.max(0, totalBytes - used);
    if (totalBytes !== null && totalSize > totalBytes) {
      alloc?.release(ownerId, uploadId); // 재시도로 등록돼 있었을 수 있는 지분 반환(치명 거부)
      return json({ success: false, error: `이 파일(${formatBytes(totalSize)})이 회원님의 클라우드 총 용량(${formatBytes(totalBytes)})보다 큽니다.` }, 413);
    }
    if (totalSize > remaining) {
      alloc?.release(ownerId, uploadId);
      return json({ success: false, error: `클라우드 용량이 부족합니다 (${formatBytes(used)} / ${formatBytes(totalBytes as number)} 사용 중, 월드와 공동). 월드나 스키매틱을 정리하세요.` }, 413);
    }
    await fs.mkdir(IMPORT_PARTS_DIR, { recursive: true });
    await sweepImportParts(ownerId).catch(() => {}); // 이 유저의 버려진 조각 정리(2h+)
    // 동시 업로드 상한 — 단, 이 업로드의 조각 파일이 이미 있으면(첫 조각 재시도) 진행 중인 것이므로 카운트에서 제외.
    const resuming = await fs.stat(file).then(() => true).catch(() => false);
    if (!resuming && (await countOwnerParts(ownerId)) >= MAX_CONCURRENT_UPLOADS) {
      return json({ success: false, error: "진행 중인 업로드가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429);
    }
    // QoS 전역 admission — 동시 세션이 상한(ceil(TOTAL/FLOOR))에 차면 신규 시작 거부(하한 속도 보장 유지).
    // 재개(resuming)·재시도는 아래 touch 가 항상 받아준다(진행 중 전송은 혼잡해도 끊지 않는다).
    if (!resuming && alloc && !alloc.tryAdmit(ownerId, uploadId, weight)) {
      return json({ success: false, error: "지금 업로드가 몰려 있습니다. 잠시 후 다시 시도해 주세요." }, 429);
    }
    await fs.writeFile(file, ""); // 새 세션/재시도 — 조각 파일 초기화(truncate)
  } else if (!(await fs.stat(file).then(() => true).catch(() => false))) {
    // 첫 조각이 아닌데 조각파일이 없음 → 서버 재시작/세션 유실. 처음부터 다시 요구.
    alloc?.release(ownerId, uploadId);
    return json({ success: false, error: "업로드 세션이 만료되었습니다. 처음부터 다시 시도해 주세요." }, 409);
  }

  // QoS 세션 생존 신고/재등록 — 진행 중 청크(2번째~)·TTL 퇴출 후 복귀·서버 재시작 후 이어하기 모두 여기서 흡수.
  alloc?.touch(ownerId, uploadId, weight);

  if (!request.body) {
    alloc?.release(ownerId, uploadId); // 치명 4xx — 슬롯이 TTL 까지 남지 않도록 즉시 반환
    return json({ success: false, error: "빈 청크." }, 400);
  }

  // (C) 위치지정 스트리밍 기록 — 정확히 expectedLen 바이트만 허용(초과분은 즉시 끊음). 버퍼링 없음.
  // 수신 속도 제한(전역 게이트)으로 cloudflared 가 서버 회선을 포화시켜 MC 서버를 끊지 않도록 백프레셔 유지.
  const nodeStream = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
  const ws = createWriteStream(file, { flags: "r+", start: chunkStart });
  const up = openUploadSession(weight, ownerId); // 수신 페이서(기본 off) — 유저 단위 공평 큐잉
  let wrote = 0;
  try {
    wrote = await streamToDisk(
      nodeStream, ws, expectedLen, "CHUNK_OVERFLOW",
      up ? up.gate : null,
      alloc ? () => alloc.touch(ownerId, uploadId, weight) : undefined // 수신 진행 = 생존 신고(TTL 방지)
    );
  } catch (e) {
    // 조각 실패 시 조립 파일은 보존(멱등 재시도로 같은 오프셋 덮어쓰기). 첫 조각은 어차피 빈 파일이라 무해.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "CHUNK_OVERFLOW") {
      alloc?.release(ownerId, uploadId); // 치명 실패(재시도 무의미) — 지분 반환
      return json({ success: false, error: "청크 크기가 규약과 다릅니다. 처음부터 다시 시도해 주세요." }, 400);
    }
    // 5xx → 클라 재시도 예정 — QoS 세션 유지(재시도가 이어받고, 안 오면 TTL 이 회수)
    return json({ success: false, error: "청크 전송이 중단되었습니다. 다시 시도해 주세요." }, 503);
  } finally {
    up?.end(); // 성공/실패 무관 지분 반환(유령 세션 방지)
  }

  // 전송 중 잘려 짧게 기록됐으면(희소 구멍 방지) 재시도 유도 — 파일 보존.
  if (wrote !== expectedLen) {
    return json({ success: false, error: "청크가 완전히 전송되지 않았습니다. 다시 시도해 주세요." }, 503);
  }

  // 마지막 조각이 아니면 여기서 끝(다음 조각 대기). rateBps = 이 세션의 현재 몫 — 클라 케이던스가
  // 다음 청크부터 이 속도로 송신한다(동적 재배분 피드백, 혼자면 총 대역 전체).
  if (!isLast) {
    return json(
      alloc
        ? { success: true, received: chunkIndex, rateBps: alloc.rateFor(ownerId, uploadId, weight) }
        : { success: true, received: chunkIndex },
      200
    );
  }

  // (D) 마지막 조각: 조립 검증 → zip 검사 → importWorld → 완료 마커.
  // 네트워크 전송은 끝났으므로 QoS 지분을 먼저 반환 — finalize(압축해제 등) 동안 다른 업로더가 몫을 회수.
  // finalize 실패 후 재시도가 오면 위 touch 가 재등록한다.
  alloc?.release(ownerId, uploadId);
  const st = await fs.stat(file).catch(() => null);
  if (!st || st.size !== totalSize) {
    return json({ success: false, error: "업로드가 완전하지 않습니다(누락된 조각). 다시 업로드해 주세요." }, 400);
  }
  if (!(await isZipFile(file))) {
    await fs.unlink(file).catch(() => {});
    return json({ success: false, error: "올바른 .zip 파일이 아닙니다. 월드 폴더를 압축한 .zip 을 올려주세요." }, 400);
  }
  // importKey=uploadId 로 멱등 삽입(재시도해도 중복 월드 안 생김). keepStaging: 실패 시 조각 파일 보존(재시도 재삽입용).
  const res = await importWorld(name, icon, file, totalSize, { keepStaging: true, importKey: uploadId });
  // 성공: 조각 파일 정리(멱등성은 DB import_key 가 보장하므로 마커 불필요). 실패: 조각 보존(재시도 재삽입, 아니면 2h 뒤 스윕).
  if (res.success) await fs.unlink(file).catch(() => {});
  return json(res, res.success ? 200 : 400);
}

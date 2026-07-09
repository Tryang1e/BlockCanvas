import { promises as fs } from "fs";
import path from "path";

// 월드 삽입(청크 업로드)의 미완성 조각 파일 저장소. CF 100MB 요청본문 한도를 우회하려고
// 클라이언트가 파일을 80MB 조각으로 잘라 순차 전송 → 유저별 조각 파일에 위치지정 기록으로 조립한다.
// 마지막 조각에서 importWorld 로 넘어가며, importWorld 가 조각 파일을 정리한다(unlink).
export const IMPORT_PARTS_DIR = path.join(process.cwd(), "world-imports", "parts");

// 미완료 업로드로 남은 조각의 정리 유예. 활성 업로드는 조각(최대 80MB)마다 mtime 이 갱신되므로,
// 이보다 오래 "쓰기 없이" 방치된 조각은 버려진(실패/중단) 것으로 보고 스윕한다. 실패 업로드가 동시상한을
// 오래 점유하지 않도록 30분으로 짧게 둔다(활성 업로드는 30분 넘게 무통신일 일이 없어 오삭제 없음).
const STALE_MS = 30 * 60 * 1000; // 30분

// 동시 진행 가능한 업로드(조각 파일) 수 상한 — 스테이징 디스크 폭주 방지(유저별).
export const MAX_CONCURRENT_UPLOADS = 3;

// 조각 파일 경로. ownerId=세션 검증된 Profile.id, uploadId=라우트에서 uuid 형식 검증.
// 유저 스코프 접두사(ownerId__)로 남의 조각을 건드릴 수 없다(경로 조작 방지는 uploadId uuid 검증이 담당).
export function partPath(ownerId: string, uploadId: string): string {
  return path.join(IMPORT_PARTS_DIR, `${ownerId}__${uploadId}.zip`);
}

// 이 유저의 현재 진행 중(조각) 업로드 개수 — 동시 업로드 상한 검사용(.zip 만 카운트).
export async function countOwnerParts(ownerId: string): Promise<number> {
  const entries = await fs.readdir(IMPORT_PARTS_DIR).catch(() => [] as string[]);
  return entries.filter((f) => f.startsWith(`${ownerId}__`) && f.endsWith(".zip")).length;
}

// 버려진(미완료) 조각·마커 파일 정리. ownerId 지정 시 해당 유저 것만(업로드 시작 시 자가 청소),
// 미지정 시 전체(스케줄러 스윕). STALE_MS 넘게 방치된 것만 삭제한다.
export async function sweepImportParts(ownerId?: string): Promise<{ partsPurged: number }> {
  let partsPurged = 0;
  try {
    const entries = await fs.readdir(IMPORT_PARTS_DIR).catch(() => [] as string[]);
    const now = Date.now();
    await Promise.all(
      entries.map(async (f) => {
        if (!f.endsWith(".zip")) return;
        if (ownerId && !f.startsWith(`${ownerId}__`)) return;
        const p = path.join(IMPORT_PARTS_DIR, f);
        const st = await fs.stat(p).catch(() => null);
        if (st && now - st.mtimeMs > STALE_MS) {
          await fs.unlink(p).catch(() => {});
          partsPurged++;
        }
      })
    );
  } catch {
    /* best-effort */
  }
  return { partsPurged };
}

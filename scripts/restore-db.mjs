// BlockCanvas DB 복원 스크립트
// 백업(.db.br)을 Brotli 해제하여 SQLite .db 파일로 복원한다.
// 안전을 위해 라이브 dev.db 는 절대 자동으로 덮어쓰지 않고, 별도 파일로 풀어준다.
//
// 사용법:
//   node scripts/restore-db.mjs                  # 최신 백업 → dev.restored.db
//   node scripts/restore-db.mjs latest           # 동일
//   node scripts/restore-db.mjs dev-YYYYMMDD-HHmmss.db.br [출력경로]
//
// 실제 적용 절차:
//   1) 서버 중지 (Ctrl+C)
//   2) 현재 dev.db 를 안전하게 보관 (예: dev.db → dev.db.bak)
//   3) dev.restored.db 를 dev.db 로 교체
//   4) 서버 시작 (npm run start)

import { brotliDecompressSync } from 'node:zlib'
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BACKUP_DIR = process.env.BC_BACKUP_DIR || path.join(ROOT, 'backups', 'db')

const PREFIX = 'dev-'
const EXT = '.db.br'

const arg = process.argv[2]
const outArg = process.argv[3]

async function pickLatest() {
  const all = (await readdir(BACKUP_DIR))
    .filter((f) => f.startsWith(PREFIX) && f.endsWith(EXT))
    .sort()
  if (all.length === 0) throw new Error(`백업이 없습니다: ${BACKUP_DIR}`)
  return all[all.length - 1]
}

async function main() {
  const name = !arg || arg === 'latest' ? await pickLatest() : arg
  const inPath = path.isAbsolute(name) ? name : path.join(BACKUP_DIR, name)
  const outPath = outArg
    ? (path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg))
    : path.join(ROOT, 'dev.restored.db')

  const compressed = await readFile(inPath)
  const db = brotliDecompressSync(compressed)
  await writeFile(outPath, db)

  const inSize = (await stat(inPath)).size
  console.log(`복원 완료:`)
  console.log(`  백업:   ${inPath} (${(inSize / 1024).toFixed(1)} KB)`)
  console.log(`  출력:   ${outPath} (${(db.length / 1024).toFixed(1)} KB)`)
  console.log(``)
  console.log(`적용하려면: 서버 중지 → 현재 dev.db 백업 → 위 파일을 dev.db 로 교체 → 서버 시작`)
}

main().catch((e) => {
  console.error(`복원 실패: ${e?.message || e}`)
  process.exit(1)
})

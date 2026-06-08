// BlockCanvas DB 백업 스크립트
// 1) VACUUM INTO 로 라이브 DB의 일관된(transaction-consistent) 압축 스냅샷 생성 — 서버 동시 사용 안전
// 2) Node 내장 zlib Brotli(품질 11)로 추가 압축 → .db.br (외부 도구·추가 의존성 0)
// 3) 보존 개수 초과 시 오래된 백업 자동 삭제(용량 최소화)
//
// 환경변수로 조정 가능:
//   BC_DB_PATH, BC_BACKUP_DIR, BC_BACKUP_LOG, BC_BACKUP_RETENTION, BC_BROTLI_QUALITY

import { createClient } from '@libsql/client'
import { brotliCompressSync, constants as Z } from 'node:zlib'
import { readFile, writeFile, rm, mkdir, readdir, stat, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const DB_PATH = process.env.BC_DB_PATH || path.join(ROOT, 'dev.db')
const BACKUP_DIR = process.env.BC_BACKUP_DIR || path.join(ROOT, 'backups', 'db')
const LOG_FILE = process.env.BC_BACKUP_LOG || path.join(ROOT, 'backups', 'backup.log')
const RETENTION = Math.max(1, parseInt(process.env.BC_BACKUP_RETENTION || '90', 10)) // 30일 × 3회/일
const QUALITY = Math.min(11, Math.max(0, parseInt(process.env.BC_BROTLI_QUALITY || '11', 10)))

const PREFIX = 'dev-'
const EXT = '.db.br'

function stamp(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

async function log(line) {
  const msg = `${new Date().toISOString().replace('T', ' ').slice(0, 19)} | ${line}`
  console.log(msg)
  try { await appendFile(LOG_FILE, msg + '\n', 'utf8') } catch {}
}

async function main() {
  const ts = stamp()
  await mkdir(BACKUP_DIR, { recursive: true })

  // 임시 스냅샷(프루닝 glob `dev-*.db.br` 와 겹치지 않는 이름)
  const snapPath = path.join(BACKUP_DIR, `.snap-${ts}.db`)
  await rm(snapPath, { force: true }) // VACUUM INTO 는 대상이 이미 있으면 실패하므로 보장

  const srcSize = (await stat(DB_PATH)).size

  // 1) 일관된 압축 스냅샷
  const client = createClient({ url: 'file:' + DB_PATH })
  try {
    await client.execute(`VACUUM INTO '${snapPath.replace(/\\/g, '/')}'`)
  } finally {
    await client.close?.()
  }
  const snapBuf = await readFile(snapPath)
  await rm(snapPath, { force: true })

  // 2) Brotli 추가 압축
  const outBuf = brotliCompressSync(snapBuf, {
    params: {
      [Z.BROTLI_PARAM_QUALITY]: QUALITY,
      [Z.BROTLI_PARAM_LGWIN]: 24,
      [Z.BROTLI_PARAM_SIZE_HINT]: snapBuf.length,
    },
  })
  const outName = `${PREFIX}${ts}${EXT}`
  await writeFile(path.join(BACKUP_DIR, outName), outBuf)

  const ratio = srcSize > 0 ? (srcSize / outBuf.length) : 0

  // 3) 보존 개수 초과분 삭제 (오래된 것부터)
  const all = (await readdir(BACKUP_DIR))
    .filter((f) => f.startsWith(PREFIX) && f.endsWith(EXT))
    .sort() // 타임스탬프 이름이라 사전식 정렬 = 시간순
  let removed = 0
  if (all.length > RETENTION) {
    for (const f of all.slice(0, all.length - RETENTION)) {
      await rm(path.join(BACKUP_DIR, f), { force: true })
      removed++
    }
  }

  // 디렉터리 총 용량 집계
  const kept = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith(PREFIX) && f.endsWith(EXT))
  let totalBytes = 0
  for (const f of kept) totalBytes += (await stat(path.join(BACKUP_DIR, f))).size

  await log(
    `${outName} | src=${fmtBytes(srcSize)} snap=${fmtBytes(snapBuf.length)} br=${fmtBytes(outBuf.length)} ` +
    `ratio=${ratio.toFixed(1)}x | kept=${kept.length} pruned=${removed} totalStore=${fmtBytes(totalBytes)}`
  )
}

main().catch(async (e) => {
  await log(`BACKUP FAILED: ${e?.stack || e?.message || e}`)
  process.exit(1)
})

// public/uploads 고아 파일 정리: DB 어디서도 참조하지 않는 파일을 삭제한다.
// 안전장치:
//   - 최근 업로드(기본 24h 이내)는 보호 → 저장 안 한 초안/방금 올린 파일 보호
//   - 기본은 dry-run(보여주기만). 실제 삭제는 --apply 필요
//   - public/uploads 하위 파일만 삭제(경로 격리)
//
// 사용:
//   node scripts/clean-orphan-uploads.mjs                 # dry-run
//   node scripts/clean-orphan-uploads.mjs --apply         # 실제 삭제
//   node scripts/clean-orphan-uploads.mjs --apply --min-age-hours 48

import { createClient } from '@libsql/client'
import { readdir, stat, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DB_PATH = process.env.BC_DB_PATH || path.join(ROOT, 'dev.db')
const UPLOADS = path.join(ROOT, 'public', 'uploads')

const APPLY = process.argv.includes('--apply')
const ageArgIdx = process.argv.indexOf('--min-age-hours')
const MIN_AGE_H = ageArgIdx >= 0 ? Math.max(0, parseFloat(process.argv[ageArgIdx + 1] || '24')) : 24
const MIN_AGE_MS = MIN_AGE_H * 3600 * 1000

const fmt = (n) => n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(2)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`

async function walk(dir, base, out) {
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, base, out)
    else {
      const st = await stat(full)
      const rel = path.relative(base, full).split(path.sep).join('/')
      out.set(rel.toLowerCase(), { full, rel, size: st.size, mtime: st.mtimeMs })
    }
  }
}

async function main() {
  const disk = new Map()
  await walk(UPLOADS, UPLOADS, disk)

  const client = createClient({ url: 'file:' + DB_PATH })
  const tables = (await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  )).rows.map((r) => r.name)

  const referenced = new Set()
  const re = /uploads\/([A-Za-z0-9._\-/]+\.[A-Za-z0-9]{1,5})/g
  for (const t of tables) {
    let rows
    try { rows = (await client.execute(`SELECT * FROM "${t}"`)).rows } catch { continue }
    for (const row of rows) {
      for (const v of Object.values(row)) {
        if (typeof v !== 'string') continue
        re.lastIndex = 0
        let m
        while ((m = re.exec(v)) !== null) referenced.add(m[1].toLowerCase())
      }
    }
  }
  await client.close?.()

  const now = Date.now()
  const toDelete = []
  let protectedRecent = 0
  let protectedRecentBytes = 0
  for (const [key, info] of disk) {
    if (referenced.has(key)) continue // 사용중
    if (now - info.mtime < MIN_AGE_MS) { protectedRecent++; protectedRecentBytes += info.size; continue } // 최근 보호
    toDelete.push(info)
  }

  let freed = 0
  for (const f of toDelete) freed += f.size

  console.log(`=== 고아 정리 ${APPLY ? '(실제 삭제)' : '(DRY-RUN: 미삭제)'} ===`)
  console.log(`디스크 파일: ${disk.size}개 | DB 참조: ${referenced.size}개`)
  console.log(`보호(최근 ${MIN_AGE_H}h 이내): ${protectedRecent}개, ${fmt(protectedRecentBytes)}`)
  console.log(`삭제 대상 고아: ${toDelete.length}개, ${fmt(freed)}`)

  if (!APPLY) {
    console.log(`\n실제로 지우려면: node scripts/clean-orphan-uploads.mjs --apply`)
    return
  }

  let done = 0
  for (const f of toDelete) {
    // 경로 격리: 반드시 uploads 하위만 삭제
    const resolved = path.resolve(f.full)
    if (resolved !== UPLOADS && !resolved.startsWith(UPLOADS + path.sep)) continue
    await rm(resolved, { force: true })
    done++
  }
  console.log(`\n삭제 완료: ${done}개, ${fmt(freed)} 확보`)
}

main().catch((e) => { console.error('정리 실패:', e?.message || e); process.exit(1) })

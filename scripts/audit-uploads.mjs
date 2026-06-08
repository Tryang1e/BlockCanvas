// public/uploads 감사: DB가 참조하는 파일 vs 디스크의 실제 파일 대조 (읽기 전용)
// - 고아(orphan): 디스크엔 있는데 DB 어디서도 참조 안 함 (삭제된 계정/게시글/영상의 잔존)
// - 끊김(broken): DB가 가리키는데 디스크에 파일이 없음 (이미 사라진 이미지)
//
// 사용: node scripts/audit-uploads.mjs [--list]   (--list: 고아 파일 목록도 출력)

import { createClient } from '@libsql/client'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DB_PATH = process.env.BC_DB_PATH || path.join(ROOT, 'dev.db')
const UPLOADS = path.join(ROOT, 'public', 'uploads')
const LIST = process.argv.includes('--list')

const fmt = (n) => n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(2)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`

// 디스크의 모든 업로드 파일을 uploads 루트 기준 상대경로(posix, 소문자)로 수집
async function walk(dir, base, out) {
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, base, out)
    else {
      const rel = path.relative(base, full).split(path.sep).join('/')
      const sz = (await stat(full)).size
      out.set(rel.toLowerCase(), { rel, size: sz })
    }
  }
}

async function main() {
  const disk = new Map()
  await walk(UPLOADS, UPLOADS, disk)

  // DB의 모든 테이블/모든 문자열 셀에서 uploads 참조 추출 (HTML·JSON 임베드까지 전부 포착)
  const client = createClient({ url: 'file:' + DB_PATH })
  const tables = (await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  )).rows.map((r) => r.name)

  const referenced = new Set() // uploads 루트 기준 상대경로(소문자)
  const re = /uploads\/([A-Za-z0-9._\-/]+\.[A-Za-z0-9]{1,5})/g

  for (const t of tables) {
    let rows
    try { rows = (await client.execute(`SELECT * FROM "${t}"`)).rows } catch { continue }
    for (const row of rows) {
      for (const v of Object.values(row)) {
        if (typeof v !== 'string') continue
        let m
        re.lastIndex = 0
        while ((m = re.exec(v)) !== null) referenced.add(m[1].toLowerCase())
      }
    }
  }
  await client.close?.()

  // 대조
  let diskBytes = 0
  for (const { size } of disk.values()) diskBytes += size

  const orphans = []
  let orphanBytes = 0
  for (const [key, info] of disk) {
    if (!referenced.has(key)) { orphans.push(info); orphanBytes += info.size }
  }

  const broken = []
  for (const ref of referenced) {
    if (!disk.has(ref)) broken.push(ref)
  }

  const usedFiles = disk.size - orphans.length
  const usedBytes = diskBytes - orphanBytes

  console.log('=== public/uploads 감사 ===')
  console.log(`디스크 파일:        ${disk.size}개, ${fmt(diskBytes)}`)
  console.log(`DB 참조(고유):      ${referenced.size}개`)
  console.log(`-`.repeat(40))
  console.log(`✅ 사용중(참조됨):   ${usedFiles}개, ${fmt(usedBytes)}`)
  console.log(`🗑️  고아(미참조):     ${orphans.length}개, ${fmt(orphanBytes)}   ← 삭제된 계정/게시글/영상 잔존`)
  console.log(`⚠️  끊긴 참조(파일없음): ${broken.length}개   ← DB는 가리키나 파일 없음`)

  if (LIST && orphans.length) {
    console.log(`\n--- 고아 파일 (상위 50, 큰 순) ---`)
    orphans.sort((a, b) => b.size - a.size).slice(0, 50).forEach((o) => console.log(`  ${fmt(o.size).padStart(10)}  ${o.rel}`))
  }
  if (LIST && broken.length) {
    console.log(`\n--- 끊긴 참조 (상위 30) ---`)
    broken.slice(0, 30).forEach((b) => console.log(`  ${b}`))
  }
}

main().catch((e) => { console.error('감사 실패:', e?.message || e); process.exit(1) })

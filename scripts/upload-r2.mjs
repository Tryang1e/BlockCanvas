// BlockCanvas — 백업본 off-site 업로드 (Cloudflare R2, S3 호환 API)
// run-backup.ps1 에서 DB 백업/미디어 미러 이후 best-effort 로 호출된다.
// .env 의 R2_* 가 없으면 조용히 skip → 로컬 백업 파이프라인엔 전혀 영향 없음.
//
// 동작:
//   1) backups/db 의 최신 dev-*.db.br 1개를 R2 의 db/ 프리픽스로 업로드 (하루 1회로 스로틀)
//   2) 버킷 총 사용량 집계 → 임계(기본 8GiB = 무료 10GB의 80%) 이상이면 Discord 웹훅 알림 (12h 디바운스)
//
// .env (모두 선택; R2_* 가 다 있어야 업로드 수행):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_ENDPOINT                 (옵션; 없으면 https://<ACCOUNT_ID>.r2.cloudflarestorage.com)
//   R2_USAGE_ALERT_BYTES        (옵션; 기본 8*1024^3)
//   R2_UPLOAD_MIN_INTERVAL_HOURS(옵션; 기본 20 → 백업이 하루 3회여도 off-site 는 ~1회/일)
//   DISCORD_WEBHOOK_URL         (옵션; 임계 알림 채널)
//   BC_BACKUP_DIR, BC_BACKUP_LOG(옵션; backup-db.mjs 와 동일 기본값)

import 'dotenv/config'
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { readFile, readdir, appendFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const BACKUP_DIR = process.env.BC_BACKUP_DIR || path.join(ROOT, 'backups', 'db')
const LOG_FILE = process.env.BC_BACKUP_LOG || path.join(ROOT, 'backups', 'backup.log')
const STATE_FILE = path.join(ROOT, 'backups', '.r2-state.json')
// 월드 백업 zip(유저 빌드의 유일 사본이 될 수 있음)을 off-site 하는 소스 폴더 + 실행당 업로드 상한.
const WORLD_ZIP_DIR = process.env.BC_WORLD_ZIP_DIR || path.join(ROOT, 'backups', 'world-zips')
const MAX_WORLD_UPLOADS_PER_RUN = Math.max(0, parseInt(process.env.R2_WORLD_MAX_PER_RUN || '8', 10))

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
  R2_ENDPOINT, R2_USAGE_ALERT_BYTES, R2_UPLOAD_MIN_INTERVAL_HOURS, DISCORD_WEBHOOK_URL,
} = process.env

const ALERT_BYTES = Math.max(1, parseInt(R2_USAGE_ALERT_BYTES || String(8 * 1024 ** 3), 10))
const UPLOAD_MIN_MS = Math.max(0, parseFloat(R2_UPLOAD_MIN_INTERVAL_HOURS || '20')) * 60 * 60 * 1000
const ALERT_DEBOUNCE_MS = 12 * 60 * 60 * 1000

const PREFIX = 'dev-'
const EXT = '.db.br'

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

async function log(line) {
  const msg = `${new Date().toISOString().replace('T', ' ').slice(0, 19)} | [r2] ${line}`
  console.log(msg)
  try { await appendFile(LOG_FILE, msg + '\n', 'utf8') } catch {}
}

async function readState() { try { return JSON.parse(await readFile(STATE_FILE, 'utf8')) } catch { return {} } }
async function writeState(s) { try { await writeFile(STATE_FILE, JSON.stringify(s), 'utf8') } catch {} }

async function notifyDiscord(text) {
  if (!DISCORD_WEBHOOK_URL) return { ok: false, reason: 'DISCORD_WEBHOOK_URL 미설정(.env)' }
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    if (res.ok) return { ok: true }
    const body = await res.text().catch(() => '')
    return { ok: false, reason: `HTTP ${res.status} ${body.slice(0, 140)}` }
  } catch (e) {
    return { ok: false, reason: `fetch 오류: ${e?.message || e}` }
  }
}

// 월드 백업 zip off-site — backups/world-zips 의 *.zip 중 R2(worlds/ 프리픽스)에 아직 없는 것만 업로드한다.
// 월드는 아카이브 후 90일 퍼지로 로컬 유일 사본이 사라질 수 있어, DB 외 유일하게 off-site 가 필요한 유저 데이터.
async function uploadWorldZips(s3) {
  let names
  try {
    names = (await readdir(WORLD_ZIP_DIR)).filter((f) => f.endsWith('.zip')).sort()
  } catch {
    await log('world-zips 폴더 없음 → 월드 off-site skip')
    return
  }
  if (names.length === 0) return

  // R2 worlds/ 에 이미 있는 키 수집(중복 업로드 방지)
  const existing = new Set()
  let token
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: 'worlds/', ContinuationToken: token }))
    for (const o of out.Contents || []) existing.add(o.Key)
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)

  let uploaded = 0
  for (const name of names) {
    if (MAX_WORLD_UPLOADS_PER_RUN > 0 && uploaded >= MAX_WORLD_UPLOADS_PER_RUN) {
      await log(`월드 off-site: 이번 실행 상한(${MAX_WORLD_UPLOADS_PER_RUN}개) 도달 → 나머지는 다음 실행`)
      break
    }
    const key = `worlds/${name}`
    if (existing.has(key)) continue
    try {
      const body = await readFile(path.join(WORLD_ZIP_DIR, name))
      await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: 'application/zip' }))
      uploaded++
      await log(`uploaded ${key} (${fmtBytes(body.length)})`)
    } catch (e) {
      await log(`월드 zip 업로드 실패 ${name}: ${e?.message || e}`)
    }
  }
  if (uploaded > 0) await log(`월드 off-site: ${uploaded}개 신규 업로드`)
}

async function main() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    await log('R2 미설정(.env R2_*) → off-site 업로드 skip')
    return
  }

  const state = await readState()
  const now = Date.now()

  // 하루 1회 스로틀 (백업 자체는 8h마다지만 off-site 사본은 일 1회면 충분)
  if (state.lastUpload && now - state.lastUpload < UPLOAD_MIN_MS) {
    await log(`최근 업로드 후 ${UPLOAD_MIN_MS / 3600000}h 미경과 → 스로틀 skip`)
    return
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })

  // 1) 최신 백업본 업로드 (db/ 프리픽스 — 보존은 R2 Lifecycle 규칙으로 관리)
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith(PREFIX) && f.endsWith(EXT)).sort()
  const name = files.at(-1)
  if (!name) { await log('업로드할 .db.br 없음 → skip'); return }

  const body = await readFile(path.join(BACKUP_DIR, name))
  const key = `db/${name}`
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: body, ContentType: 'application/octet-stream',
  }))
  await log(`uploaded ${key} (${fmtBytes(body.length)})`)
  state.lastUpload = now

  // 1b) 월드 백업 zip off-site (worlds/ 프리픽스) — 신규분만. 실패는 로컬 백업에 영향 없음(main 이 exit 0).
  await uploadWorldZips(s3)

  // 2) 버킷 총 사용량 집계
  let total = 0, count = 0, token
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }))
    for (const o of out.Contents || []) { total += o.Size || 0; count++ }
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)
  await log(`usage ${fmtBytes(total)} / ${count} objects (alert ≥ ${fmtBytes(ALERT_BYTES)})`)

  // 3) 임계(80%) 초과 시 Discord 알림 — 12h 디바운스
  if (total >= ALERT_BYTES) {
    if (!state.lastAlert || now - state.lastAlert > ALERT_DEBOUNCE_MS) {
      const r = await notifyDiscord(
        `⚠️ **BlockCanvas R2 백업 저장공간 경고**\n현재 ${fmtBytes(total)} 사용 (임계 ${fmtBytes(ALERT_BYTES)} / 무료 10GB의 80% 도달).\n오래된 백업 정리(Lifecycle) 또는 용량 증설을 검토하세요.`
      )
      await log(`THRESHOLD reached → discord ${r.ok ? 'sent' : '미발송 (' + r.reason + ')'}`)
      if (r.ok) state.lastAlert = now // 실제 발송 성공 시에만 디바운스 기록(실패는 다음 실행에 재시도)
    } else {
      await log('THRESHOLD reached → 12h 디바운스(이미 알림 발송됨)')
    }
  }

  await writeState(state)
}

main().catch(async (e) => {
  // off-site 업로드 실패가 로컬 백업 작업 전체를 실패로 만들지 않도록 0 으로 종료
  await log(`UPLOAD FAILED: ${e?.stack || e?.message || e}`)
  process.exit(0)
})

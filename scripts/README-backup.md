# DB 백업 시스템

라이브 SQLite/libSQL DB(`dev.db`)를 **하루 3회(8시간 간격)** 자동 백업한다.
`VACUUM INTO`로 일관된 스냅샷을 만든 뒤 Node 내장 **Brotli(품질 11)**로 압축한다.
외부 도구·추가 의존성 없음(서버 동시 사용 안전).

## 구성 파일
- `scripts/backup-db.mjs` — DB 백업(스냅샷 → 압축 → 보존 정리 → 로깅)
- `scripts/run-backup.ps1` — 8h 백업 래퍼: **DB 백업 + 미디어 미러**(public/uploads → backups/uploads)
- `scripts/restore-db.mjs` — DB 복원(.db.br → .db 해제)
- `scripts/audit-uploads.mjs` — 업로드 감사(참조 vs 고아). `--list`로 목록.
- `scripts/clean-orphan-uploads.mjs` — 고아 삭제(`--apply`, 24h 보호, `--min-age-hours N`)
- `scripts/run-cleanup.ps1` — 일일 고아 정리 래퍼
- `scripts/upload-r2.mjs` — **off-site 업로드(Cloudflare R2)**: 최신 `.db.br`를 R2로 올리고, 사용량 80% 시 Discord 알림
- `backups/db/dev-*.db.br` — 압축 DB 백업본 (gitignored)
- `backups/uploads/` — 미디어 미러(라이브 public/uploads 와 동일, gitignored)
- `backups/backup.log`, `backups/cleanup.log` — 실행 로그

## 미디어(이미지/파일) 백업 & 고아 정리
- **미디어는 DB가 아니라 `public/uploads/`에 저장됨**(DB엔 경로 문자열만). 그래서 별도 백업 필요.
- 8h 백업 시 `robocopy /MIR`로 `public/uploads` → `backups/uploads` 미러(증분, **라이브 현재 상태 반영** = 삭제도 반영 → 용량 최소 유지). 이미지는 이미 압축된 바이너리라 압축 안 함.
- **고아 정리**: DB 어디서도 참조 안 하는 파일(삭제된 게시글/계정/영상 잔존)을 **매일 04:00** 자동 삭제. 최근 24h 업로드는 보호(미저장 초안 보호).
- ⚠️ `backups/uploads`는 **같은 디스크**라 디스크 고장 대비는 아님. 진짜 DR이면 `BC` 미러 대상을 외장/다른 드라이브로 옮길 것(아래 참고).

## 스케줄 (작업 2개)
- **"BlockCanvas DB Backup"** — 매일 **00:00 / 08:00 / 16:00** (8h): DB 백업 + 미디어 미러
- **"BlockCanvas Uploads Cleanup"** — 매일 **04:00**: 고아 업로드 자동 삭제

관리(작업명만 바꿔 동일 적용):
- 상태: `schtasks /Query /TN "BlockCanvas DB Backup" /V /FO LIST`
- 수동 1회: `schtasks /Run /TN "BlockCanvas DB Backup"`
- 중지: `schtasks /Change /TN "BlockCanvas DB Backup" /DISABLE`
- 삭제: `schtasks /Delete /TN "BlockCanvas DB Backup" /F`

> 참고: 현재 작업은 "사용자 로그온 상태에서" 실행된다(서버도 로그온 세션에서 구동되므로 동일 전제).
> 서버를 서비스/headless로 돌리게 되면 `/RU SYSTEM` 등으로 재등록 필요.

## off-site 백업 (Cloudflare R2) — 진짜 DR
로컬 `backups/`는 **같은 디스크**라 디스크 고장 대비가 안 된다. `scripts/upload-r2.mjs`가
백업 직후(run-backup.ps1 3단계) 최신 `dev-*.db.br`를 **Cloudflare R2(S3 호환)** 의 `db/`로
업로드해 off-site 사본을 만든다. DB 스냅샷엔 `AuditLog`/`CreatorLog` 테이블이 포함되므로 **로그도 함께 보존**된다.

- **하루 1회 스로틀**: 백업은 8h마다지만 off-site 업로드는 ~1회/일 (`R2_UPLOAD_MIN_INTERVAL_HOURS`, 기본 20).
- **용량 알림**: 버킷 총 사용량이 임계(`R2_USAGE_ALERT_BYTES`, 기본 8GiB = 무료 10GB의 80%) 이상이면 **Discord 웹훅**으로 경고(12h 디바운스).
- **`.env` 없으면 자동 skip** → 로컬 백업엔 영향 없음. (이메일 발송 미구축이라 알림은 Discord 웹훅 사용)

`.env` (gitignore):
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=blockcanvas-backups
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com   # 선택
DISCORD_WEBHOOK_URL=...                                      # 선택(알림)
R2_USAGE_ALERT_BYTES=8589934592                             # 선택(기본 8GiB)
R2_UPLOAD_MIN_INTERVAL_HOURS=20                             # 선택
```

**보존(R2 Lifecycle)**: R2 대시보드 → 버킷 → Object lifecycle 규칙으로 `db/` 프리픽스를
**1825일(5년) 후 자동 삭제**로 설정.
- 전자상거래법: 계약·청약철회/대금결제 기록 **5년**, 소비자 분쟁기록 3년 → 가장 긴 5년에 맞춤.
- **향후 유료 회원제(외부 결제 Patreon 등)·회원가입 도입 대비.** 외부 결제를 쓰더라도 자사 DB에 남는 **회원/구독 계약·해지(청약철회) 기록**은 5년 보존 대상이 될 수 있어 5년 권장.
> 통비법상 로그인/접속기록 3개월 보관·삭제는 *백업*이 아니라 **라이브 DB의 주기적 정리**로 처리된다 → world-sweep(4단계)이 호출하는 `sweepDataRetention()`(`src/lib/dataRetention.ts`)이 AuditLog/CreatorLog 90일 초과분 + 만료 인증토큰을 삭제한다. (백업본엔 정책 고지대로 최대 5년 동반 보존)
> 단위 환산: 1095일=3년, **1825일=5년**.

수동 테스트: `node scripts/upload-r2.mjs` (실업로드/알림 확인)

## 보존 정책 (로컬, 용량 최소화)
최근 **90개(= 30일 × 3회/일)**만 유지, 초과분은 오래된 것부터 자동 삭제.

## 설정 변경 (환경변수)
`scripts/backup-db.mjs` 상단 기본값을 환경변수로 덮어쓸 수 있다.
- `BC_BACKUP_DIR` — 백업 폴더(예: 다른 드라이브 `D:\Backups\BlockCanvas`)
- `BC_BACKUP_RETENTION` — 보존 개수(기본 90)
- `BC_BROTLI_QUALITY` — 0~11(기본 11; DB가 매우 커져 느리면 낮추기)
- `BC_DB_PATH` — 소스 DB 경로(기본 `<repo>/dev.db`)

작업 스케줄러는 환경변수를 별도 세션에서 받으므로, 변경하려면 `run-backup.ps1`에서
`$env:BC_... = '...'` 를 node 실행 전에 설정하는 게 가장 확실하다.

## 복원
```
node scripts/restore-db.mjs            # 최신 백업 → dev.restored.db
node scripts/restore-db.mjs dev-20260608-164736.db.br   # 특정 백업
```
적용: **서버 중지 → 현재 dev.db 보관(dev.db.bak) → dev.restored.db 를 dev.db 로 교체 → 서버 시작**.

## 용량 예상
DB 대부분이 텍스트/JSON(이미지·파일은 `public/uploads/`에 별도) → 압축률 ~10x.
- 백업 1개 ≈ **DB 크기 ÷ 10**
- 90개 총합 ≈ **DB 크기 × 9** (현재 DB 0.19MB 기준 약 **1.7MB**)

| 라이브 DB | 백업 1개 | 90개 총 저장량 |
|---|---|---|
| 0.2 MB (현재) | ~20 KB | ~1.7 MB |
| 1 MB | ~0.1 MB | ~9 MB |
| 5 MB | ~0.5 MB | ~45 MB |
| 20 MB | ~2 MB | ~180 MB |
| 50 MB | ~5 MB | ~450 MB |
| 100 MB | ~10 MB | ~0.9 GB |

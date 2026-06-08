# DB 백업 시스템

라이브 SQLite/libSQL DB(`dev.db`)를 **하루 3회(8시간 간격)** 자동 백업한다.
`VACUUM INTO`로 일관된 스냅샷을 만든 뒤 Node 내장 **Brotli(품질 11)**로 압축한다.
외부 도구·추가 의존성 없음(서버 동시 사용 안전).

## 구성 파일
- `scripts/backup-db.mjs` — 실제 백업(스냅샷 → 압축 → 보존 정리 → 로깅)
- `scripts/run-backup.ps1` — 작업 스케줄러용 래퍼(cwd 고정, node 실행, 오류 로깅)
- `scripts/restore-db.mjs` — 복원(.db.br → .db 해제)
- `backups/db/dev-YYYYMMDD-HHmmss.db.br` — 압축 백업본 (gitignored)
- `backups/backup.log` — 실행 로그

## 스케줄
Windows 작업 스케줄러 작업 **"BlockCanvas DB Backup"** — 매일 **00:00 / 08:00 / 16:00** 실행.
- 상태 확인: `schtasks /Query /TN "BlockCanvas DB Backup" /V /FO LIST`
- 수동 1회 실행: `schtasks /Run /TN "BlockCanvas DB Backup"`
- 사용 중지: `schtasks /Change /TN "BlockCanvas DB Backup" /DISABLE`
- 삭제: `schtasks /Delete /TN "BlockCanvas DB Backup" /F`

> 참고: 현재 작업은 "사용자 로그온 상태에서" 실행된다(서버도 로그온 세션에서 구동되므로 동일 전제).
> 서버를 서비스/headless로 돌리게 되면 `/RU SYSTEM` 등으로 재등록 필요.

## 보존 정책 (용량 최소화)
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

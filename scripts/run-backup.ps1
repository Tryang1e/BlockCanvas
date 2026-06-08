# BlockCanvas DB 백업 — Windows 작업 스케줄러용 래퍼
# 8시간마다(하루 3회) 실행되어 scripts/backup-db.mjs 를 돌린다.
# 작업 디렉터리를 레포 루트로 고정하고, 실패 시에도 로그를 남긴다.

$ErrorActionPreference = 'Stop'
$root = 'C:\Github\BlockCanvas'
$logDir = Join-Path $root 'backups'
$log = Join-Path $logDir 'backup.log'
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

# node.exe 위치 결정 (감지된 기본 경로 → PATH 폴백)
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source } else {
    "$ts [run-backup] ERROR: node.exe 를 찾을 수 없습니다." | Out-File -Append -Encoding utf8 $log
    exit 1
  }
}

Set-Location $root
try {
  & $node (Join-Path $root 'scripts\backup-db.mjs')
  exit $LASTEXITCODE
} catch {
  "$ts [run-backup] ERROR: $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
  exit 1
}

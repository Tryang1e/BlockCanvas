# BlockCanvas 고아 업로드 정리 — Windows 작업 스케줄러용 래퍼 (매일 1회)
# scripts/clean-orphan-uploads.mjs --apply 실행 (24h 이내 최근 파일은 자동 보호)

$ErrorActionPreference = 'Stop'
$root = 'C:\Github\BlockCanvas'
$logDir = Join-Path $root 'backups'
$cleanlog = Join-Path $logDir 'cleanup.log'
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source } else {
    "$ts [cleanup] ERROR: node.exe 를 찾을 수 없습니다." | Out-File -Append -Encoding utf8 $cleanlog
    exit 1
  }
}

Set-Location $root
"$ts [cleanup] start" | Out-File -Append -Encoding utf8 $cleanlog
try {
  & $node (Join-Path $root 'scripts\clean-orphan-uploads.mjs') --apply | Out-File -Append -Encoding utf8 $cleanlog
  exit $LASTEXITCODE
} catch {
  "$ts [cleanup] ERROR: $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $cleanlog
  exit 1
}

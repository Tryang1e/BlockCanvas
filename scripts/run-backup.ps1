# BlockCanvas 백업 — Windows 작업 스케줄러용 래퍼 (8시간마다, 하루 3회)
#  1) DB 백업: scripts/backup-db.mjs (VACUUM+Brotli)
#  2) 미디어 미러: public/uploads → backups/uploads (robocopy /MIR, 라이브 현재 상태 반영·증분)

$ErrorActionPreference = 'Stop'
$root = 'C:\Github\BlockCanvas'
$logDir = Join-Path $root 'backups'
$log = Join-Path $logDir 'backup.log'
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

# node.exe 위치 (감지된 기본 경로 → PATH 폴백)
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source } else {
    "$ts [run-backup] ERROR: node.exe 를 찾을 수 없습니다." | Out-File -Append -Encoding utf8 $log
    exit 1
  }
}

Set-Location $root

# 1) DB 백업
$dbExit = 0
try {
  & $node (Join-Path $root 'scripts\backup-db.mjs')
  $dbExit = $LASTEXITCODE
} catch {
  "$ts [run-backup] ERROR(db): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
  $dbExit = 1
}

# 2) 미디어 미러 (best-effort — 실패해도 DB 백업 결과로 종료코드 결정)
try {
  $src = Join-Path $root 'public\uploads'
  $dst = Join-Path $root 'backups\uploads'
  if (Test-Path $src) {
    $srcCount = (Get-ChildItem $src -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($srcCount -gt 0) {
      if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }
      # /MIR: 라이브와 동일하게 미러(삭제 반영). 안전장치로 source 가 비었을 때(0개)는 위에서 건너뜀.
      robocopy $src $dst /MIR /R:1 /W:2 /NFL /NDL /NJH /NP | Out-Null
      "$ts [media] mirror rc=$LASTEXITCODE files=$srcCount" | Out-File -Append -Encoding utf8 $log
    } else {
      "$ts [media] WARN: source empty → mirror 건너뜀(안전)" | Out-File -Append -Encoding utf8 $log
    }
  }
} catch {
  "$ts [run-backup] ERROR(media): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
}

# 2b) 월드 백업 zip 보존 복사 (plugin backups → backups/world-zips) — best-effort.
#     /XO(원본이 더 새 것일 때만) + 삭제 미러 아님(/MIR 아님) → 누적 보존.
#     아카이브 후 90일 퍼지가 월드 zip의 '유일한 사본'을 지워도 백업본은 남는다(DR: 오프사이트 대상으로 삼을 수 있음).
try {
  $wzSrc = Join-Path $root 'MC_SER\Server\plugins\BlockCanvasLink\backups'
  $wzDst = Join-Path $root 'backups\world-zips'
  if (Test-Path $wzSrc) {
    if (-not (Test-Path $wzDst)) { New-Item -ItemType Directory -Force -Path $wzDst | Out-Null }
    robocopy $wzSrc $wzDst *.zip /E /XO /R:1 /W:2 /NFL /NDL /NJH /NP | Out-Null
    "$ts [world-zips] retain rc=$LASTEXITCODE" | Out-File -Append -Encoding utf8 $log
  } else {
    "$ts [world-zips] skip (plugin backups 폴더 없음)" | Out-File -Append -Encoding utf8 $log
  }
} catch {
  "$ts [run-backup] ERROR(world-zips): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
}

# 2c) 미디어 버전 스냅샷 (주 1회, 8주 보존) — best-effort.
#     /MIR 이 라이브의 실수 삭제/손상을 백업에 8h 내 전파해도, 과거 스냅샷에서 복구할 수 있게 한다.
#     이미 미러된 사본(backups/uploads)을 스냅샷하므로 라이브에 부하가 없다.
try {
  $snapDir = Join-Path $root 'backups\uploads-snapshots'
  if (-not (Test-Path $snapDir)) { New-Item -ItemType Directory -Force -Path $snapDir | Out-Null }
  $recent = Get-ChildItem $snapDir -Filter 'uploads-*.zip' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $needSnap = -not ($recent -and $recent.LastWriteTime -gt (Get-Date).AddDays(-6))
  $mediaSnapSrc = Join-Path $root 'backups\uploads'
  if ($needSnap -and (Test-Path $mediaSnapSrc)) {
    $snapPath = Join-Path $snapDir ('uploads-' + (Get-Date -Format 'yyyy-MM-dd') + '.zip')
    if (-not (Test-Path $snapPath)) {
      Compress-Archive -Path (Join-Path $mediaSnapSrc '*') -DestinationPath $snapPath -CompressionLevel Optimal -ErrorAction Stop
      "$ts [media-snap] created $(Split-Path $snapPath -Leaf)" | Out-File -Append -Encoding utf8 $log
    }
    Get-ChildItem $snapDir -Filter 'uploads-*.zip' -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-56) } |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
} catch {
  "$ts [run-backup] ERROR(media-snap): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
}

# 3) off-site 업로드 (Cloudflare R2) — best-effort. .env 의 R2_* 가 없으면 스크립트가 알아서 skip.
try {
  & $node (Join-Path $root 'scripts\upload-r2.mjs')
} catch {
  "$ts [run-backup] ERROR(r2): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
}

# 4) 월드 수명주기 스윕 (30일 미사용 → 아카이브, 90일 → 영구삭제) — best-effort.
#    .env 의 WORLD_SWEEP_SECRET 이 있으면 로컬 Next 엔드포인트로 POST. 없으면 건너뜀.
try {
  $envFile = Join-Path $root '.env'
  $sweepSecret = $null
  if (Test-Path $envFile) {
    $line = Select-String -Path $envFile -Pattern '^\s*WORLD_SWEEP_SECRET\s*=' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($line) { $sweepSecret = ($line.Line -replace '^\s*WORLD_SWEEP_SECRET\s*=\s*', '').Trim().Trim('"').Trim("'") }
  }
  if ($sweepSecret) {
    $port = if ($env:PORT) { $env:PORT } else { 3000 }
    $resp = Invoke-WebRequest -Uri "http://localhost:$port/api/world/sweep" -Method POST `
      -Headers @{ 'x-cron-secret' = $sweepSecret } -UseBasicParsing -TimeoutSec 300
    "$ts [world-sweep] $($resp.Content)" | Out-File -Append -Encoding utf8 $log
  } else {
    "$ts [world-sweep] skip (WORLD_SWEEP_SECRET 미설정)" | Out-File -Append -Encoding utf8 $log
  }
} catch {
  "$ts [run-backup] ERROR(world-sweep): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
}

# 5) DB 백업 실패 경보 (best-effort) — DB 백업이 실패하면 운영 채널로 통지(RPO 위험). off-site/미디어 실패는 로그로만.
if ($dbExit -ne 0) {
  try {
    $envFile = Join-Path $root '.env'
    $hook = $null
    if (Test-Path $envFile) {
      foreach ($k in @('DISCORD_OPS_WEBHOOK_URL', 'DISCORD_WEBHOOK_URL')) {
        $line = Select-String -Path $envFile -Pattern ("^\s*" + $k + "\s*=") -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($line) {
          $hook = ($line.Line -replace ("^\s*" + $k + "\s*=\s*"), '').Trim().Trim('"').Trim("'")
          if ($hook) { break }
        }
      }
    }
    if ($hook) {
      $payload = @{ content = "🔴 **[BlockCanvas ops] db-backup**`nDB 백업 실패(exit=$dbExit). backups/backup.log 확인 요망 — 백업 신선도(RPO) 위험." } | ConvertTo-Json -Compress
      Invoke-WebRequest -Uri $hook -Method POST -ContentType 'application/json' -Body $payload -UseBasicParsing -TimeoutSec 8 | Out-Null
      "$ts [alert] db-backup 실패 통지 전송" | Out-File -Append -Encoding utf8 $log
    }
  } catch {
    "$ts [run-backup] ERROR(alert): $($_.Exception.Message)" | Out-File -Append -Encoding utf8 $log
  }
}

exit $dbExit

<#
  cloudflared.exe 아웃바운드(업링크) 대역 상한 — Windows Policy-based QoS.

  왜: 웹은 Cloudflare Tunnel(cloudflared.exe)로만 노출된다. 큰 다운로드(월드 백업 다운로드 등)나
      터널 아웃바운드가 서버의 단일 인터넷 회선을 포화시키면, 같은 회선을 공유하는 마인크래프트
      서버(포트 8831)가 버퍼블로트로 끊긴다. cloudflared 의 아웃바운드에 상한을 걸어 MC 용 여유를 남긴다.

  ⚠ 중요: Windows QoS 는 "아웃바운드(내보내는)" 트래픽만 제한한다.
     - 효과 있음: 다운로드(서버→클라), Dynmap 타일, 사이트 전송, 터널 아웃바운드.
     - 효과 없음: "업로드(월드 삽입)" — 그건 수신(인바운드)이라 앱단 서버측 스로틀
       (WORLD_UPLOAD_THROTTLE_MBPS)이 담당한다. 이 스크립트는 그걸 대체하지 않는다.

  사용: 이 .ps1 을 우클릭 → "PowerShell로 실행" (또는 관리자 PowerShell 에서 실행).
        관리자가 아니면 자동으로 권한 상승(UAC)한다.
        상한을 바꾸려면 -CapMbps 값을 주거나 아래 기본값을 수정.

  해제:  Remove-NetQosPolicy -Name "Throttle cloudflared" -Confirm:$false
#>
param(
  # 상한(Mbps, 십진). 권장 = 서버 업로드(업링크) 가용 대역의 약 60~70%.
  # 앱단 업로드 스로틀(기본 5 MB/s ≈ 40 Mbps)과 맞춰 40 으로 시작. 회선이 빠르고 MC 가 안정적이면 올린다.
  [int]$CapMbps = 40
)

$ErrorActionPreference = "Stop"
$PolicyName = "Throttle cloudflared"

# ── 관리자 권한 자동 상승 ──
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  if (-not $PSCommandPath) {
    Write-Warning "이 스크립트를 .ps1 파일로 저장한 뒤 실행하세요(콘솔에 붙여넣으면 자동 상승이 안 됩니다)."
    return
  }
  Write-Host "관리자 권한으로 다시 실행합니다 (UAC 승인 필요)..."
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -CapMbps $CapMbps"
  return
}

$bps = [uint64]$CapMbps * 1000000   # Mbps(십진) → bits/sec.  40 Mbps = 40,000,000 bps ≈ 5.0 MB/s

Write-Host ""
Write-Host "cloudflared.exe 아웃바운드 상한을 $CapMbps Mbps ($bps bps) 로 설정합니다."

# ── WMI(Winmgmt) 서비스 확인/활성화 ──
# QoS(NetQos) cmdlet 은 CIM/WMI 를 통해 동작한다. 이 서비스가 '사용 안 함'이면
# "CIM 서버에 연결할 수 없습니다"(0x80070422) 에러가 난다. Set/Start-Service 는 WMI 없이도 동작한다.
$wmi = Get-Service -Name Winmgmt -ErrorAction SilentlyContinue
if ($wmi) {
  try { Set-Service -Name Winmgmt -StartupType Automatic -ErrorAction Stop }
  catch { Write-Warning "Winmgmt 시작유형(자동) 변경 실패: $($_.Exception.Message)" }
  if ($wmi.Status -ne 'Running') {
    Write-Host "WMI(Winmgmt) 서비스가 꺼져 있어 시작합니다..."
    try { Start-Service -Name Winmgmt -ErrorAction Stop; Start-Sleep -Seconds 2 }
    catch { Write-Warning "Winmgmt 시작 실패: $($_.Exception.Message)  (의존 서비스 RpcSs 확인 필요)" }
  }
  Write-Host ("WMI(Winmgmt) 상태: {0}" -f (Get-Service -Name Winmgmt).Status)
} else {
  Write-Warning "Winmgmt 서비스를 찾을 수 없습니다."
}

try {
  # 기존 동일 정책 제거(멱등 — 다시 실행하면 값만 갱신).
  $existing = Get-NetQosPolicy -Name $PolicyName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "기존 정책 갱신 중..."
    Remove-NetQosPolicy -Name $PolicyName -Confirm:$false
  }

  # 앱 이름으로 매칭 — 서비스로 돌아도 프로세스명이 cloudflared.exe 라 매칭된다.
  New-NetQosPolicy -Name $PolicyName -AppPathNameMatchCondition "cloudflared.exe" `
    -ThrottleRateActionBitsPerSecond $bps | Out-Null
}
catch {
  Write-Warning "정책 생성 실패: $($_.Exception.Message)"
  Write-Warning "대안(GUI): gpedit.msc → 컴퓨터 구성 → Windows 설정 → 정책 기반 QoS → 새 정책 →"
  Write-Warning "  '이 응용 프로그램만'=cloudflared.exe, '아웃바운드 제한 속도 지정'=$CapMbps Mbps."
  Read-Host "엔터를 누르면 닫힙니다"
  return
}

Write-Host ""
Write-Host "적용됨:"
Get-NetQosPolicy -Name $PolicyName | Format-List Name, AppPathNameMatchCondition, ThrottleRateAction

Write-Host "확인: 큰 월드 백업 다운로드를 진행하면서 작업관리자 → cloudflared.exe 의 네트워크가"
Write-Host "      약 $CapMbps Mbps 근처에서 평평해지면(더 안 올라가면) 정상입니다."
Write-Host "해제: Remove-NetQosPolicy -Name '$PolicyName' -Confirm:`$false"
Write-Host ""
Read-Host "엔터를 누르면 닫힙니다"

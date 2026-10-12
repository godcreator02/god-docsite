# 启动验证站 dev 服务：Start-Process 隐藏窗口跑 pnpm dev，PID 写 evidence/dev-pid.txt，
# 条件轮询 http://127.0.0.1:5460/ 直到 200（每 0.5 秒一次，总超时 150 秒）。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteDir = Join-Path (Split-Path -Parent $root) 'site'
$logOut = Join-Path $root 'evidence\dev-server.log'
$logErr = Join-Path $root 'evidence\dev-server.err.log'
$proc = Start-Process -FilePath 'pwsh' -ArgumentList @('-NoProfile', '-Command', "Set-Location -LiteralPath '$siteDir'; pnpm dev") -WindowStyle Hidden -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
$proc.Id | Set-Content -LiteralPath (Join-Path $root 'evidence\dev-pid.txt')
"dev launcher PID $($proc.Id), started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Tee-Object -Variable msg | Write-Output
$deadline = (Get-Date).AddSeconds(150)
$ok = $false
while ((Get-Date) -lt $deadline) {
  if ($proc.HasExited) { break }
  try {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:5460/' -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $ok = $true; break }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
if ($ok) {
  "service READY at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Write-Output
  exit 0
}
"service NOT ready (launcher exited=$($proc.HasExited)); see evidence/dev-server.log and dev-server.err.log" | Write-Output
exit 1

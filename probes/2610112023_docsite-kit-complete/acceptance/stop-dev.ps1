# 停止验收启动的 dev 服务：按 evidence/dev-pid.txt 记录的 PID 整树终止，
# 核对 5460/5461 释放，再对照源码哈希 manifest；结果写 evidence/20261011-C2-postcheck.txt。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$lines = @()
$devPid = [int](Get-Content -LiteralPath (Join-Path $root 'evidence\dev-pid.txt') -Raw).Trim()
$lines += "recorded dev launcher PID: $devPid"
$kill = taskkill /PID $devPid /T /F 2>&1
$lines += ($kill | Out-String).Trim()
Start-Sleep -Milliseconds 800
foreach ($port in 5460, 5461) {
  $listen = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  $lines += "port ${port} after stop: $(if ($listen.Count -eq 0) { 'free' } else { "STILL LISTENING (PID $($listen[0].OwningProcess))" })"
}
$manifest = Get-Content -Raw -LiteralPath (Join-Path (Split-Path -Parent $root) 'review\20261011-2042-site-source-hashes.json') | ConvertFrom-Json
$mismatch = 0
foreach ($entry in $manifest) {
  $actual = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash
  if ($actual -ne $entry.sha256) {
    $mismatch++
    $lines += "HASH MISMATCH: $($entry.path)"
  }
}
$lines += "hash compare after acceptance: $($manifest.Count) files, $mismatch mismatch"
$lines += "dev-server.log tail:"
$lines += (Get-Content -LiteralPath (Join-Path $root 'evidence\dev-server.log') -Tail 5)
$report = Join-Path $root 'evidence\20261011-C2-postcheck.txt'
$lines | Tee-Object -FilePath $report
if ($mismatch -gt 0) { exit 1 }
exit 0

# 启动前检查：5460/5461 端口空闲；site 源文件 SHA256 与主会话 manifest 一致。
# 输出写到 evidence/20261011-C2-precheck.txt；端口被占或哈希不符时退出码非 0，不启动服务。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$lines = @()
foreach ($port in 5460, 5461) {
  $listen = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if ($listen.Count -eq 0) {
    $lines += "port ${port}: free"
  } else {
    $lines += "port ${port}: OCCUPIED by PID $($listen[0].OwningProcess)"
  }
}
$manifestPath = Join-Path $root 'evidence\source-hashes-reference.json'
$manifest = Get-Content -Raw -LiteralPath (Join-Path (Split-Path -Parent $root) 'review\20261011-2042-site-source-hashes.json') | ConvertFrom-Json
Copy-Item -LiteralPath (Join-Path (Split-Path -Parent $root) 'review\20261011-2042-site-source-hashes.json') -Destination $manifestPath
$mismatch = 0
foreach ($entry in $manifest) {
  $actual = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash
  if ($actual -ne $entry.sha256) {
    $mismatch++
    $lines += "HASH MISMATCH: $($entry.path)"
    $lines += "  manifest=$($entry.sha256)"
    $lines += "  actual  =$actual"
  }
}
$lines += "hash compare: $($manifest.Count) files, $mismatch mismatch"
$report = Join-Path $root 'evidence\20261011-C2-precheck.txt'
$lines | Tee-Object -FilePath $report
$portBusy = ($lines | Where-Object { $_ -like 'port*: OCCUPIED' }).Count -gt 0
if ($portBusy -or $mismatch -gt 0) { exit 1 }
exit 0

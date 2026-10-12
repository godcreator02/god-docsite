# 启动站点B的 dev 服务（分离进程，日志落盘 logs/dev-b.log）
# 用法：pwsh -NoProfile -File scripts/start-dev-b.ps1
$ErrorActionPreference = 'Stop'
$probeRoot = Split-Path -Parent $PSScriptRoot
Start-Process pwsh -ArgumentList @(
    '-NoProfile', '-Command',
    "cd '$probeRoot/site-b'; `$env:FORCE_COLOR='0'; pnpm dev *> ../logs/dev-b.log"
) -WindowStyle Hidden
'ready'

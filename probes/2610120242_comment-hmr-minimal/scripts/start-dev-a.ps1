# 启动站点A的 dev 服务（分离进程，日志落盘 logs/dev-a.log）
# 用法：pwsh -NoProfile -File scripts/start-dev-a.ps1
$ErrorActionPreference = 'Stop'
$probeRoot = Split-Path -Parent $PSScriptRoot
Start-Process pwsh -ArgumentList @(
    '-NoProfile', '-Command',
    "cd '$probeRoot/site-a'; `$env:FORCE_COLOR='0'; pnpm dev *> ../logs/dev-a.log"
) -WindowStyle Hidden
'ready'

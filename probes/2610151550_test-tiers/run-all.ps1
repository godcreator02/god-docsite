# 在分级之后的仓上量一遍：各包默认（快的一级）、各包 test:slow（慢的一级）、仓根 pnpm test / check / test:slow 的耗时
# 要先在仓根 pnpm install、pnpm build；结果写进 runs/
$runs = Join-Path $PSScriptRoot 'runs'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
New-Item -ItemType Directory -Force $runs | Out-Null
& (Join-Path $PSScriptRoot 'measure.ps1') -Tag after | Tee-Object (Join-Path $runs 'after.txt')
& (Join-Path $PSScriptRoot 'measure.ps1') -Tag slow -Extra '--config', 'vitest.slow.config.ts' `
  -Packages 'packages/code-pin', 'packages/collab', 'packages/docfirst', 'plugins/docsite', 'plugins/collab' | Tee-Object (Join-Path $runs 'slow.txt')
foreach ($tag in 'after', 'slow') { node (Join-Path $PSScriptRoot 'table.mjs') (Join-Path $runs $tag) 100000 | Set-Content (Join-Path $runs "$tag-table.txt") }
$rootTiming = foreach ($cmd in 'test', 'check', 'test:slow') {
  Push-Location $root
  $t = Get-Date
  pnpm $cmd *> (Join-Path $runs "root-$($cmd -replace ':', '-').log")
  "pnpm $cmd exit=$LASTEXITCODE secs=$([math]::Round(((Get-Date) - $t).TotalSeconds, 1))"
  Pop-Location
}
$rootTiming | Tee-Object (Join-Path $runs 'root-timing.txt')

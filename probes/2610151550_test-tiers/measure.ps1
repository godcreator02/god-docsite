# 逐个包运行 vitest（默认配置，或 -Extra 传进来的参数），记下每个包的总耗时与 json 报告，写进 runs/<Tag>/
param([string]$Tag = 'after', [string[]]$Packages = @(
  'packages/god-docsite','packages/identity','packages/explainer','packages/code-pin','packages/trajectory',
  'packages/comments','packages/doc-export','packages/collab','packages/docfirst',
  'plugins/docsite','plugins/docfirst','plugins/collab','docs-site'), [string[]]$Extra = @())
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$out = Join-Path $PSScriptRoot "runs/$Tag"
New-Item -ItemType Directory -Force $out | Out-Null
$summary = @()
foreach ($p in $Packages) {
  $name = $p -replace '[\\/]', '_'
  $json = Join-Path $out "$name.json"
  $log = Join-Path $out "$name.log"
  Push-Location (Join-Path $root $p)
  $t = Get-Date
  pnpm exec vitest run @Extra --reporter=default --reporter=json "--outputFile.json=$json" *> $log
  $code = $LASTEXITCODE
  $secs = [math]::Round(((Get-Date) - $t).TotalSeconds, 1)
  Pop-Location
  $summary += [pscustomobject]@{ pkg = $p; exit = $code; secs = $secs }
  "$p exit=$code secs=$secs"
}
$summary | ConvertTo-Json | Set-Content (Join-Path $out 'summary.json')

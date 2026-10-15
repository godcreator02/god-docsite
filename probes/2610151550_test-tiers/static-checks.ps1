# 逐个包运行 typecheck 与 lint（有这条脚本的），记下耗时；输出写进 runs/static-checks.log
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$log = Join-Path $PSScriptRoot 'runs/static-checks.log'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
'' | Set-Content $log
foreach ($p in 'packages/god-docsite','packages/identity','packages/explainer','packages/code-pin','packages/trajectory',
  'packages/comments','packages/doc-export','packages/collab','packages/docfirst',
  'plugins/docsite','plugins/docfirst','plugins/collab','collab-test/site') {
  Push-Location (Join-Path $root $p)
  $scripts = (Get-Content package.json -Raw | ConvertFrom-Json).scripts
  foreach ($s in 'typecheck', 'lint') {
    if (-not $scripts.$s) { continue }
    $t = Get-Date
    pnpm run $s *>> $log
    "$p $s exit=$LASTEXITCODE secs=$([math]::Round(((Get-Date) - $t).TotalSeconds, 1))"
  }
  Pop-Location
}

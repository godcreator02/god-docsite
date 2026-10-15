# 把 runs/<FromTag>-table.txt 里并行运行时超过 MinSeconds 的文件逐个单独再跑一次，量单独运行的耗时，写进 runs/isolated/
param([string]$FromTag = 'before', [double]$MinSeconds = 0.5)
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$out = Join-Path $PSScriptRoot 'runs/isolated'
New-Item -ItemType Directory -Force $out | Out-Null
$pattern = '^\s*([\d.]+)s\s+\d+\s+(\S+)$'
$lines = Get-Content (Join-Path $PSScriptRoot "runs/$FromTag-table.txt") | Where-Object { $_ -match $pattern -and [double]$Matches[1] -ge $MinSeconds }
foreach ($line in $lines) {
  $null = $line -match $pattern
  $parallel = $Matches[1]
  $rel = $Matches[2]
  $pkg = if ($rel -match '^(packages|plugins)/[^/]+') { $Matches[0] } else { 'docs-site' }
  $fileInPkg = $rel.Substring($pkg.Length + 1)
  $name = $rel -replace '[\\/]', '_'
  Push-Location (Join-Path $root $pkg)
  $t = Get-Date
  pnpm exec vitest run $fileInPkg --reporter=json "--outputFile.json=$(Join-Path $out "$name.json")" *> (Join-Path $out "$name.log")
  $code = $LASTEXITCODE
  Pop-Location
  "{0,6:N1}s  exit={1}  parallel={2}s  {3}" -f ((Get-Date) - $t).TotalSeconds, $code, $parallel, $rel
}

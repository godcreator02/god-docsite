# SSR 取证：取 / 与 /second 的 HTML 存进 evidence/，再跑分段隔离检查 ssr-section-split.mjs。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$r1 = Invoke-WebRequest -Uri 'http://127.0.0.1:5460/' -UseBasicParsing -TimeoutSec 15
$r1.Content | Set-Content -LiteralPath (Join-Path $root 'evidence\01-ssr-home.html') -Encoding UTF8
$r2 = Invoke-WebRequest -Uri 'http://127.0.0.1:5460/second' -UseBasicParsing -TimeoutSec 15
$r2.Content | Set-Content -LiteralPath (Join-Path $root 'evidence\02-ssr-second.html') -Encoding UTF8
"home: HTTP $($r1.StatusCode), chars=$($r1.Content.Length)"
"second: HTTP $($r2.StatusCode), chars=$($r2.Content.Length)"
Set-Location -LiteralPath $root
node ssr-section-split.mjs (Join-Path $root 'evidence\01-ssr-home.html') (Join-Path $root 'evidence\02-ssr-second.html') *> (Join-Path $root 'evidence\20261011-C2-ssr-sections.txt')
Get-Content -LiteralPath (Join-Path $root 'evidence\20261011-C2-ssr-sections.txt')
"SSR_SPLIT_EXIT=$LASTEXITCODE"
exit $LASTEXITCODE

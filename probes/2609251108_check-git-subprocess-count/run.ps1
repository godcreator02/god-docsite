# 在几个站上各跑一次 docfirst check，只留计次表。第一个参数是被测的 cli.mjs，第二个是输出文件。
# 例：pwsh run.ps1 D:\unitfolders\s28bv-gwbbase\gwb-devkit\docs-site\node_modules\@godcreator\docfirst-workflow\dist\cli.mjs runs\01-baseline.txt
param([Parameter(Mandatory)][string]$Cli, [Parameter(Mandatory)][string]$Out)
$trace = ([uri](Join-Path $PSScriptRoot 'trace-git.mjs')).AbsoluteUri
$cliPath = (Resolve-Path $Cli).Path
$sites = @(
  'D:\unitfolders\s28bv-gwbbase\gwb-devkit\docs-site',
  'D:\unitfolders\s28bv-gwbbase\god-live-doc\docs-site',
  'D:\unitfolders\s28bv-gwbbase\gwb-base-plugins\docs-site',
  'D:\unitfolders\s28bv-gwbbase\gwb-ui-plugins\docs-site',
  'D:\unitfolders\igldu-gwbkernel\gwb-kernel\docs-site',
  'D:\unitfolders\evew5-gwbapps\gwb-block-note\docs-site'
)
$lines = foreach ($site in $sites) {
  Push-Location $site
  $all = node --import $trace $cliPath check 2>&1
  $refs = ($all | Select-String '^(🟢|🟡|🔴|⚪) ').Count
  "=== $site  输出行 $refs"
  $all | Select-String '^== |^\s+\d+ 次' | ForEach-Object { $_.Line }
  Pop-Location
}
$lines | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot $Out)

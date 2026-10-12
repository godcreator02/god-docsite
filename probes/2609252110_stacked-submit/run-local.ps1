# 本机 git 部分：几种提交方式各建一个临时仓跑一遍，看 git 合并时报不报冲突。
# 用法（在本目录）：pwsh -NoProfile -File run-local.ps1 > runs/01-local.txt
# 每行记录用一小段 JSON 代替真实的记录行，只关心 git 怎么按行合并。

$ErrorActionPreference = 'Continue'
$root = Join-Path ([IO.Path]::GetTempPath()) ("stacked-submit-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $root | Out-Null
"临时目录：$root"
"git 版本：$(git --version)"

function Show([string]$command) {
  "`$ $command"
  Invoke-Expression "$command 2>&1" | ForEach-Object { "  $_" }
}

function NewRepo([string]$name, [string[]]$lines) {
  $dir = Join-Path $root $name
  New-Item -ItemType Directory $dir | Out-Null
  Set-Location $dir
  git init -q -b main
  git config user.name probe
  git config user.email probe@local
  git config core.autocrlf false
  New-Item -ItemType Directory collab | Out-Null
  WriteLines $lines
  git add . ; git commit -q -m '起点'
}

function WriteLines([string[]]$lines) {
  [IO.File]::WriteAllText((Join-Path (Get-Location) 'collab/bob.jsonl'), (($lines | ForEach-Object { "$_`n" }) -join ''))
}

function AppendLine([string]$line) {
  [IO.File]::AppendAllText((Join-Path (Get-Location) 'collab/bob.jsonl'), "$line`n")
}

function ReplaceLine([int]$index, [string]$line) {
  $lines = [IO.File]::ReadAllLines((Join-Path (Get-Location) 'collab/bob.jsonl'))
  $lines[$index] = $line
  WriteLines $lines
}

"`n==================== 情况 1：两个平行的合并请求都从 main 切出去，都在文件末尾加一行 ===================="
NewRepo 'parallel' @('{"id":"h","status":"open"}')
git switch -q -c bob-1 ; AppendLine '{"id":"c9","status":"open"}' ; git commit -qam 'bob-1：c9'
git switch -q main ; git switch -q -c bob-2 ; AppendLine '{"id":"c10","status":"open"}' ; git commit -qam 'bob-2：c10'
git switch -q main
Show 'git merge --no-ff bob-1 -m "合并 #7"'
Show 'git merge --no-ff bob-2 -m "合并 #8"'
Show 'Get-Content collab/bob.jsonl'
git merge --abort

"`n==================== 情况 2：第二次提交接在第一次后面（每人一条工作分支） ===================="
NewRepo 'stacked' @('{"id":"h","status":"open"}')
git switch -q -c bob ; AppendLine '{"id":"c9","status":"open"}' ; git commit -qam 'bob：c9'
$first = git rev-parse HEAD
AppendLine '{"id":"c10","status":"open"}' ; git commit -qam 'bob：c10'
git switch -q main
"（机器人先合并第一次推上去的那个提交，也就是合并请求 #7 当时的内容）"
Show "git merge --no-ff $first -m `"合并 #7`""
"（再合并第二次推上去的，也就是 bob 分支的最新提交）"
Show 'git merge --no-ff bob -m "合并 #8"'
Show 'Get-Content collab/bob.jsonl'
"（bob 同步：把 main 合进自己的工作分支）"
git switch -q bob
Show 'git merge main -m "同步 main"'
Show 'git log --graph --oneline --all'

"`n==================== 情况 3：两人改的行中间隔着一行没动过的 ===================="
NewRepo 'gap' @('{"id":"c1","status":"open"}', '{"id":"c2","status":"open"}', '{"id":"c3","status":"open"}')
git switch -q -c admin ; ReplaceLine 0 '{"id":"c1","status":"resolved"}' ; git commit -qam 'admin：c1 已解决'
git switch -q main ; git switch -q -c bob ; ReplaceLine 2 '{"id":"c3","status":"resolved"}' ; git commit -qam 'bob：c3 已解决'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/bob.jsonl'

"`n==================== 情况 4：两人改的是相邻两行 ===================="
NewRepo 'adjacent' @('{"id":"c1","status":"open"}', '{"id":"c2","status":"open"}', '{"id":"c3","status":"open"}')
git switch -q -c admin ; ReplaceLine 0 '{"id":"c1","status":"resolved"}' ; git commit -qam 'admin：c1 已解决'
git switch -q main ; git switch -q -c bob ; ReplaceLine 1 '{"id":"c2","status":"resolved"}' ; git commit -qam 'bob：c2 已解决'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/bob.jsonl'
git merge --abort

"`n==================== 情况 5：bob 在末尾追加新记录，同时 admin 把 bob 的最后一条标为已解决 ===================="
NewRepo 'append-vs-last' @('{"id":"c8","status":"open"}', '{"id":"c9","status":"open"}')
git switch -q -c admin ; ReplaceLine 1 '{"id":"c9","status":"resolved"}' ; git commit -qam 'admin：c9 已解决'
git switch -q main ; git switch -q -c bob ; AppendLine '{"id":"c10","status":"open"}' ; git commit -qam 'bob：c10'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/bob.jsonl'
git merge --abort

"`n==================== 情况 6：两人把同一条改成了不同的值（真冲突） ===================="
NewRepo 'same-record' @('{"id":"c1","status":"open"}', '{"id":"t1","status":"todo"}', '{"id":"c3","status":"open"}')
git switch -q -c admin ; ReplaceLine 1 '{"id":"t1","status":"doing"}' ; git commit -qam 'admin：t1 进行中'
git switch -q main ; git switch -q -c bob ; ReplaceLine 1 '{"id":"t1","status":"done"}' ; git commit -qam 'bob：t1 已完成'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/bob.jsonl'
git merge --abort

Set-Location $PSScriptRoot

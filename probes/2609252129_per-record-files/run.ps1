# 一条记录一个文件（collab/<作者>/<id>.json）时，上一次实验里冲突的几种情况还冲不冲突。
# 用法（在本目录）：pwsh -NoProfile -File run.ps1 > runs/01-local.txt
# A–F 每个文件一行 JSON，G–K 试一个字段一行的几种排版；用 git merge --no-ff 模拟机器人按「合并提交」方式合并。

$ErrorActionPreference = 'Continue'
$root = Join-Path ([IO.Path]::GetTempPath()) ("per-record-files-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $root | Out-Null
"临时目录：$root"
"git 版本：$(git --version)"

function Show([string]$command) {
  "`$ $command"
  Invoke-Expression "$command 2>&1" | ForEach-Object { "  $_" }
}

function WriteRecord([string]$path, [string]$json) {
  $full = Join-Path (Get-Location) $path
  New-Item -ItemType Directory -Force (Split-Path $full) | Out-Null
  [IO.File]::WriteAllText($full, "$json`n")
}

function NewRepo([string]$name, [hashtable]$records) {
  $dir = Join-Path $root $name
  New-Item -ItemType Directory $dir | Out-Null
  Set-Location $dir
  git init -q -b main
  git config user.name probe
  git config user.email probe@local
  git config core.autocrlf false
  foreach ($path in $records.Keys) { WriteRecord $path $records[$path] }
  git add . ; git commit -q -m '起点'
}

$adminRecords = @{
  'collab/admin/c1.json' = '{"id":"c1","status":"open","text":"拓扑再核一下"}'
  'collab/admin/c2.json' = '{"id":"c2","status":"open","text":"电容取多大"}'
  'collab/admin/t1.json' = '{"id":"t1","status":"todo","owner":"bob","title":"核算纹波"}'
}

"`n==================== 情况 A：两人改的是相邻的两条（原来的第 7 种） ===================="
NewRepo 'adjacent' $adminRecords
git switch -q -c admin ; WriteRecord 'collab/admin/c1.json' '{"id":"c1","status":"resolved","text":"拓扑再核一下"}' ; git commit -qam 'admin：c1 已解决'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/c2.json' '{"id":"c2","status":"resolved","text":"电容取多大"}' ; git commit -qam 'bob：c2 已解决'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/c1.json, collab/admin/c2.json'

"`n==================== 情况 B：bob 写新记录的同时，admin 改了 bob 最新的那条（原来的第 8 种） ===================="
NewRepo 'new-vs-last' (@{ 'collab/bob/c9.json' = '{"id":"c9","status":"open","text":"均压用排序法"}' })
git switch -q -c admin ; WriteRecord 'collab/bob/c9.json' '{"id":"c9","status":"resolved","text":"均压用排序法"}' ; git commit -qam 'admin：c9 已解决'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/bob/c10.json' '{"id":"c10","status":"open","text":"电容纹波按 10% 算"}' ; git add . ; git commit -qm 'bob：c10'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-ChildItem -Name collab/bob'

"`n==================== 情况 C：同一个人两个平行的合并请求，各写一条新记录 ===================="
NewRepo 'parallel-new' $adminRecords
git switch -q -c bob-1 ; WriteRecord 'collab/bob/c9.json' '{"id":"c9","status":"open","text":"均压用排序法"}' ; git add . ; git commit -qm 'bob-1：c9'
git switch -q main ; git switch -q -c bob-2 ; WriteRecord 'collab/bob/c10.json' '{"id":"c10","status":"open","text":"电容纹波按 10% 算"}' ; git add . ; git commit -qm 'bob-2：c10'
git switch -q main
Show 'git merge --no-ff bob-1 -m "合并 #7"'
Show 'git merge --no-ff bob-2 -m "合并 #8"'
Show 'Get-ChildItem -Name collab/bob'

"`n==================== 情况 D：两人同时回复同一条批注（回复各是一条新记录） ===================="
NewRepo 'replies' $adminRecords
git switch -q -c admin ; WriteRecord 'collab/admin/r1.json' '{"id":"r1","target":"c1","text":"先看 CHB"}' ; git add . ; git commit -qm 'admin：回复 c1'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/bob/r2.json' '{"id":"r2","target":"c1","text":"我来查"}' ; git add . ; git commit -qm 'bob：回复 c1'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'

"`n==================== 情况 E：两人改了同一条的不同字段（admin 改负责人，bob 改状态） ===================="
NewRepo 'same-record-different-fields' $adminRecords
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' '{"id":"t1","status":"todo","owner":"carol","title":"核算纹波"}' ; git commit -qam 'admin：t1 改负责人'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' '{"id":"t1","status":"doing","owner":"bob","title":"核算纹波"}' ; git commit -qam 'bob：t1 进行中'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'
git merge --abort

"`n==================== 情况 F：两人把同一条的同一个字段改成了不同的值（真冲突） ===================="
NewRepo 'same-record-same-field' $adminRecords
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' '{"id":"t1","status":"doing","owner":"bob","title":"核算纹波"}' ; git commit -qam 'admin：t1 进行中'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' '{"id":"t1","status":"done","owner":"bob","title":"核算纹波"}' ; git commit -qam 'bob：t1 已完成'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'
git merge --abort

"`n==================== 情况 G：pretty JSON（一个字段一行），两人改的字段中间隔着一行没动过的 ===================="
$prettyTask = "{`n  `"id`": `"t1`",`n  `"status`": `"todo`",`n  `"title`": `"核算纹波`",`n  `"owner`": `"bob`"`n}"
NewRepo 'pretty-separated' (@{ 'collab/admin/t1.json' = $prettyTask })
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' ($prettyTask -replace '"owner": "bob"', '"owner": "carol"') ; git commit -qam 'admin：改负责人（第 5 行）'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' ($prettyTask -replace '"status": "todo"', '"status": "doing"') ; git commit -qam 'bob：改状态（第 3 行）'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'

"`n==================== 情况 H：pretty JSON，两人改的字段是上下相邻的两行 ===================="
NewRepo 'pretty-adjacent' (@{ 'collab/admin/t1.json' = $prettyTask })
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' ($prettyTask -replace '"title": "核算纹波"', '"title": "核算纹波与损耗"') ; git commit -qam 'admin：改标题（第 4 行）'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' ($prettyTask -replace '"status": "todo"', '"status": "doing"') ; git commit -qam 'bob：改状态（第 3 行）'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'
git merge --abort

"`n==================== 情况 I：字段之间空一行、所有字段都写出来，两人改原来相邻的两个字段 ===================="
$spacedTask = "{`n  `"id`": `"t1`",`n`n  `"status`": `"todo`",`n`n  `"title`": `"核算纹波`",`n`n  `"owner`": `"bob`",`n`n  `"due`": null`n}"
NewRepo 'spaced-adjacent' (@{ 'collab/admin/t1.json' = $spacedTask })
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' ($spacedTask -replace '"title": "核算纹波"', '"title": "核算纹波与损耗"') ; git commit -qam 'admin：改标题'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' ($spacedTask -replace '"status": "todo"', '"status": "doing"') ; git commit -qam 'bob：改状态'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'
Show 'node -e "console.log(JSON.parse(require(''fs'').readFileSync(''collab/admin/t1.json'',''utf8'')))"'

"`n==================== 情况 J：字段之间空一行，一个人给原来是 null 的截止日期填值，另一个人改最后一个字段前面的状态 ===================="
NewRepo 'spaced-fill-null' (@{ 'collab/admin/t1.json' = $spacedTask })
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' ($spacedTask -replace '"due": null', '"due": "2026-10-10"') ; git commit -qam 'admin：填截止日期'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' ($spacedTask -replace '"owner": "bob"', '"owner": "carol"') ; git commit -qam 'bob：改负责人'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'

"`n==================== 情况 K：字段之间空一行，两人把同一个字段改成不同的值（真冲突） ===================="
NewRepo 'spaced-same-field' (@{ 'collab/admin/t1.json' = $spacedTask })
git switch -q -c admin ; WriteRecord 'collab/admin/t1.json' ($spacedTask -replace '"status": "todo"', '"status": "doing"') ; git commit -qam 'admin：t1 进行中'
git switch -q main ; git switch -q -c bob ; WriteRecord 'collab/admin/t1.json' ($spacedTask -replace '"status": "todo"', '"status": "done"') ; git commit -qam 'bob：t1 已完成'
git switch -q main
Show 'git merge --no-ff admin -m "合并 admin"'
Show 'git merge --no-ff bob -m "合并 bob"'
Show 'Get-Content collab/admin/t1.json'
git merge --abort

Set-Location $PSScriptRoot

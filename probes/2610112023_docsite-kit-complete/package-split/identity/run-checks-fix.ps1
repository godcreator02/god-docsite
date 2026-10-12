# 修正 authorizeWrite 白名单投影后的检查：复现脚本 + 自检 + vitest + tsc。
# 直接调用已有的可执行文件，不用 pnpm exec（它会隐式 install 并写共享 lock）。
# 本包 node_modules（@types、react、typescript、vitest）是上一轮 J 会话 pnpm exec 触发安装留下的实际状态
# （lock 已由 J 恢复，实体还在），本会话没有执行过安装；vitest/tsc 因此可以用本包自己的工具跑。
# 复现脚本 node 直接跑会在 write-access.ts 的 '../model.js' 上报模块解析错误
# （node 的类型剥离不重写扩展名），带本目录的 ts-extension-hooks.mjs 钩子跑才是它的原意。
# 输出写 checks-fix.log，不覆盖首次的 checks.log（保留首次证据）。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$identity = 'D:\unitfolders\oz47p-docsite-kit\docsite-kit\packages\docsite-identity'
$here = 'D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\package-split\identity'
$log = Join-Path $here 'checks-fix.log'

'== 主会话的复现脚本（带扩展名钩子跑；修后应两条 projected:true、退出 0）==' | Tee-Object -FilePath $log
Set-Location 'D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\review'
# node --import 在 Windows 上要 file:// URL，直接给 D:\ 路径会被当成 d: 协议
$hooksUrl = ([System.Uri]::new((Join-Path $here 'ts-extension-hooks.mjs'))).AbsoluteUri
node --import $hooksUrl 20261011-2151-authorize-projection.mjs 2>&1 | Tee-Object -FilePath $log -Append
"review exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

'== node selfcheck ==' | Tee-Object -FilePath $log -Append
Set-Location $here
node --import ./ts-extension-hooks.mjs selfcheck.ts 2>&1 | Tee-Object -FilePath $log -Append
"selfcheck exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

'== vitest run（本包 node_modules 的 vitest）==' | Tee-Object -FilePath $log -Append
Set-Location $identity
& (Join-Path $identity 'node_modules\.bin\vitest.ps1') run 2>&1 | Tee-Object -FilePath $log -Append
"vitest exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

'== tsc --noEmit（本包 node_modules 的 tsc）==' | Tee-Object -FilePath $log -Append
& (Join-Path $identity 'node_modules\.bin\tsc.ps1') -p (Join-Path $identity 'tsconfig.json') --noEmit 2>&1 | Tee-Object -FilePath $log -Append
"tsc exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

# 身份包的可执行检查：自检 + 尝试 tsc 类型检查 + 尝试用 docsite-kit 包里已装的 vitest 跑正式测试。
# 依赖安装留给集成会话（K），这里的 tsc/vitest 调用的是同仓 packages/docsite-kit 的工具，能跑多少如实记录多少。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$kit = 'D:\unitfolders\oz47p-docsite-kit\docsite-kit\packages\docsite-kit'
$identity = 'D:\unitfolders\oz47p-docsite-kit\docsite-kit\packages\docsite-identity'
$here = 'D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\package-split\identity'
$log = Join-Path $here 'checks.log'

'== node selfcheck ==' | Tee-Object -FilePath $log
Set-Location $here
node --import ./ts-extension-hooks.mjs selfcheck.ts 2>&1 | Tee-Object -FilePath $log -Append
"node selfcheck exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

'== tsc --noEmit（依赖未装，预期报缺模块，看纯逻辑部分有无真实类型错误）==' | Tee-Object -FilePath $log -Append
Set-Location $identity
& (Join-Path $kit 'node_modules\.bin\tsc.ps1') -p (Join-Path $identity 'tsconfig.json') --noEmit 2>&1 | Tee-Object -FilePath $log -Append
"tsc exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

'== vitest run（借用 docsite-kit 的 vitest；测试不 import react，看 vite 能否解析 .js 后缀到 .ts 源）==' | Tee-Object -FilePath $log -Append
& (Join-Path $kit 'node_modules\.bin\vitest.ps1') run 2>&1 | Tee-Object -FilePath $log -Append
"vitest exit=$LASTEXITCODE" | Tee-Object -FilePath $log -Append

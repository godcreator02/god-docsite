# 验证站开发服务的启动/停止脚本（任务K）。
# 用法：
#   pwsh -File start-site.ps1 start identity 5460   # 带身份（DOCSITE_IDENTITY_CODE=people.json 里 zk 的码）
#   pwsh -File start-site.ps1 start readonly 5461   # 不带身份（只读站）；端口真实传给 react-router dev
#   pwsh -File start-site.ps1 stop                  # 停掉本脚本启动的进程树（先核对 PID 还是本脚本的实例）
# 身份码与环境变量只设进这个子进程；站只监听 127.0.0.1，--strictPort 被占用直接报错。
param(
  [Parameter(Position = 0)][string]$Action = 'start',
  [Parameter(Position = 1)][string]$Mode = 'identity',
  [Parameter(Position = 2)][int]$Port = 5460
)

$siteDir = Split-Path $PSScriptRoot -Parent | Split-Path -Parent | Join-Path -ChildPath 'site'
if (-not (Test-Path (Join-Path $siteDir 'package.json'))) { throw "算出的站点目录不对：$siteDir" }
$stateFile = Join-Path $PSScriptRoot 'site-process.json'

if ($Action -eq 'stop') {
  if (Test-Path $stateFile) {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    foreach ($record in $state.processes) {
      $proc = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
      # 核对还是本脚本启动的那个实例：进程还在且启动时间一致（截到秒——CIM 与 Get-Process 的滴答精度不同），陈旧 PID 被系统复用时不误杀
      $sameInstance = $proc -and $proc.StartTime.ToString('yyyy-MM-ddTHH:mm:ss') -eq $record.startedAt.ToString('yyyy-MM-ddTHH:mm:ss')
      if ($sameInstance) {
        # taskkill /T 连整棵进程树一起停（cmd → pnpm → react-router dev）
        & taskkill /T /F /PID $record.pid 2>&1 | Out-Null
        "stopped pid $($record.pid)"
      } else {
        "skip pid $($record.pid)：不是本脚本启动的实例（已退出或被复用），不杀；如确认是本会话遗留请按进程树手动核对"
      }
    }
    Remove-Item $stateFile -ErrorAction SilentlyContinue
  } else {
    'no recorded process'
  }
  exit 0
}

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) { throw "端口 $Port 已被占用（PID $($existing.OwningProcess)），先处理它再启动" }

$env:PROBE_SITE_ORIGIN = "http://127.0.0.1:$Port"
if ($Mode -eq 'identity') { $env:DOCSITE_IDENTITY_CODE = 'k8v1r2w3x4' }
else { Remove-Item Env:DOCSITE_IDENTITY_CODE -ErrorAction SilentlyContinue }

# pnpm 在 Windows 上是 cmd shim，Start-Process 不能直接执行：经 cmd /c 启动；端口真实传给 react-router dev
$devLog = Join-Path $PSScriptRoot "site-dev-$Port.log"
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'pnpm', 'dev', '--port', "$Port", '--host', '127.0.0.1', '--strictPort' -WorkingDirectory $siteDir -WindowStyle Hidden -RedirectStandardOutput $devLog -RedirectStandardError (Join-Path $PSScriptRoot "site-dev-$Port.err.log") -PassThru
if (-not $proc) { throw 'Start-Process 没有返回进程' }
$startedAt = $proc.StartTime.ToString('o')
@{ processes = @(@{ pid = $proc.Id; startedAt = $startedAt }); port = $Port; mode = $Mode } | ConvertTo-Json | Set-Content $stateFile -Encoding utf8
"started: pid $($proc.Id) mode $Mode port $Port log $devLog"

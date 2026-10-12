# 等待一个 URL 返回 200（每 0.5 秒一次，总超时秒数，超时打印日志尾部）
# 用法：pwsh -NoProfile -File scripts/wait-http.ps1 <url> <超时秒> <失败时tail的日志路径>
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 60,
    [string]$LogForFailure = ''
)
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            "ready bytes=$($r.Content.Length)"
            exit 0
        }
    } catch {
        Start-Sleep -Milliseconds 500
    }
}
'not-ready'
if ($LogForFailure -and (Test-Path $LogForFailure)) {
    Get-Content $LogForFailure -Tail 30
}
exit 1

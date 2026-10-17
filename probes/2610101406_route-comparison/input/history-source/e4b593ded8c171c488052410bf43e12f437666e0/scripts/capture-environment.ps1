#requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$recordedAt = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(8))
$runName = 'environment-' + $recordedAt.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
$runPath = Join-Path $labRoot ('runs/' + $runName)

$uninstallRoots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$installed = @(Get-ItemProperty -Path $uninstallRoots -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match 'MathType|Microsoft Office|Microsoft 365|Microsoft Word|Pandoc' } |
    Select-Object DisplayName, DisplayVersion, InstallLocation)

$registrations = foreach ($progId in @('Word.Application', 'Equation.DSMT4')) {
    $clsidKey = 'Registry::HKEY_CLASSES_ROOT\' + $progId + '\CLSID'
    $clsid = $null
    $server = $null
    $programPath = $null
    if (Test-Path -LiteralPath $clsidKey) {
        $clsid = (Get-Item -LiteralPath $clsidKey).GetValue('')
        $serverKey = 'Registry::HKEY_CLASSES_ROOT\CLSID\' + $clsid + '\LocalServer32'
        if (Test-Path -LiteralPath $serverKey) {
            $server = [string](Get-Item -LiteralPath $serverKey).GetValue('')
            if ($server -match '^\s*"?(.+?\.exe)"?(?:\s|$)') { $programPath = $Matches[1] }
        }
    }
    [ordered]@{
        progId = $progId
        registered = [bool]$clsid
        clsid = $clsid
        localServer = $server
        executablePath = $programPath
        executableExists = [bool]($programPath -and (Test-Path -LiteralPath $programPath))
        runtimeVerified = $false
    }
}

$pandocCommand = Get-Command -Name pandoc -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$pandocInfo = [ordered]@{ onPath = [bool]$pandocCommand; path = $null; version = $null }
if ($pandocCommand) {
    $pandocInfo.path = $pandocCommand.Source
    $versionLines = @(& $pandocCommand.Source --version 2>&1)
    if ($LASTEXITCODE -eq 0) { $pandocInfo.version = [string]$versionLines[0] }
}

$snapshot = [ordered]@{
    recordedAt = $recordedAt.ToString('o')
    timeZone = 'Asia/Shanghai'
    powershellVersion = $PSVersionTable.PSVersion.ToString()
    osVersion = [Environment]::OSVersion.VersionString
    installedSoftware = $installed
    comRegistrations = @($registrations)
    pandoc = $pandocInfo
    fixtureSha256 = (Get-FileHash -LiteralPath (Join-Path $labRoot 'fixtures/canonical.json') -Algorithm SHA256).Hash
    notes = @(
        '注册信息、程序存在与运行成功分别记录；本脚本不启动 Office 或 MathType。',
        'PATH 未发现程序不等于全盘未安装；不采集许可证或其他凭据。'
    )
}

New-Item -ItemType Directory -Path $runPath -ErrorAction Stop | Out-Null
$outputPath = Join-Path $runPath 'environment.json'
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding utf8NoBOM
Write-Output $outputPath

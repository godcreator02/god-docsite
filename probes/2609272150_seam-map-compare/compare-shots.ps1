# 用法：pwsh compare-shots.ps1 <旧站端口> <新站端口> <截图目录>
# 两个站各截同样几页（同一窗口尺寸、Edge 无头模式），逐像素比较；不同的页报出不同像素的个数与范围。
param([int]$OldPort, [int]$NewPort, [string]$OutDir)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing, System.Drawing.Primitives, System.Drawing.Common, System.Private.Windows.GdiPlus, System.Private.Windows.Core -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class ShotDiff {
  // 回 [不同像素数, 最上一行, 最下一行]
  public static int[] Compare(string pathA, string pathB) {
    using var a = new Bitmap(pathA); using var b = new Bitmap(pathB);
    if (a.Width != b.Width || a.Height != b.Height) throw new Exception("两张图尺寸不同：" + pathA);
    var rect = new Rectangle(0, 0, a.Width, a.Height);
    var da = a.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var db = b.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    try {
      int stride = da.Stride; var ba = new byte[stride * a.Height]; var bb = new byte[stride * a.Height];
      Marshal.Copy(da.Scan0, ba, 0, ba.Length); Marshal.Copy(db.Scan0, bb, 0, bb.Length);
      int diff = 0, minY = -1, maxY = -1;
      for (int y = 0; y < a.Height; y++) for (int x = 0; x < a.Width; x++) {
        int i = y * stride + x * 4;
        if (ba[i] != bb[i] || ba[i + 1] != bb[i + 1] || ba[i + 2] != bb[i + 2] || ba[i + 3] != bb[i + 3]) { diff++; if (minY < 0) minY = y; maxY = y; }
      }
      return new[] { diff, minY, maxY };
    } finally { a.UnlockBits(da); b.UnlockBits(db); }
  }
}
"@
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$pages = @('docs', 'docs/workflow', 'future/spec/seam-map-in-player')
New-Item -ItemType Directory -Force $OutDir | Out-Null

function Shoot([int]$port, [string]$page, [string]$file) {
  if (Test-Path $file) { Remove-Item -LiteralPath $file }
  & $edge --headless=new --disable-gpu --hide-scrollbars --window-size=1400,2400 --virtual-time-budget=5000 "--screenshot=$file" "http://127.0.0.1:$port/$page" 2>$null
  $deadline = (Get-Date).AddSeconds(40)
  while (-not (Test-Path $file)) {
    if ((Get-Date) -gt $deadline) { throw "截图没出来：$file" }
    Start-Sleep -Milliseconds 500
  }
  Start-Sleep -Milliseconds 300
}

$differentPages = 0
foreach ($page in $pages) {
  $name = $page -replace '/', '_'
  $old = Join-Path $OutDir "old-$name.png"
  $new = Join-Path $OutDir "new-$name.png"
  Shoot $OldPort $page $old
  Shoot $NewPort $page $new
  $r = [ShotDiff]::Compare($old, $new)
  if ($r[0] -eq 0) { "相同  /$page" } else { $differentPages += 1; "不同  /$page：$($r[0]) 个像素，纵向 $($r[1])–$($r[2])" }
}
exit $differentPages

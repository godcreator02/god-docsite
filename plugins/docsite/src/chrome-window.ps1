# 找这个站点开着的 Chrome 应用窗口：应用身份以 AppIdPrefix 开头（同一个主机，开在哪一页都算），窗口标题是站名或「页面名 · 站名」（网站自己这样设标题）。
# 标题在窗口外框上，窗口被别的窗口完全盖住、最小化时都读得到；网页里的内容这时 Chrome 不一定建出来，所以不读网页
param(
  [Parameter(Mandatory)][string]$ChromePath,
  [Parameter(Mandatory)][string]$SiteTitle,
  [Parameter(Mandatory)][string]$AppIdPrefix
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class DocsiteChromeWindow {
  delegate bool EnumProc(IntPtr handle, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr state);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr handle, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr handle);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr handle, int command);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr handle);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr handle, ref Guid iid, out IPropertyStore store);
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref Variant value);
  [StructLayout(LayoutKind.Sequential)] struct Key { public Guid format; public uint id; }
  [StructLayout(LayoutKind.Explicit, Size=24)] struct Variant { [FieldOffset(0)] public ushort type; [FieldOffset(8)] public IntPtr value; }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IPropertyStore {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint index, out Key key);
    [PreserveSig] int GetValue(ref Key key, out Variant value);
    [PreserveSig] int SetValue(ref Key key, ref Variant value);
    [PreserveSig] int Commit();
  }
  static string AppIdOf(IntPtr handle) {
    var iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
    IPropertyStore store;
    if (SHGetPropertyStoreForWindow(handle, ref iid, out store) != 0) return null;
    try {
      var key = new Key { format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), id = 5 };
      Variant value;
      if (store.GetValue(ref key, out value) != 0) return null;
      try { return value.type == 31 ? Marshal.PtrToStringUni(value.value) : null; }
      finally { PropVariantClear(ref value); }
    } finally { Marshal.ReleaseComObject(store); }
  }
  public static List<IntPtr> Candidates(string chrome, string appIdPrefix, string siteTitle) {
    var found = new List<IntPtr>();
    EnumWindows((handle, state) => {
      if (!IsWindowVisible(handle)) return true;
      var text = new StringBuilder(2048);
      GetClassName(handle, text, text.Capacity);
      if (text.ToString() != "Chrome_WidgetWin_1") return true;
      var title = new StringBuilder(2048);
      GetWindowText(handle, title, title.Capacity);
      if (title.ToString() != siteTitle && !title.ToString().EndsWith(" · " + siteTitle, StringComparison.Ordinal)) return true;
      uint processId; GetWindowThreadProcessId(handle, out processId);
      try {
        using (var process = Process.GetProcessById((int)processId)) {
          if (!String.Equals(process.MainModule.FileName, chrome, StringComparison.OrdinalIgnoreCase)) return true;
        }
      } catch (ArgumentException) { return true; }
      var actual = AppIdOf(handle);
      if (actual == null || !actual.StartsWith(appIdPrefix, StringComparison.Ordinal)) return true;
      found.Add(handle);
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static bool Focus(IntPtr handle) {
    if (IsIconic(handle)) ShowWindow(handle, 9);
    if (GetForegroundWindow() == handle) return true;
    // SetForegroundWindow 被 Windows 拒绝时也可能回 true，要看前台窗口到底换没换
    SetForegroundWindow(handle);
    if (GetForegroundWindow() == handle) return true;
    uint processId;
    var foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out processId);
    var currentThread = GetCurrentThreadId();
    var attached = foregroundThread != currentThread && AttachThreadInput(currentThread, foregroundThread, true);
    try {
      BringWindowToTop(handle);
      SetForegroundWindow(handle);
      return GetForegroundWindow() == handle;
    } finally { if (attached) AttachThreadInput(currentThread, foregroundThread, false); }
  }
}
"@
$windows = [DocsiteChromeWindow]::Candidates($ChromePath, $AppIdPrefix, $SiteTitle)
if ($windows.Count -eq 0) { @{ found = $false; focused = $false } | ConvertTo-Json -Compress; exit 0 }
@{ found = $true; focused = [DocsiteChromeWindow]::Focus($windows[0]) } | ConvertTo-Json -Compress

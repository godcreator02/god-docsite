# 本机字体名从哪里取，Chrome 的 CSS font-family 才认

## 问什么

gwb 的设置里要给「正文 / 标题 / 代码字体」做下拉框，清单由 gwb-docsite（Node 进程）列出本机装了的字体。哪种来源列出的名字，放进站点 CSS 的 `font-family` 后 Chrome 真的认？

## 怎么运行

```
node probe.mjs 03-rerun
```

零依赖；要求 Windows、pwsh 7、`C:\Program Files\Google\Chrome\Application\chrome.exe`。结果写进 `runs/<编号>.txt`（摘要）与 `runs/<编号>.json`（每种来源不认的名字全列）。

做法：六种来源各列一遍名字，合在一起交给 Chrome 无头模式；页面里每个名字配 `monospace`、`serif` 两种回落字体各用 canvas 量一次一段中英混排文字的宽度，任一种跟只用回落字体时的宽度不同，就算 Chrome 认这个名字。

| 来源 | 怎么取 |
| --- | --- |
| registryDisplayName | 注册表 `HKLM` / `HKCU` 的 `...\Windows NT\CurrentVersion\Fonts` 值名，去掉「(TrueType)」，「A & B」拆开 |
| gdiFamily | .NET `System.Drawing.Text.InstalledFontCollection` 的族名（GDI 的老式族名） |
| wpfFamily | WPF `System.Windows.Media.Fonts.SystemFontFamilies` 每个族 en-us 的名字 |
| nameTable* | 读注册表指向的每个字体文件的 name 表：nameID 1 老式族名、16 现代族名、4 全名；Preferred 是每个字面英文的「现代族名，没有就用老式族名」 |

## 结论

用 WPF 的 `Fonts.SystemFontFamilies`（en-us 名字），去掉名字以 `Global ` 开头的几项。本机 136 个族，Chrome 认 131 个；不认的 5 个里 4 个是 WPF 自己的组合字体（`Global User Interface` / `Monospace` / `Sans Serif` / `Serif`），另 1 个是字体本身的问题（`HYZhongHei`）。一个字体族只出一项，用户目录里装的更纱（`Sarasa Mono SC`）、随应用装的 Cascadia 都在。pwsh 7 里列一遍 0.48 秒。

别的来源不能用：

- 注册表值名 262 个里 Chrome 不认 122 个：字重、斜体写在名字里（`Sarasa Mono SC Bold`、`Arial Bold`）；而且注册表里根本没有随应用安装的字体（Cascadia Code / Mono 不在里面）
- GDI 族名 203 个里不认 23 个：把字重拆成单独的族（`Sarasa Mono SC Light`、`Noto Sans SC Medium`），长名截到 31 个字符（`Bahnschrift SemiBold SemiConden`），下拉框里一个字体会出现好几项
- 读 name 表要先从注册表找文件，跟注册表一样漏掉随应用安装的字体；全名（nameID 4）1424 个里只认 179 个

Chrome 也认中文本地名（`微软雅黑`），但下拉框的值统一用英文名。

## 运行那次的环境

2026-10-19，Windows 11 Pro 10.0.26200，Node v24.14.1，pwsh 7.6.7，Chrome 155.0.8059.82（HeadlessChrome/155.0.0.0）。god-docsite 仓 commit `3e5e8ca7`（被测对象是本机字体与 Chrome，跟仓里的代码无关）。

`runs/01-baseline` 只有注册表、GDI、name 表三种来源；`runs/02-wpf-and-preferred` 加上 WPF 与 Preferred，结论取自它。

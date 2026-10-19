// 本机字体名的三种来源（注册表 Fonts 键、.NET InstalledFontCollection、字体文件 name 表）各列一遍，
// 逐个放进 Chrome 无头模式的 canvas 里量宽度，看 CSS font-family 认不认这个名字。
// 用法：node probe.mjs <运行编号-名字>，结果写进 runs/<运行编号-名字>.txt 与 .json
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const probeDir = dirname(fileURLToPath(import.meta.url))
const runName = process.argv[2]
if (!runName) throw new Error('要给运行编号，如 node probe.mjs 01-baseline')
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const windowsFontsDir = 'C:\\Windows\\Fonts'
const fontRegistryKeys = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
]

/** 注册表 Fonts 键的每一项：值名（显示名）与值（字体文件，相对的在 C:\Windows\Fonts 下） */
function registryFontEntries() {
  const entries = []
  for (const key of fontRegistryKeys) {
    const text = execFileSync('reg', ['query', key], { encoding: 'utf8' })
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s{4}(.+?)\s{4}REG_(?:EXPAND_)?SZ\s{4}(.+)$/.exec(line)
      if (!match) continue
      const file = match[2].trim()
      entries.push({ displayName: match[1], file: isAbsolute(file) ? file : join(windowsFontsDir, file) })
    }
  }
  return entries
}

/** 注册表显示名去掉「(TrueType)」这类后缀，「A & B」拆成两个 */
function registryNames(entries) {
  return entries.flatMap(({ displayName }) => displayName.replace(/\s*\([^)]*\)\s*$/, '').split(' & ').map((name) => name.trim()))
}

function pwshLines(command) {
  return execFileSync('pwsh', ['-NoProfile', '-Command', `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${command}`], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
}

function gdiFamilyNames() {
  return pwshLines('Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families.Name')
}

/** WPF 的系统字体列表：每个族的 FamilyNames 里 en-us 那个名字 */
function wpfFamilyNames() {
  return pwshLines("Add-Type -AssemblyName PresentationCore; [System.Windows.Media.Fonts]::SystemFontFamilies | % { $_.FamilyNames[[System.Windows.Markup.XmlLanguage]::GetLanguage('en-us')] }")
}

/**
 * 读 TTF / OTF / TTC 的 name 表：nameID 1（老式族名）、4（全名）、16（现代族名），只取 Windows 与 Unicode 平台、全部语言。
 * preferred 是每个字面（TTC 里的每一个）英文的「现代族名，没有就用老式族名」
 */
function nameTableNames(buffer) {
  const fontOffsets = buffer.toString('latin1', 0, 4) === 'ttcf'
    ? Array.from({ length: buffer.readUInt32BE(8) }, (_, index) => buffer.readUInt32BE(12 + 4 * index))
    : [0]
  const names = { 1: new Set(), 4: new Set(), 16: new Set(), preferred: new Set() }
  for (const fontOffset of fontOffsets) {
    const englishNameOfFace = {}
    const tableCount = buffer.readUInt16BE(fontOffset + 4)
    let nameTableOffset
    for (let index = 0; index < tableCount; index++) {
      const record = fontOffset + 12 + 16 * index
      if (buffer.toString('latin1', record, record + 4) === 'name') nameTableOffset = buffer.readUInt32BE(record + 8)
    }
    if (nameTableOffset === undefined) throw new Error('没有 name 表')
    const recordCount = buffer.readUInt16BE(nameTableOffset + 2)
    const stringsOffset = nameTableOffset + buffer.readUInt16BE(nameTableOffset + 4)
    for (let index = 0; index < recordCount; index++) {
      const record = nameTableOffset + 6 + 12 * index
      const platformId = buffer.readUInt16BE(record)
      const nameId = buffer.readUInt16BE(record + 6)
      if (!(nameId in names) || (platformId !== 3 && platformId !== 0)) continue
      const start = stringsOffset + buffer.readUInt16BE(record + 10)
      const utf16be = buffer.subarray(start, start + buffer.readUInt16BE(record + 8))
      const name = Buffer.from(utf16be).swap16().toString('utf16le')
      names[nameId].add(name)
      const languageId = buffer.readUInt16BE(record + 4)
      if (platformId === 3 && languageId === 0x409) englishNameOfFace[nameId] = name
    }
    const preferred = englishNameOfFace[16] ?? englishNameOfFace[1]
    if (preferred !== undefined) names.preferred.add(preferred)
  }
  return names
}

function fileNameTableSources(entries) {
  const legacyFamily = new Set()
  const fullName = new Set()
  const typographicFamily = new Set()
  const preferredFamily = new Set()
  const unreadableFiles = []
  for (const file of new Set(entries.map((entry) => entry.file))) {
    if (!/\.(ttf|otf|ttc)$/i.test(file) || !existsSync(file)) {
      unreadableFiles.push(file)
      continue
    }
    const names = nameTableNames(readFileSync(file))
    names[1].forEach((name) => legacyFamily.add(name))
    names[4].forEach((name) => fullName.add(name))
    names[16].forEach((name) => typographicFamily.add(name))
    names.preferred.forEach((name) => preferredFamily.add(name))
  }
  return { legacyFamily: [...legacyFamily], fullName: [...fullName], typographicFamily: [...typographicFamily], preferredFamily: [...preferredFamily], unreadableFiles }
}

/** 页面里：每个名字配 monospace 与 serif 两种回落各量一次，任一种跟只用回落时宽度不同，就算 Chrome 认这个名字 */
function measurementPage(allNames) {
  return `<!doctype html><meta charset="utf-8"><pre id="out"></pre><script>
const names = ${JSON.stringify(allNames)};
const sample = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 永和九年岁在癸丑 iiiWWW';
const ctx = document.createElement('canvas').getContext('2d');
const width = (font) => { ctx.font = font; return ctx.measureText(sample).width };
const fallbacks = ['monospace', 'serif'];
const fallbackWidth = Object.fromEntries(fallbacks.map((f) => [f, width('40px ' + f)]));
const quote = (name) => '"' + name.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"';
const matched = names.filter((name) => fallbacks.some((f) => Math.abs(width('40px ' + quote(name) + ', ' + f) - fallbackWidth[f]) > 0.01));
document.getElementById('out').textContent = JSON.stringify({ chrome: navigator.userAgent, matched });
</script>`
}

function measureInChrome(allNames) {
  const workDir = mkdtempSync(join(tmpdir(), 'font-probe-'))
  try {
    const pagePath = join(workDir, 'measure.html')
    writeFileSync(pagePath, measurementPage(allNames))
    const dom = execFileSync(chromePath, ['--headless=new', '--disable-gpu', `--user-data-dir=${join(workDir, 'profile')}`, '--virtual-time-budget=10000', '--dump-dom', pathToFileURL(pagePath).href], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const json = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom)?.[1]
    if (!json) throw new Error(`Chrome 交回的页面里没有结果：\n${dom.slice(0, 2000)}`)
    return JSON.parse(json.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'))
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

const entries = registryFontEntries()
const fileSources = fileNameTableSources(entries)
const sources = {
  registryDisplayName: [...new Set(registryNames(entries))],
  gdiFamily: [...new Set(gdiFamilyNames())],
  wpfFamily: [...new Set(wpfFamilyNames())],
  nameTableLegacyFamily: fileSources.legacyFamily,
  nameTableTypographicFamily: fileSources.typographicFamily,
  nameTablePreferredFamily: fileSources.preferredFamily,
  nameTableFullName: fileSources.fullName,
}
const allNames = [...new Set(Object.values(sources).flat())]
const { chrome, matched } = measureInChrome(allNames)
const matchedNames = new Set(matched)

const lines = [`Chrome：${chrome}`, `注册表项 ${entries.length} 个；读不了 name 表的文件 ${fileSources.unreadableFiles.length} 个（非 ttf/otf/ttc 或文件不在）`, '']
const results = {}
for (const [source, names] of Object.entries(sources)) {
  const unmatched = names.filter((name) => !matchedNames.has(name))
  results[source] = { total: names.length, matched: names.length - unmatched.length, unmatched }
  lines.push(`== ${source}：${names.length} 个名字，Chrome 认 ${names.length - unmatched.length} 个，不认 ${unmatched.length} 个`)
  lines.push(`   不认的（最多列 30 个）：${unmatched.slice(0, 30).join(' | ')}`)
  lines.push(`   更纱相关：${names.filter((name) => /sarasa/i.test(name)).map((name) => `${name}${matchedNames.has(name) ? '' : '（不认）'}`).join(' | ')}`)
  lines.push(`   雅黑相关：${names.filter((name) => /yahei|雅黑/i.test(name)).map((name) => `${name}${matchedNames.has(name) ? '' : '（不认）'}`).join(' | ')}`)
  lines.push('')
}
const gdiOnly = sources.gdiFamily.filter((name) => !sources.nameTableLegacyFamily.includes(name) && !sources.nameTableTypographicFamily.includes(name))
lines.push(`gdiFamily 里有、name 表两种族名里都没有的：${gdiOnly.join(' | ')}`)
const recognizedGdiNotInWpf = sources.gdiFamily.filter((name) => matchedNames.has(name) && !sources.wpfFamily.includes(name))
lines.push(`gdiFamily 里 Chrome 认、wpfFamily 里没有的：${recognizedGdiNotInWpf.join(' | ')}`)
const recognizedWpfNotInGdi = sources.wpfFamily.filter((name) => matchedNames.has(name) && !sources.gdiFamily.includes(name))
lines.push(`wpfFamily 里 Chrome 认、gdiFamily 里没有的：${recognizedWpfNotInGdi.join(' | ')}`)

mkdirSync(join(probeDir, 'runs'), { recursive: true })
writeFileSync(join(probeDir, 'runs', `${runName}.txt`), lines.join('\n') + '\n')
writeFileSync(join(probeDir, 'runs', `${runName}.json`), JSON.stringify({ chrome, unreadableFiles: fileSources.unreadableFiles, results }, null, 2) + '\n')
console.log(lines.join('\n'))

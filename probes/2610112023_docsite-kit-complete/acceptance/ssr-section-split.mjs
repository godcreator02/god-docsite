// SSR 分段隔离检查：按 data-probe 区块切分两个路由的 SSR HTML，逐段提取可见纯文本，
// 统计 A 集合标记（A-ONLY-NODE-COMPILED）与 A/B 锚段的出现，证明「A 有标记、B 无标记」
// 发生在对应正文段上，而不是整页字符串搜索的巧合。
// 用法：node ssr-section-split.mjs <home.html> <second.html>；断言全过退出码 0，否则 1。
import { readFileSync } from 'node:fs'

const MARKER = 'A-ONLY-NODE-COMPILED'
const ANCHOR_A = 'A 集合正文：这段话由 source.config.ts 里 A 集合自己的 mdxOptions 编译'
const ANCHOR_B = 'B 集合正文：B 集合的 mdxOptions 不挂 Node 插件'

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const sectionsOf = (html) => {
  const out = []
  const re = /<section[^>]*data-probe="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g
  let m
  while ((m = re.exec(html)) !== null) out.push({ name: m[1], inner: m[2] })
  return out
}

const results = []
const check = (ok, id, detail) => results.push({ ok, id, detail })

for (const [label, path, expect, loaderACopies] of [
  // loaderACopies：该路由 loader 序列化进页面脚本的 A 正文 HTML 份数（首页 loader 返回 {a,b}，
  // A 一份；/second 无 loader）。区块外的标记应恰好等于这个数，且全部来自 A 的数据。
  ['GET / (SSR)', process.argv[2], { 'server-a': 'A', 'browser-a': 'A', 'server-b': 'B', 'browser-b': 'B' }, 1],
  ['GET /second (SSR)', process.argv[3], { 'second-browser-b': 'B' }, 0],
]) {
  const html = readFileSync(path, 'utf8')
  const wholeMarkerCount = html.split(MARKER).length - 1
  console.log(`${label} 整页 ${MARKER} 出现 ${wholeMarkerCount} 次；externalized 提示 ${html.includes('has been externalized') ? '有' : '无'}；module runner closed ${html.includes('module runner has been closed') ? '有' : '无'}`)
  const sections = sectionsOf(html)
  check(sections.length === Object.keys(expect).length, `${label}-section-count`, `区块数 ${sections.length}，预期 ${Object.keys(expect).length}`)
  let inSectionMarkers = 0
  for (const section of sections) {
    const text = decode(section.inner)
    const markers = text.split(MARKER).length - 1
    inSectionMarkers += markers
    const kind = expect[section.name]
    const anchor = kind === 'A' ? text.includes(ANCHOR_A) : text.includes(ANCHOR_B)
    console.log(`  [${section.name}] marker=${markers} ${kind === 'A' ? 'A锚段' : 'B锚段'}=${anchor ? '在' : '缺'} 正文="${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`)
    check(anchor, `${label}-${section.name}-anchor`, `${kind} 集合锚段应出现在该区块`)
    if (kind === 'A') check(markers === 1, `${label}-${section.name}-marker`, `A 区块应恰有 1 个标记（实际 ${markers}）`)
    if (kind === 'B') check(markers === 0, `${label}-${section.name}-no-marker`, `B 区块不应有标记（实际 ${markers}）`)
  }
  const outOfSections = wholeMarkerCount - inSectionMarkers
  console.log(`  区块外标记 ${outOfSections} 处（预期 ${loaderACopies}，应来自 loader 序列化的 A 正文数据）：`)
  const bare = html.replace(/<section[^>]*data-probe="[^"]+"[^>]*>[\s\S]*?<\/section>/g, '')
  let at = -1
  while ((at = bare.indexOf(MARKER, at + 1)) !== -1) {
    console.log(`    …${bare.slice(Math.max(0, at - 60), at + MARKER.length + 60).replace(/\s+/g, ' ')}…`)
  }
  check(outOfSections === loaderACopies, `${label}-outside-count`, `区块外标记数 ${outOfSections} 应等于 loader 携带的 A 数据份数 ${loaderACopies}`)
  check(wholeMarkerCount === inSectionMarkers + loaderACopies, `${label}-whole-count`, `整页标记数 ${wholeMarkerCount} = 区块内 ${inSectionMarkers} + A 数据 ${loaderACopies}`)
}

const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}: ${r.detail}`)
console.log(`\n${results.length - failed.length}/${results.length} 项断言通过`)
process.exit(failed.length > 0 ? 1 : 0)

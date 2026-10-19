/**
 * 字体检查（pnpm test:fonts）：各包的组件只用阅读字体的三个变量（--font-sans、--font-heading、--font-mono）或同名的 Tailwind 类，不写字体名。
 * 扫 packages/<包>/ 下的 css、ts、tsx（跳过 dist、node_modules、测试），找出 font-family 声明、名字里带 font 或 mono 的 CSS 变量定义、
 * React 的 fontFamily、SVG 的 font-family 属性与 Tailwind 的 font-[…] 任意值类，值里除了 var(…)、inherit 这类关键字与通用字体名还写了别的，就失败并列出位置。
 * var(…) 里的后备串不算：站点上这三个变量总是有值，后备串用不上。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = path.join(repoDir, 'packages')

/** 唯一可以写字体名的地方，各写明为什么 */
const filesAllowedToNameFonts = new Map([
  ['packages/word-report/styles/report.css', '报告页照导出 Word 用的模板排版，正文与标题固定用模板的字体，不跟读者设的阅读字体'],
])

const skippedDirectoryNames = new Set(['dist', 'node_modules', 'test', 'tests', '.venv', 'engine'])
const scannedExtensions = new Set(['.css', '.ts', '.tsx', '.mjs'])

const keywordValues = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer'])
const genericFamilies = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
])

/** 去掉每一段 var(…)（含嵌套括号），剩下的才是写在这里的字体 */
function withoutVarCalls(value) {
  let rest = value
  for (;;) {
    const start = rest.indexOf('var(')
    if (start === -1) return rest
    let depth = 0
    let end = start + 3
    for (; end < rest.length; end++) {
      if (rest[end] === '(') depth++
      else if (rest[end] === ')' && --depth === 0) break
    }
    rest = `${rest.slice(0, start)}${rest.slice(end + 1)}`
  }
}

/** 值里写死的字体名：去掉 var(…) 后按逗号拆开，关键字与通用字体名之外的都算 */
function namedFontsIn(value) {
  return withoutVarCalls(value)
    .replace(/!important/g, '')
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((part) => part !== '' && !keywordValues.has(part) && !genericFamilies.has(part))
}

/** 每种写法一条：抓出字体值，它在哪一行由匹配的位置算 */
const fontValuePatterns = [
  { label: 'font-family 声明', pattern: /font-family\s*:\s*([^;}\n]+)/g },
  { label: '字体变量定义', pattern: /(?<![\w-])--[\w-]*(?:font|mono)[\w-]*\s*:\s*([^;}\n]+)/g },
  { label: 'React fontFamily', pattern: /fontFamily\s*:\s*['"`]([^'"`]+)['"`]/g },
  { label: 'SVG font-family 属性', pattern: /font-?[fF]amily=\{?['"`]([^'"`]+)['"`]/g },
  { label: 'Tailwind 任意值字体类', pattern: /\bfont-\[([^\]]+)\]/g },
]

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return skippedDirectoryNames.has(name) ? [] : filesUnder(full)
    if (!scannedExtensions.has(path.extname(name))) return []
    if (/\.(test|spec)\.[cm]?tsx?$/.test(name)) return []
    return [full]
  })
}

const problems = []
for (const file of filesUnder(packagesDir)) {
  const relative = path.relative(repoDir, file).split(path.sep).join('/')
  if (filesAllowedToNameFonts.has(relative)) continue
  const text = readFileSync(file, 'utf8')
  for (const { label, pattern } of fontValuePatterns) {
    for (const match of text.matchAll(pattern)) {
      const named = namedFontsIn(match[1])
      if (named.length === 0) continue
      const line = text.slice(0, match.index).split('\n').length
      problems.push(`${relative}:${line}  ${label}写了字体名 ${named.join('、')}：${match[0].trim()}`)
    }
  }
}

if (problems.length > 0) {
  console.error(`有 ${problems.length} 处写死了字体。组件只用 font-sans / font-heading / font-mono 类或 var(--font-sans) 等三个变量；确需固定字体的文件加进 filesAllowedToNameFonts 并写明为什么：\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`字体检查通过：packages/ 下没有写死的字体名（${[...filesAllowedToNameFonts.keys()].join('、')} 按约定固定字体）`)

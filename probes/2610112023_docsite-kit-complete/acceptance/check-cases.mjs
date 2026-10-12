// 样本数据校验：只检查 cases/ 里样本自身的契约（frontmatter 必填字段、评论快照与 range 自洽、
// people.json 字段与码唯一、feeds JSON 形状一致、三步重复文字序列的差分），不依赖验证站的任何实现。
// 用法：node check-cases.mjs   （在 acceptance/ 目录下；退出码 0 全过，1 有失败项）
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const casesDir = join(dirname(fileURLToPath(import.meta.url)), 'cases')
const results = []
const check = (ok, id, detail) => results.push({ ok, id, detail })
const read = (rel) => readFileSync(join(casesDir, rel), 'utf8')

function parseValue(raw) {
  const s = raw.trim()
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim()
    if (inner === '') return []
    const parts = []
    let depth = 0
    let cur = ''
    for (const ch of inner) {
      if (ch === '[') depth++
      if (ch === ']') depth--
      if (ch === ',' && depth === 0) {
        parts.push(cur)
        cur = ''
      } else cur += ch
    }
    parts.push(cur)
    return parts.map((p) => parseValue(p))
  }
  if (/^-?\d+$/.test(s)) return Number(s)
  return s
}

function frontmatterOf(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return null
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (kv) out[kv[1]] = parseValue(kv[2])
  }
  return out
}

const occurrences = (haystack, needle) => haystack.split(needle).length - 1

// ---- G1 页面与资源 ----
{
  const mdx = read('01-pages/resource-page.mdx')
  const fm = frontmatterOf(mdx)
  check(fm !== null && typeof fm.title === 'string' && fm.title.length > 0, 'G1-mdx-title', 'resource-page.mdx 要有 frontmatter title')
  check(mdx.includes('![方形示意图](./figure.svg)'), 'G1-mdx-image', 'resource-page.mdx 引用相对路径 figure.svg')
  check(read('01-pages/figure.svg').includes('<svg'), 'G1-figure', 'figure.svg 是 SVG')
  check(read('01-pages/shared-note.md').includes('shared-note.md'), 'G1-include', 'shared-note.md 有正文')

  const tsx = read('01-pages/demo.page.tsx')
  check(/export const meta = \{[^}]*title:/.test(tsx), 'G1-tsx-meta', 'demo.page.tsx 导出 meta.title')
  check(tsx.includes('./demo/counter-panel'), 'G1-tsx-import', 'demo.page.tsx 引用同目录组件')
  const panel = read('01-pages/demo/counter-panel.tsx')
  check(panel.includes('useState') && panel.includes('useEffect'), 'G1-tsx-interactive', 'counter-panel.tsx 有状态与 effect')
  check(panel.includes('加一') && panel.includes('未保存输入') && panel.includes('回首页') === false, 'G1-tsx-ui', 'counter-panel.tsx 提供计数与输入')

  const html = read('01-pages/html-figure.html')
  check(/<title>[^<]+<\/title>/.test(html), 'G1-html-title', 'html-figure.html 有 <title>')
  check(html.includes('color-scheme: light dark'), 'G1-html-scheme', 'html-figure.html 声明 color-scheme')
  check(html.includes('./html-figure.svg'), 'G1-html-image', 'html-figure.html 引用相对路径图片')
}

// ---- G2 A/B 集合与 Node 插件 ----
{
  const plugin = read('02-plugins/node-marker-remark-plugin.mjs')
  check(plugin.includes("from 'node:fs'"), 'G2-plugin-nodefs', '插件用 node:fs，保证 Node-only')
  check(plugin.includes('A-COLLECTION-NODE-MARKER'), 'G2-plugin-marker', '插件写入唯一标记 A-COLLECTION-NODE-MARKER')
  const proof = JSON.parse(read('02-plugins/package-proof.json'))
  check(typeof proof.name === 'string', 'G2-plugin-proof', 'package-proof.json 可解析')

  const a = read('02-plugins/collection-a.mdx')
  const b = read('02-plugins/collection-b.mdx')
  check(frontmatterOf(a)?.title !== undefined, 'G2-a-title', 'collection-a.mdx 有 title')
  check(frontmatterOf(b)?.title !== undefined, 'G2-b-title', 'collection-b.mdx 有 title')
  check(a.includes('A body base text'), 'G2-a-anchor', 'A 集合样本有正文锚段')
  check(b.includes('B body base text'), 'G2-b-anchor', 'B 集合样本有正文锚段')
  check(!b.includes('A-COLLECTION-NODE-MARKER'), 'G2-b-clean', 'B 集合样本源文件不含 A 的标记字符串')
}

// ---- G4 评论样本 ----
{
  // 完全相同的重复文本：信息不足的边界样本。删掉一句后单看文字分不出删的是哪一句，
  // 所以只此一步、不按删除意图写预期（G4-05 的预期按算法认定处描述）。
  const step1 = read('04-comments/duplicate-lines.step1-initial.mdx')
  const step2 = read('04-comments/duplicate-lines.step2-delete-one-occurrence.mdx')
  check(occurrences(step1, '同一句话。') === 3, 'G4-dup-step1', 'step1 恰好三句完全相同的话')
  check(occurrences(step2, '同一句话。') === 2, 'G4-dup-step2', 'step2 删掉一句后剩两句')
  check(step1.split('同一句话。')[0] === step2.split('同一句话。')[0], 'G4-dup-prefix', 'step2 与 step1 前文一致')
  check(step1.split('同一句话。').pop() === step2.split('同一句话。').pop(), 'G4-dup-suffix', 'step2 与 step1 后文一致')

  // 可区分邻接样本：三句重复各有唯一邻居，删前一处与删被批处是两份不同文本、两个明确预期。
  const d1 = read('04-comments/distinct-neighborhood.step1-initial.mdx')
  const d2 = read('04-comments/distinct-neighborhood.step2-delete-before-commented.mdx')
  const d3 = read('04-comments/distinct-neighborhood.step3-delete-commented.mdx')
  check(occurrences(d1, '同一句话。') === 3, 'G4-dst-step1-count', 'step1 恰好三句重复')
  check(!d1.includes('甲开头。乙居中。') && !d1.includes('乙居中。丙收尾。'), 'G4-dst-step1-separated', 'step1 的邻居词把三句隔开，互不相邻')
  check(occurrences(d2, '同一句话。') === 2 && d2.includes('甲开头。乙居中。'), 'G4-dst-step2-adjacency', 'step2 删了甲乙之间那句，甲乙直接相邻')
  check(!d2.includes('乙居中。丙收尾。'), 'G4-dst-step2-keep-batch', 'step2 被批处（乙丙之间）仍在')
  check(occurrences(d3, '同一句话。') === 2 && d3.includes('乙居中。丙收尾。'), 'G4-dst-step3-adjacency', 'step3 删了被批那句，乙丙直接相邻')
  check(!d3.includes('甲开头。乙居中。'), 'G4-dst-step3-keep-first', 'step3 甲乙之间那句仍在')
  check(d2 !== d3, 'G4-dst-steps-differ', '两种删除的最终文本不同，删除意图可从文字判定')

  const collapse = read('04-comments/collapse-target.mdx')
  check(collapse.includes('./collapse-target/aria-toggle') && collapse.includes('./collapse-target/plain-toggle'), 'G4-collapse-imports', 'collapse-target.mdx 引用两个展开组件')
  check(collapse.includes('aria 拿掉的一句话'), 'G4-collapse-anchor', 'collapse-target.mdx 含被批锚句')
  const aria = read('04-comments/collapse-target/aria-toggle.tsx')
  const plain = read('04-comments/collapse-target/plain-toggle.tsx')
  check(aria.includes('aria-expanded') && aria.includes('aria-controls'), 'G4-aria-attrs', 'ARIA 版组件带 aria-expanded 与 aria-controls')
  check(!plain.includes('aria-'), 'G4-plain-noaria', '反面样本确实没写 ARIA')

  const people = JSON.parse(read('05-identity/people.json'))
  const ids = new Set(people.map((p) => p.id))
  for (const thread of ['2026-10-11-duplicate-line-2', '2026-10-11-collapse-inside', '2026-10-11-distinct-second']) {
    const base = `04-comments/comments/${thread}`
    const index = read(`${base}/index.mdx`)
    const fm = frontmatterOf(index)
    check(fm !== null && typeof fm.author === 'string' && typeof fm.createdAt === 'string', `G4-${thread}-required`, 'index.mdx 有 author 与 createdAt')
    check(ids.has(fm.author), `G4-${thread}-author`, `author ${fm.author} 在 people.json 里`)
    check(typeof fm.page === 'string' && fm.page.startsWith('/'), `G4-${thread}-page`, 'page 以 / 开头')
    check(fm.quote === undefined || fm.element === undefined, `G4-${thread}-one-anchor`, 'quote 与 element 只写一个')
    check(Array.isArray(fm.range) && fm.range.length === 2, `G4-${thread}-range`, 'range 是 [开始, 结束]')
    const snapshot = read(`${base}/snapshot.txt`).replace(/\r\n/g, '\n')
    check(snapshot.length > 0, `G4-${thread}-snapshot`, 'snapshot.txt 非空')
    if (typeof fm.quote === 'string' && Array.isArray(fm.range)) {
      const sliced = snapshot.slice(fm.range[0], fm.range[1])
      check(sliced === fm.quote, `G4-${thread}-quote-slice`, `quote 要等于快照 range 那一段（得到 ${JSON.stringify(sliced)}）`)
    }
    if (Array.isArray(fm.openers)) {
      for (const opener of fm.openers) {
        check(
          Array.isArray(opener) && opener[0] >= 0 && opener[1] <= snapshot.length && opener[0] < opener[1],
          `G4-${thread}-opener-range`,
          `opener ${JSON.stringify(opener)} 在快照范围内`,
        )
      }
    }
    // 回复只允许 author 与 createdAt，不得有发起评论才有的字段
    const replies = ['reply-agree', 'reply-plain-toggle', 'reply-note']
    for (const name of replies) {
      try {
        const replyFm = frontmatterOf(read(`${base}/${name}.mdx`))
        if (!replyFm) continue
        const forbidden = ['page', 'quote', 'range', 'element', 'openers'].filter((k) => replyFm[k] !== undefined)
        check(forbidden.length === 0, `G4-${thread}-${name}-fields`, `回复不得带发起字段（发现 ${forbidden.join(', ')}）`)
        check(ids.has(replyFm.author), `G4-${thread}-${name}-author`, `回复 author ${replyFm.author} 在 people.json 里`)
      } catch {
        // 这个串没有这条回复，跳过
      }
    }
  }
}

// ---- G5 身份样本 ----
{
  const people = JSON.parse(read('05-identity/people.json'))
  check(Array.isArray(people) && people.length >= 3, 'G5-people-shape', 'people.json 至少三个人（两人一 agent）')
  const seenCodes = new Set()
  for (const person of people) {
    check(/^[A-Za-z0-9_-]+$/.test(person.id ?? ''), 'G5-people-id', `id ${person.id} 字符合法`)
    check(typeof person.name === 'string' && person.name.length > 0, 'G5-people-name', `${person.id} 有 name`)
    if (person.agent) {
      check(person.codes === undefined, 'G5-agent-no-codes', `agent ${person.id} 不写 codes`)
    } else {
      check(Array.isArray(person.codes) && person.codes.length > 0, 'G5-person-codes', `人员 ${person.id} 有 codes`)
      for (const code of person.codes ?? []) {
        check(/^[0-9a-z]{12}$/.test(code), 'G5-code-format', `身份码 ${code} 是 12 位小写字母数字`)
        check(!seenCodes.has(code), 'G5-code-unique', `身份码 ${code} 不重复`)
        seenCodes.add(code)
      }
    }
  }
  const http = read('05-identity/rejected-writes.http')
  check(occurrences(http, /^### /m) >= 4, 'G5-http-cases', '拒写样例至少四条')
  check(http.includes('Origin: http://evil.example') && http.includes('403'), 'G5-http-origin', '有伪造 Origin 与 403 预期')
  check(http.includes('as=zhou') && http.includes('as=acceptance-agent'), 'G5-http-as', '覆盖 as 冒充人员与 as 声明 agent')
}

// ---- G6 feeds 样本 ----
{
  const stages = ['demo.step0-initial.json', 'demo.step1-edited.json', 'demo.step2-readded.json']
  const parsed = stages.map((name) => {
    const data = JSON.parse(read(`06-feeds/feeds/${name}`))
    check(typeof data.message === 'string' && typeof data.seq === 'number', 'G6-feed-shape', `${name} 有 message 与 seq`)
    return data
  })
  const messages = new Set(parsed.map((d) => d.message))
  check(messages.size === stages.length, 'G6-feed-distinct', '三个阶段的 message 互不相同，页面才能区分')
  const keySet = (d) => Object.keys(d).sort().join(',')
  check(parsed.every((d) => keySet(d) === keySet(parsed[0])), 'G6-feed-keys-same', '同一频道的 JSON 顶层键一致')
}

// ---- 汇总 ----
const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(28)} ${r.detail}`)
console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
if (failed.length > 0) {
  console.log(`失败 ${failed.length} 项，见上`)
  process.exit(1)
}

// 统计行内公式里能写成纯文本（斜体字母、上下标、希腊字母、单位、简单运算符）的有多少：node inline-coverage.mjs <content.json>
import fs from 'node:fs'

const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const simpleCommands = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'eta', 'theta', 'lambda', 'mu', 'pi', 'rho', 'sigma', 'tau', 'varphi', 'phi', 'omega', 'Delta', 'Omega', 'Phi',
  'mathrm', 'text', 'cdot', 'times', 'approx', 'le', 'leq', 'ge', 'geq', 'pm', 'infty', 'circ', 'sim', 'ne', 'neq', 'to', 'quad', 'mathit', 'ldots', 'cdots', 'prime', '%', ',', ';', ' '])
const verdict = (tex) => {
  const commands = [...tex.matchAll(/\\([A-Za-z]+|.)/g)].map((m) => m[1])
  const blocked = commands.filter((c) => !simpleCommands.has(c))
  return blocked.length ? blocked : null
}
const inline = []
;(function walk(v) {
  if (Array.isArray(v)) return v.forEach(walk)
  if (!v || typeof v !== 'object') return
  if (v.type === 'math') inline.push(v.latex)
  Object.values(v).forEach(walk)
})(doc.blocks)
const blockedBy = new Map()
let plain = 0
const plainDistinct = new Set(), mathDistinct = new Set()
for (const tex of inline) {
  const blocked = verdict(tex)
  if (!blocked) { plain++; plainDistinct.add(tex); continue }
  mathDistinct.add(tex)
  for (const c of new Set(blocked)) blockedBy.set(c, (blockedBy.get(c) ?? 0) + 1)
}
console.log(`行内 ${inline.length} 个：能写成纯文本 ${plain}（不同的 ${plainDistinct.size}），要 MathType ${inline.length - plain}（不同的 ${mathDistinct.size}）`)
console.log('要 MathType 的原因（命令 × 出现在几个式子里）：', [...blockedBy].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, n]) => `\\${c}×${n}`).join(' '))
console.log('要 MathType 的样例：', [...mathDistinct].slice(0, 12).join('   '))

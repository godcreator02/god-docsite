// 从导出输入里取若干顶层章做测时样本：node make-sample.mjs <导出 input 目录> <样本目录> <章 id…>
// 指向样本外的交叉引用改成同样长度的文字；文献表整份保留
import fs from 'node:fs'
import path from 'node:path'

const [input, sample, ...chapters] = process.argv.slice(2)
const doc = JSON.parse(fs.readFileSync(path.join(input, 'content.json'), 'utf8'))
doc.blocks = doc.blocks.filter((b) => chapters.includes(b.id) || b.type === 'bibliography')

const kept = new Set()
;(function collect(v) {
  if (Array.isArray(v)) return v.forEach(collect)
  if (!v || typeof v !== 'object') return
  if (typeof v.id === 'string') kept.add(v.id)
  Object.values(v).forEach(collect)
})(doc.blocks)
let dropped = 0
;(function rewrite(v) {
  if (Array.isArray(v)) {
    v.forEach((it, k) => { if (it?.type === 'ref' && !kept.has(it.target)) { v[k] = { type: 'text', text: '第 x 节' }; dropped++ } })
    return v.forEach(rewrite)
  }
  if (!v || typeof v !== 'object') return
  Object.values(v).forEach(rewrite)
})(doc.blocks)

fs.mkdirSync(sample, { recursive: true })
fs.writeFileSync(path.join(sample, 'content.json'), JSON.stringify(doc, null, 2) + '\n')
fs.cpSync(path.join(input, 'assets'), path.join(sample, 'assets'), { recursive: true })
console.log('章', chapters.join(','), '样本外引用改成文字', dropped)

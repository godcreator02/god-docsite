// 把 results/*.json 汇总成 results/summary.md：每个方案 × 规模 × 内容类型一行，时间都从写入文件那一刻算起
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const resultsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results')
const kindNames = { page: '新正文页', journal: '新日志', comment: '新评论', card: '新轨迹卡' }

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function timingCell(values, total) {
  const present = values.filter((value) => value !== null)
  if (present.length === 0) return `未出现（0/${total}）`
  const missing = total - present.length
  return `${median(present)} / ${Math.max(...present)}${missing > 0 ? `（${missing} 次未出现）` : ''}`
}

const files = (await readdir(resultsDir)).filter((file) => file.endsWith('.json')).sort()
const rows = []
for (const file of files) {
  const result = JSON.parse(await readFile(path.join(resultsDir, file), 'utf8'))
  for (const [kind, records] of Object.entries(result.records)) {
    const manualReloadShows = records.filter((record) => record.showsAfterManualReload === true).length
    rows.push(
      `| ${result.variant} | ${result.pages === null ? '真实站点' : `${result.size}（${result.pages} 页）`} | ${kindNames[kind]} | ${timingCell(records.map((r) => r.httpMs), records.length)} | ${records.every((r) => r.domMs === null && r.showsAfterManualReload === null) ? '不测' : timingCell(records.map((r) => r.domMs), records.length)} | ${manualReloadShows > 0 ? `手动刷新后出现 ${manualReloadShows} 次` : ''} | ${result.startupMs} |`,
    )
  }
}

const summary = `# 汇总

时间单位毫秒，从写入文件那一刻算起，格式「中位数 / 最慢」。等待上限：一般方案 10 秒，重启类方案 60 秒，docs-site 15 秒。

| 方案 | 规模 | 内容 | 新地址返回 200 | 已打开页面里出现 | 备注 | 开发服务冷启动 |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`
await writeFile(path.join(resultsDir, 'summary.md'), summary)
console.log(summary)

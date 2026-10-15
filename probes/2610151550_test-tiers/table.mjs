// 用法：node table.mjs <报告目录> [列出单条测试的阈值毫秒]
// 每个测试文件一行：vitest 报告里的文件耗时（不含启动与 import）、用例数、相对仓根的路径；按耗时从大到小
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const testThreshold = Number(process.argv[3] ?? 1000)
const repoRoot = path.resolve(import.meta.dirname, '../..').replaceAll('\\', '/') + '/'
const rows = []
for (const file of readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'summary.json')) {
  const report = JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
  for (const result of report.testResults) {
    const rel = result.name.replaceAll('\\', '/').replace(repoRoot, '')
    const tests = result.assertionResults.map((test) => ({ title: test.fullName, ms: test.duration ?? 0, status: test.status }))
    rows.push({ rel, ms: result.endTime - result.startTime, tests })
  }
}
rows.sort((a, b) => b.ms - a.ms)
for (const row of rows) {
  console.log(`${(row.ms / 1000).toFixed(2).padStart(7)}s  ${String(row.tests.length).padStart(3)}  ${row.rel}`)
  for (const test of row.tests.filter((t) => t.ms >= testThreshold).sort((a, b) => b.ms - a.ms)) {
    console.log(`            ${(test.ms / 1000).toFixed(2).padStart(6)}s  ${test.status}  ${test.title}`)
  }
}
const total = rows.reduce((sum, row) => sum + row.ms, 0)
console.log(`合计（文件耗时相加）${(total / 1000).toFixed(1)}s，${rows.length} 个文件`)

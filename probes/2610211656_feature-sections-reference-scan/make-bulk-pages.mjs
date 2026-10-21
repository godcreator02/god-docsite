// 在 site/content/bulk/ 下写 24 页填充页（每页约 6 KB，带两处引用），让站点有 26 个内容页，用来量引用扫描的耗时
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = path.join(import.meta.dirname, 'site', 'content', 'bulk')
mkdirSync(dir, { recursive: true })
const paragraph = '模块化多电平变换器的子模块电容电压要保持均衡，桥臂环流里的二倍频分量会增加损耗。控制上常用比例谐振控制器抑制环流，再配合排序法均压。'
for (let index = 1; index <= 24; index++) {
  const name = `page-${String(index).padStart(2, '0')}`
  const sections = Array.from({ length: 6 }, (_, section) => `## 第 ${section + 1} 节\n\n${paragraph.repeat(5)}\n\n$$\nP = \\frac{1}{T}\\int_0^T u(t)\\,i(t)\\,dt\n$$\n`)
  const body = `---\ntitle: 填充页 ${index}\n---\n\n见 <Ref id="76226df0-ba91-4a4f-8068-8942aa272910">环流抑制</Ref> 与 <Note id="791a3e43-e070-4cea-a452-b7b68db9230b">错误处理</Note>。\n\n${sections.join('\n')}`
  writeFileSync(path.join(dir, `${name}.mdx`), body)
}
console.log(`写了 24 页到 ${dir}`)

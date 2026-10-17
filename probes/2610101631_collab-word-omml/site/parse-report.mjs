import {readFile, writeFile} from 'node:fs/promises'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import katex from 'katex'
const [input, output] = process.argv.slice(2)
let source = await readFile(input, 'utf8')
source = source.replace(/^import \{ ReportExport \} from '\.\/ReportExport'\r?\n/m, '').replace(/^<ReportExport \/>\r?\n/m, '')
// The report contract is Markdown + math; only this one MDX metadata export is allowed.
source = source.replace(/^export const meta = .*\r?\n/m, '')
source = source.replace(/^\{\/\* section:([a-z-]+) \*\/\}$/gm, '<!-- section:$1 -->')
if (/^(import|export)\s/m.test(source)) throw Error('报告不支持执行 MDX 代码')
const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(source)
function walk(node) {
  if (node.type === 'math' || node.type === 'inlineMath') {
    node.mathml = katex.renderToString(node.value, {output:'mathml', displayMode:node.type==='math', throwOnError:true, strict:'error'})
  }
  delete node.position
  for(const child of node.children ?? []) walk(child)
}
walk(tree)
await writeFile(output, JSON.stringify(tree, null, 2))

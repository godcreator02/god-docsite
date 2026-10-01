// 在一个组合目录里运行：用那里装好的 fumadocs-core 的 defaultStringifier 序列化几段 markdown，看粗体会不会无限递归。
// stringifier.js 不在 fumadocs-core 的 exports 里，按文件路径取。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const caseDir = process.cwd()
const modules = path.join(caseDir, 'node_modules')
const versionOf = (name) => JSON.parse(fs.readFileSync(path.join(fs.realpathSync(path.join(modules, name)), 'package.json'), 'utf8')).version
const toMarkdownDir = fs.realpathSync(path.join(fs.realpathSync(path.join(modules, 'fumadocs-core')), '..', 'mdast-util-to-markdown'))

const { fromMarkdown } = await import(pathToFileURL(path.join(fs.realpathSync(path.join(modules, 'mdast-util-from-markdown')), 'index.js')).href)
const { defaultStringifier } = await import(pathToFileURL(path.join(fs.realpathSync(path.join(modules, 'fumadocs-core')), 'dist', 'mdx-plugins', 'stringifier.js')).href)

console.log(`fumadocs-core ${versionOf('fumadocs-core')}，它用的 mdast-util-to-markdown ${JSON.parse(fs.readFileSync(path.join(toMarkdownDir, 'package.json'), 'utf8')).version}`)

const samples = {
  粗体后跟全角冒号: '**本页回答**：这个项目里反复出现的词各指什么。',
  粗体在句中: '前面 **粗体** 后面',
  整行粗体: '**粗体**',
  斜体: '前面 *斜体* 后面',
  没有强调: '没有粗体',
}

for (const [name, text] of Object.entries(samples)) {
  try {
    const out = defaultStringifier().call({ data: () => undefined }, fromMarkdown(text), {})
    console.log(`  ${name}：通过 ${JSON.stringify(out.trim())}`)
  } catch (error) {
    console.log(`  ${name}：失败 ${error.name}: ${error.message}`)
  }
}

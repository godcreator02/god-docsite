// 从自述站派生建站用的骨架模板：site/ 是正本（app/ 与根目录的配置手写），这里的 template/ 是构建产物、随插件发布。
// 改骨架先改 site/，插件 build 会重新派生。起始物（people.json、glossary.terms.ts）是每个新站的第一份，写死在这里，不来自自述站。
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const siteDir = path.join(pluginDir, '..', '..', 'site')
const templateDir = path.join(pluginDir, 'template')

rmSync(templateDir, { recursive: true, force: true })
mkdirSync(templateDir, { recursive: true })

// 骨架：app/ 整棵与根目录的配置文件。app/site/ 由建站时按 docsite.features 现算，不进模板
cpSync(path.join(siteDir, 'app'), path.join(templateDir, 'app'), { recursive: true })
rmSync(path.join(templateDir, 'app', 'site'), { recursive: true, force: true })
for (const file of ['package.json', 'vite.config.ts', 'source.config.ts', 'react-router.config.ts', 'tsconfig.json']) {
  cpSync(path.join(siteDir, file), path.join(templateDir, file))
}
// npm 发布不带点开头的文件，模板里写成 gitignore，写进站点时改回 .gitignore
cpSync(path.join(siteDir, '.gitignore'), path.join(templateDir, 'gitignore'))

mkdirSync(path.join(templateDir, 'initial'), { recursive: true })
writeFileSync(path.join(templateDir, 'initial', 'people.json'), '[]\n')
writeFileSync(
  path.join(templateDir, 'initial', 'glossary.terms.ts'),
  `import type { TermEntry } from '@godcreator/docsite-writing/compile'

/** 站点自己的术语表正本：source.config.ts（Node-only）读它建索引，浏览器端不加载。改这里即时生效 */
export const terms: TermEntry[] = []
`,
)

console.log(`[docsite] template/ ← site/ 派生：${readdirSync(templateDir).sort().join('、')}`)

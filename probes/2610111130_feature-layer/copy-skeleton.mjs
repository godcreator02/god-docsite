// 把自述站的骨架（app/ 与根目录的配置）复制进试验站点：node copy-skeleton.mjs <自述站目录> <试验站点目录>
import { cpSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const [kitSite, probeSite] = process.argv.slice(2)
if (!kitSite || !probeSite) throw new Error('用法：node copy-skeleton.mjs <自述站目录> <试验站点目录>')
mkdirSync(probeSite, { recursive: true })
for (const entry of ['app', 'react-router.config.ts', 'tsconfig.json', 'vite.config.ts']) {
  cpSync(path.join(kitSite, entry), path.join(probeSite, entry), { recursive: true })
}
console.log('复制好了', probeSite)

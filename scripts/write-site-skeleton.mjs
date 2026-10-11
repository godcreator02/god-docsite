// 照基础包的模板重新生成自述站的 app/ 与根目录的配置：改了 packages/docsite-kit/template/ 之后运行（pnpm site:skeleton 先构建基础包）
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeSiteSkeleton } from '../packages/docsite-kit/dist/init.js'

const siteDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site')
const { features, manifestChanged } = writeSiteSkeleton(siteDir)
console.log(`写好了 ${siteDir}：功能包 ${features.length === 0 ? '无' : features.join('、')}${manifestChanged ? '；package.json 改了，运行 pnpm install' : ''}`)

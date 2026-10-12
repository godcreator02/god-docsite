import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** node 侧由 tsc 逐个文件输出（build 脚本里紧接着的那步）；这里只清掉上一次构建留下的文件，它们会随 files 白名单一起发出去 */
const here = path.dirname(fileURLToPath(import.meta.url))
fs.rmSync(path.join(here, 'dist'), { recursive: true, force: true })
console.log('[gwb-docfirst-workflow] 清掉旧 dist')

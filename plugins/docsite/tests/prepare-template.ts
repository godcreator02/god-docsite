import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 每个测试文件跑之前重新派生一遍骨架模板（幂等）：测试读到的 template/ 永远与自述站一致，也不依赖先跑过 build
const pluginDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
execFileSync('node', [path.join(pluginDir, 'scripts', 'sync-template.mjs')])

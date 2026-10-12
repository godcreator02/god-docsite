import fs from 'node:fs'

// tsdown 打包 re-export 时会丢 "use client" 指令（MODULE_LEVEL_DIRECTIVE）：构建后把它写回产物头一行
const file = 'dist/index.mjs'
let text = fs.readFileSync(file, 'utf8')
if (!text.startsWith('"use client";')) fs.writeFileSync(file, `"use client";\n${text}`)

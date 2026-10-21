#!/usr/bin/env node
/**
 * docsite-check：在站点目录里跑提交前的检查——内容目录的放法，与 shared 站的自包含（引用的条目本站都有）。
 * 和 build 时 vite 插件查的是同一份；都过了打印一行、退出码 0，有问题逐条打印、退出码 1
 */
import path from 'node:path'
import { misplacedContentFilesOf } from '../node/content-layout.js'
import { selfContainedProblemLine, selfContainedProblemsOf } from '../node/references.js'

if (process.argv.length > 2) {
  console.error(`docsite-check 不收参数，收到 ${process.argv.slice(2).join(' ')}：在站点目录里直接运行`)
  process.exit(2)
}
const siteDir = process.cwd()
const misplaced = misplacedContentFilesOf(path.join(siteDir, 'content'))
const notSelfContained = await selfContainedProblemsOf(siteDir)
if (misplaced.length === 0 && notSelfContained.length === 0) {
  console.log(`docsite-check：${siteDir} 通过（内容放法、自包含）`)
  process.exit(0)
}
if (misplaced.length > 0) console.error(`内容目录 content 里有 ${misplaced.length} 个文件放错了位置：\n${misplaced.map((problem) => `  ${problem}`).join('\n')}`)
if (notSelfContained.length > 0) console.error(`有 ${notSelfContained.length} 处引用不自包含，组员打开会是「本站没有这条」：\n${notSelfContained.map((problem) => `  ${selfContainedProblemLine(problem)}`).join('\n')}`)
process.exit(1)

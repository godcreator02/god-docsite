import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { siteProtocol, siteProtocolSince } from '@godcreator/collab-model/notification-model'
import { collabSiteProblems } from '@godcreator/collab-site/site-check'
import { CollabRejected } from '../errors.js'

/** 功能包的包名：到 site/node_modules 里找项目装的那一版 */
export const featurePackage = '@godcreator/collab-site'

function readJsonFile(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new CollabRejected(`${file} 读不出：${error instanceof Error ? error.message : String(error)}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ansiEscapePattern = /\u001b\[[0-9;]*m/g

/** 输出的最后几行，去掉颜色控制符与空行 */
export function lastLinesOf(output: string, lineCount = 10): string {
  return output
    .replace(ansiEscapePattern, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(-lineCount)
    .join('\n')
}

/**
 * site/ 装的功能包和本插件是不是同一个站点协议号：推给站点的数据的形状、记录格式跟着它走，对不上时站点读不懂插件推的数据。
 * 没装、对不上都拒绝，写明怎么改
 */
export function requireSameSiteProtocol(siteDir: string): void {
  const manifestFile = path.join(siteDir, 'node_modules', ...featurePackage.split('/'), 'package.json')
  if (!existsSync(manifestFile)) throw new CollabRejected(`site/ 里没装 ${featurePackage}：在 site/ 里运行 pnpm install`)
  const manifest = readJsonFile(manifestFile)
  const version = isRecord(manifest) ? manifest['version'] : undefined
  const installed = isRecord(manifest) ? manifest['collabSiteProtocol'] : undefined
  if (installed === siteProtocol) return
  const described = `site/ 装的 ${featurePackage} ${String(version)} 的站点协议号是 ${installed === undefined ? '（没写）' : String(installed)}，本插件是 ${siteProtocol}`
  if (typeof installed === 'number' && installed > siteProtocol) throw new CollabRejected(`${described}：升级 gwb-collab 插件`)
  throw new CollabRejected(`${described}：把 site/package.json 里 ${featurePackage} 的范围改成 ^${siteProtocolSince}，在 site/ 里运行 pnpm install，锁文件一起提交审核`)
}

/**
 * 交给 gwb-docsite 托管之前的检查：协议号对得上、站点检查（人员列表、评论、日志页的文件名）没有问题。
 * 不过就拒绝，写明每条问题；gwb-docsite 启动前自己还会查装没装依赖与基础包的那部分
 */
export async function requireCollabSitePasses(siteDir: string): Promise<void> {
  requireSameSiteProtocol(siteDir)
  const problems = await collabSiteProblems(siteDir)
  if (problems.length === 0) return
  throw new CollabRejected(
    `site/ 的站点检查不过，没有启动站点：\n${problems.join('\n')}\n照每条说的改好 site/ 里的文件，提交审核合进 main；自动同步拿到修好的版本会再查一遍，通过就启动。本机改好了也可以用 collab.site.start 启动`,
  )
}

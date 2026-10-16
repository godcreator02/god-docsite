import { copyFile, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mdxReportPlanOf } from '../core/mdx/index.ts'
import type { ReportDocument } from '../core/types.ts'
import { stableValue } from '../core/validate.ts'
import { readReport } from './read-report.ts'
import { isMdxEntry, reportEntryIn, reportEntryOf, reportsDirName } from './report-files.ts'

export type ConvertReportResult =
  | { converted: true; targetDir: string; files: string[] }
  | { converted: false; reason: string; problems: string[] }

const MAX_LISTED_DIFFERENCES = 20

async function exists(file: string): Promise<boolean> {
  return stat(file).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return false
    throw error
  })
}

async function layoutOf(reportDir: string): Promise<{ bytes: Buffer; keys: string[] } | undefined> {
  const file = path.join(reportDir, 'layout.json')
  if (!(await exists(file))) return undefined
  const bytes = await readFile(file)
  return { bytes, keys: Object.keys(JSON.parse(bytes.toString('utf8')) as Record<string, unknown>) }
}

const MARK_ORDER = ['strong', 'em', 'sub', 'sup', 'code']

/**
 * 比对用的样子：只留写出来的 id（其余由编译器重新生成）、图片路径只看文件名、文档 id 不比、
 * 相邻且标记相同的文字合并、标记按固定顺序、有序列表的起始数 1 不写、没有块的单元格当成一个空段（MDX 的空格子编译成空段，Word 里两者一样）
 */
function comparable(document: ReportDocument, keptIds: Set<string>): unknown {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const items = value.map(normalize) as Record<string, unknown>[]
      const merged: Record<string, unknown>[] = []
      for (const item of items) {
        const previous = merged.at(-1)
        if (item?.['type'] === 'text' && previous?.['type'] === 'text' && stableValue(previous['marks'] ?? []) === stableValue(item['marks'] ?? [])) previous['text'] = `${previous['text'] as string}${item['text'] as string}`
        else merged.push(item)
      }
      return merged
    }
    if (!value || typeof value !== 'object') return value
    const copy: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' && !keptIds.has(child as string)) continue
      if (key === 'src' && typeof child === 'string') copy[key] = child.slice(child.lastIndexOf('/') + 1)
      else if (key === 'marks' && Array.isArray(child)) copy[key] = MARK_ORDER.filter((mark) => child.includes(mark))
      else copy[key] = normalize(child)
    }
    if (copy['type'] === 'list' && copy['start'] === 1) delete copy['start']
    if (Array.isArray(copy['cells'])) for (const cell of copy['cells'] as Record<string, unknown>[]) if ((cell['blocks'] as unknown[]).length === 0) cell['blocks'] = [{ type: 'paragraph', content: [] }]
    return copy
  }
  const { id: _documentId, ...rest } = document
  return normalize(rest)
}

function differencesOf(before: unknown, after: unknown, pointer = ''): string[] {
  if (stableValue(before) === stableValue(after)) return []
  const bothArrays = Array.isArray(before) && Array.isArray(after)
  const bothObjects = !bothArrays && before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)
  if (bothArrays && before.length === after.length) return before.flatMap((item, index) => differencesOf(item, after[index], `${pointer}/${index}`))
  if (bothObjects) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    return keys.flatMap((key) => differencesOf((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], `${pointer}/${key}`))
  }
  return [`${pointer || '/'}：原报告 ${JSON.stringify(before)}，转回来 ${JSON.stringify(after)}`]
}

/**
 * 把一份 JSON 报告转成一份新的 MDX 报告（reports/<新 id>/），不动原报告。
 * 原报告里有 MDX 写不出的内容就一个文件都不写；写完编译回来和原报告逐项比对，对不上就删掉新目录
 */
export async function convertReportToMdx(siteDir: string, sourceId: string, targetId: string): Promise<ConvertReportResult> {
  const site = await realpath(siteDir)
  const sourceEntry = await reportEntryIn(site, sourceId)
  if (isMdxEntry(sourceEntry)) throw new Error(`报告 ${sourceId} 已经是 MDX 报告`)
  if (!/^[a-z]/.test(targetId)) throw new Error(`新报告 id「${targetId}」要以字母开头：MDX 报告的目录名就是文档 id`)
  const targetDir = path.join(site, path.dirname(reportEntryOf(targetId)))
  if (await exists(targetDir)) throw new Error(`reports/${targetId} 已经存在：convert 只写新目录`)
  const source = await readReport(path.join(site, sourceEntry), { root: site, mode: 'complete' })
  const layout = await layoutOf(path.join(site, reportsDirName, sourceId))
  const plan = mdxReportPlanOf(source.document, source.assets, layout?.keys ?? [])
  if (plan.problems.length) return { converted: false, reason: `原报告里有 ${plan.problems.length} 处 MDX 写不出来，没有写任何文件`, problems: plan.problems }
  await mkdir(path.join(targetDir, 'assets'), { recursive: true })
  const written: string[] = []
  try {
    for (const [name, text] of Object.entries(plan.files)) {
      await writeFile(path.join(targetDir, name), text)
      written.push(name)
    }
    for (const [name, compiledPath] of Object.entries(plan.images)) {
      await copyFile(path.join(site, source.assets[compiledPath]!), path.join(targetDir, 'assets', name))
      written.push(`assets/${name}`)
    }
    if (layout) {
      await writeFile(path.join(targetDir, 'layout.json'), layout.bytes)
      written.push('layout.json')
    }
    let converted
    try {
      converted = await readReport(path.join(targetDir, 'index.mdx'), { root: site, mode: 'complete' })
    } catch (error) {
      await rm(targetDir, { recursive: true, force: true })
      return { converted: false, reason: '转出来的 MDX 编译不过，已删掉新目录', problems: [error instanceof Error ? error.message : String(error)] }
    }
    const differences = differencesOf(comparable(source.document, plan.keptIds), comparable(converted.document, plan.keptIds))
    if (differences.length) {
      await rm(targetDir, { recursive: true, force: true })
      return { converted: false, reason: `转回来和原报告有 ${differences.length} 处对不上，已删掉新目录`, problems: differences.slice(0, MAX_LISTED_DIFFERENCES) }
    }
  } catch (error) {
    await rm(targetDir, { recursive: true, force: true })
    throw error
  }
  return { converted: true, targetDir, files: written.sort() }
}

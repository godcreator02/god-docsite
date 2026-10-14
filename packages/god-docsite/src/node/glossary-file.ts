import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { buildTermIndex, type TermEntry, type TermIndex } from '../core/glossary.js'

const entryKeys = ['term', 'aliases', 'def', 'href']

/** 校验术语表文件的内容：一个数组，每项 { term, def, aliases?, href? }；写错时一次列出全部 */
export function parseGlossary(value: unknown, file: string): TermEntry[] {
  if (!Array.isArray(value)) throw new Error(`术语表 ${file} 要是一个数组，每项写 { "term": "身份码", "def": "……" }`)
  const problems: string[] = []
  value.forEach((item: unknown, index) => {
    const where = `术语表 ${file} 第 ${index + 1} 项`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return problems.push(`${where} 要是 { "term": …, "def": … }`)
    const record = item as Record<string, unknown>
    for (const key of Object.keys(record)) if (!entryKeys.includes(key)) problems.push(`${where}：认不出 ${key}，能写的只有 ${entryKeys.join('、')}`)
    if (typeof record['term'] !== 'string' || record['term'].trim() === '') problems.push(`${where}：term 要是非空字符串`)
    if (typeof record['def'] !== 'string' || record['def'].trim() === '') problems.push(`${where}：def 要是非空字符串`)
    if (record['href'] !== undefined && typeof record['href'] !== 'string') problems.push(`${where}：href 要是字符串`)
    const aliases = record['aliases']
    if (aliases !== undefined && (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string'))) problems.push(`${where}：aliases 要是字符串数组`)
  })
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return value as TermEntry[]
}

function readGlossaryFile(file: string): TermEntry[] {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`术语表 ${file} 不是 JSON：${error.message}`)
    throw error
  }
  return parseGlossary(value, file)
}

const indexByFile = new Map<string, { modifiedAt: number; index: TermIndex }>()

/** 术语表文件建好的索引：按修改时间缓存，文件改了重建 */
export function glossaryIndexOfFile(file: string): TermIndex {
  const absolute = path.resolve(file)
  const modifiedAt = statSync(absolute).mtimeMs
  const cached = indexByFile.get(absolute)
  if (cached?.modifiedAt === modifiedAt) return cached.index
  const index = buildTermIndex(readGlossaryFile(absolute))
  indexByFile.set(absolute, { modifiedAt, index })
  return index
}

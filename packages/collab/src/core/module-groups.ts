import { isPlainObject } from './plain-object.js'
import { CollabFormatError, isModuleGroupId } from './records.js'

/** 模块的一个分组：任务页上一组画一张甘特图。id 写进模块记录的 group 字段，title 是那张图的标题 */
export type ModuleGroup = { id: string; title: string }

/** 分组列表的文件，相对 collab/；没有这个文件就不分组，任务页只画一张甘特图 */
export const moduleGroupsFile = 'groups.json'

function checkGroup(value: unknown, index: number): ModuleGroup {
  const at = `collab/${moduleGroupsFile} 第 ${index + 1} 项`
  if (!isPlainObject(value)) throw new CollabFormatError(`${at}要是 { "id", "title" } 对象`)
  const unknownKey = Object.keys(value).find((key) => key !== 'id' && key !== 'title')
  if (unknownKey !== undefined) throw new CollabFormatError(`${at}里认不出的字段 ${unknownKey}，只有 id 与 title`)
  if (!isModuleGroupId(value.id)) throw new CollabFormatError(`${at}的 id 要是小写字母、数字，用 - 连接，收到 ${JSON.stringify(value.id)}`)
  if (typeof value.title !== 'string' || value.title.trim() === '') throw new CollabFormatError(`${at}的 title 要是非空字符串`)
  return { id: value.id, title: value.title }
}

function rejectRepeated(groups: ModuleGroup[], key: 'id' | 'title') {
  const repeated = groups.find((group, index) => groups.findIndex((other) => other[key] === group[key]) !== index)
  if (repeated) throw new CollabFormatError(`collab/${moduleGroupsFile} 里 ${key} 「${repeated[key]}」写了不止一次`)
}

/** 解析 collab/groups.json：至少一组，id 与 title 都不重复；先后就是任务页上各张甘特图的先后 */
export function parseModuleGroups(text: string): ModuleGroup[] {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new CollabFormatError(`collab/${moduleGroupsFile} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(value)) throw new CollabFormatError(`collab/${moduleGroupsFile} 要是分组的数组`)
  if (value.length === 0) throw new CollabFormatError(`collab/${moduleGroupsFile} 至少要列一组；不分组就删掉这个文件`)
  const groups = value.map(checkGroup)
  rejectRepeated(groups, 'id')
  rejectRepeated(groups, 'title')
  return groups
}

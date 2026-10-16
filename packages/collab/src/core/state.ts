import { moduleGroupsFile, parseModuleGroups, type ModuleGroup } from './module-groups.js'
import { parsePeople } from './people.js'
import { CollabFormatError, decodeRecordFile, encodeRecordFile, type CollabRecord, type ModuleRecord, type TaskRecord } from './records.js'

/** 协作仓的一份内容：people 是 site/people.json 的原文（没有就是 null），files 的键是相对 collab/ 的路径 */
export type CollabSnapshot = { people: string | null; files: Record<string, string> }

/** collab/ 里的一处问题：出在哪个文件、问题是什么 */
export type CollabProblem = { file: string; message: string }

/** 读出来的一条记录，连同它所在的文件与文件原文 */
export type LocatedRecord = { record: CollabRecord; file: string; text: string }

const recordFilePattern = /^records\/([^/]+)\.json$/

/** 记录文件 records/<id>.json 文件名里的 id；路径不是这个样子时为 null */
export function recordIdOfPath(file: string): string | null {
  return recordFilePattern.exec(file)?.[1] ?? null
}

export function recordFileOf(id: string): string {
  return `records/${id}.json`
}

/** 解码指定的记录文件；分组列表不是记录、跳过，别的不在 records/<id>.json 的文件和读不出的文件列成问题，不猜它本来是什么 */
export function readRecords(snapshot: CollabSnapshot, files: string[] = Object.keys(snapshot.files)): { records: LocatedRecord[]; problems: CollabProblem[] } {
  const records: LocatedRecord[] = []
  const problems: CollabProblem[] = []
  for (const file of files) {
    if (file === moduleGroupsFile) continue
    if (recordIdOfPath(file) === null) {
      problems.push({ file, message: `认不出的文件：collab/ 下只能有 records/<记录 id>.json 与 ${moduleGroupsFile}` })
      continue
    }
    const text = snapshot.files[file]!
    try {
      records.push({ record: decodeRecordFile(text), file, text })
    } catch (error) {
      if (!(error instanceof CollabFormatError)) throw error
      problems.push({ file, message: error.message })
    }
  }
  return { records, problems }
}

export type TaskState = Omit<TaskRecord, 'type'>
export type ModuleState = Omit<ModuleRecord, 'type'>
/** groups 是 collab/groups.json 列的分组，没有这个文件或读不出时为空 */
export type CollabState = { tasks: TaskState[]; modules: ModuleState[]; groups: ModuleGroup[]; problems: CollabProblem[] }

/**
 * 读分组列表：没有文件时 declaredIds 是空集（模块写了分组就是指向不存在的分组）；
 * 文件在却读不出时 declaredIds 为 null，已经报过读不出，模块的分组不再逐个报
 */
function readModuleGroups(snapshot: CollabSnapshot, readable: boolean): { groups: ModuleGroup[]; declaredIds: ReadonlySet<string> | null; problems: CollabProblem[] } {
  const text = snapshot.files[moduleGroupsFile]
  if (text === undefined) return { groups: [], declaredIds: new Set(), problems: [] }
  if (!readable) return { groups: [], declaredIds: null, problems: [] }
  try {
    const groups = parseModuleGroups(text)
    return { groups, declaredIds: new Set(groups.map((group) => group.id)), problems: [] }
  } catch (error) {
    if (!(error instanceof CollabFormatError)) throw error
    return { groups: [], declaredIds: null, problems: [{ file: moduleGroupsFile, message: error.message }] }
  }
}

function withoutType<T extends { type: string }>({ type: _type, ...rest }: T): Omit<T, 'type'> {
  return rest
}

/** 读不出的记录文件，文件名里仍然写着 id；不在 records/ 下的文件不算 */
function idsOfUnreadableFiles(problems: CollabProblem[]): Set<string> {
  return new Set(problems.flatMap((problem) => recordIdOfPath(problem.file) ?? []))
}

const byId = (a: LocatedRecord, b: LocatedRecord) => (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0)

/**
 * 把读出来的记录分成任务与模块，都按 id 排好。重复的 id、任务所属的不是一个模块、模块的分组没列在分组列表里，都列成问题，不猜。
 * unreadableIds 是文件还在、只是读不出的记录（比如留着冲突标记）：已经报过读不出，指向它们的不再报成不存在。
 * declaredGroupIds 为 null 是分组列表读不出，不查模块的分组
 */
function linkRecords(located: LocatedRecord[], unreadableIds: ReadonlySet<string>, declaredGroupIds: ReadonlySet<string> | null): Omit<CollabState, 'groups'> {
  const problems: CollabProblem[] = []
  const firstById = new Map<string, LocatedRecord>()
  for (const entry of [...located].sort(byId)) {
    const first = firstById.get(entry.record.id)
    if (first) {
      problems.push({ file: entry.file, message: `id ${entry.record.id} 重复（第一次出现在 ${first.file}）` })
      continue
    }
    firstById.set(entry.record.id, entry)
  }

  const tasks: TaskState[] = []
  const modules: ModuleState[] = []
  for (const { record, file } of firstById.values()) {
    if (record.type === 'module') {
      modules.push(withoutType(record))
      if (record.group !== undefined && declaredGroupIds !== null && !declaredGroupIds.has(record.group)) {
        problems.push({ file, message: `模块的分组 ${record.group} 不在 collab/${moduleGroupsFile} 里` })
      }
      continue
    }
    tasks.push(withoutType(record))
    if (record.module === undefined || unreadableIds.has(record.module)) continue
    const target = firstById.get(record.module)
    if (!target) problems.push({ file, message: `任务所属的模块 ${record.module} 不存在` })
    else if (target.record.type !== 'module') problems.push({ file, message: `任务所属的模块 ${record.module} 不是一个模块` })
  }
  return { tasks, modules, problems }
}

/** 一份 collab/ 的当前状态：读出全部任务、模块与分组；读不出的文件和连不上的记录都在 problems 里 */
export function collabState(snapshot: CollabSnapshot): CollabState {
  const { records, problems } = readRecords(snapshot)
  const groupList = readModuleGroups(snapshot, true)
  const linked = linkRecords(records, idsOfUnreadableFiles(problems), groupList.declaredIds)
  return { ...linked, groups: groupList.groups, problems: [...problems, ...groupList.problems, ...linked.problems] }
}

function checkLineEndings(file: string, content: string): CollabProblem | null {
  if (content.includes('\r')) return { file, message: '换行符是 CRLF，要用 LF（在 .gitattributes 里给 collab/** 设 eol=lf）' }
  return null
}

function checkPeopleReferences(record: CollabRecord, personIds: Set<string>, at: (message: string) => void) {
  if (!personIds.has(record.author)) at(`作者 ${record.author} 不在 site/people.json 里`)
  if (record.owner && !personIds.has(record.owner)) at(`负责人 ${record.owner} 不在 site/people.json 里`)
}

/**
 * 校验协作仓的一份内容：路径与换行、每个文件能解码且是规范写法、记录放在 records/<id>.json、
 * 作者与负责人都在 site/people.json 里、id 不重复、任务所属的是存在的模块、分组列表能读出、模块的分组列在里面。
 * 只查格式，不查谁改了谁的记录：别人的记录能改哪些字段由写入规则管。人员列表的问题记在文件 people.json 上
 */
export function validateCollab(snapshot: CollabSnapshot): CollabProblem[] {
  const problems: CollabProblem[] = []
  let personIds: Set<string> | null = null
  if (snapshot.people === null) {
    problems.push({ file: 'people.json', message: '缺少人员列表 site/people.json' })
  } else {
    try {
      personIds = new Set(parsePeople(snapshot.people).map((person) => person.id))
    } catch (error) {
      if (!(error instanceof CollabFormatError)) throw error
      problems.push({ file: 'people.json', message: error.message })
    }
  }

  const readableFiles: string[] = []
  const lineEndingProblems: CollabProblem[] = []
  for (const [file, content] of Object.entries(snapshot.files)) {
    const lineEndingProblem = checkLineEndings(file, content)
    if (lineEndingProblem) lineEndingProblems.push(lineEndingProblem)
    else readableFiles.push(file)
  }

  const { records, problems: unreadable } = readRecords(snapshot, readableFiles)
  const groupList = readModuleGroups(snapshot, readableFiles.includes(moduleGroupsFile))
  problems.push(...lineEndingProblems, ...unreadable, ...groupList.problems)
  for (const { record, file, text } of records) {
    const at = (message: string) => problems.push({ file, message })
    if (encodeRecordFile(record) !== text) at('不是规范写法：键序、缩进、空白、转义或结尾换行和重新编码的结果不同')
    const idInFileName = recordIdOfPath(file)
    if (record.id !== idInFileName) at(`文件名是 ${idInFileName}.json，记录的 id 却是 ${record.id}；文件名要等于 id`)
    if (personIds) checkPeopleReferences(record, personIds, at)
  }
  problems.push(...linkRecords(records, idsOfUnreadableFiles([...lineEndingProblems, ...unreadable]), groupList.declaredIds).problems)
  return problems
}

/** 同一个文件里说法相同的问题在两个版本里算同一个；用 JSON 拼键，文件名与说明里出现什么字符都不会串 */
const problemKeyOf = (problem: { file: string; message: string }) => JSON.stringify([problem.file, problem.message])

/**
 * after 里有、before 里没有的问题：参照版本上原本就有的问题不挡这次改动，一个人不会因为别人留下的问题被挡住。
 * 记录格式问题与站点问题都按它算
 */
export function newProblems<Problem extends { file: string; message: string }>(before: readonly Problem[], after: readonly Problem[]): Problem[] {
  const existedBefore = new Set(before.map(problemKeyOf))
  return after.filter((problem) => !existedBefore.has(problemKeyOf(problem)))
}

/**
 * merged 里有、base 里没有的格式问题：gwb-collab 提交前在本机按它校验，写入规则也按它拦。
 * base 上原本就有的问题不算；不查谁改了谁的记录
 */
export function newFormatProblems(base: CollabSnapshot, merged: CollabSnapshot): CollabProblem[] {
  return newProblems(validateCollab(base), validateCollab(merged))
}

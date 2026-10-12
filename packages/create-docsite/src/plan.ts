import { lstatSync, readdirSync, realpathSync, type Stats } from 'node:fs'
import path from 'node:path'

/** createSite 成功后写在站点根下的标记文件：再运行时凭它认出本工具建过的站点 */
export const createMarkerFileName = '.create-docsite.json'

/** npm 打包默认不把 .gitignore 放进发布的包，模板里写成 gitignore，写进目标时改回 .gitignore；只映射模板顶层，深层照原名 */
const gitignoreSourceName = 'gitignore'
const gitignoreTargetName = '.gitignore'

/**
 * 用户数据材料的路径规则：以 / 结尾的是目录前缀，否则是顶层文件名。
 * 这些目标路径已存在时保留目标里的（模板的默认值不写入），不存在时写入模板的默认值。
 */
export const dataMaterialPathRules: readonly string[] = ['content/', 'comments/', 'people.json']

export function isDataMaterialPath(relativePath: string): boolean {
  return dataMaterialPathRules.some((rule) =>
    rule.endsWith('/') ? relativePath.startsWith(rule) : relativePath === rule,
  )
}

export type CreateSiteErrorCode =
  | 'invalid-argument'
  | 'invalid-path'
  | 'overlap'
  | 'template-error'
  | 'existing-site'
  | 'conflict'
  | 'io-error'

export class CreateSiteError extends Error {
  readonly code: CreateSiteErrorCode
  /** conflict 时逐条列出全部冲突，其余情况为空 */
  readonly details: string[]
  constructor(code: CreateSiteErrorCode, message: string, details: readonly string[] = []) {
    super(message)
    this.name = 'CreateSiteError'
    this.code = code
    this.details = [...details]
  }
}

/**
 * 符号链接与 Windows junction 都会把写到它下面的文件引到目录外。
 * 本机 win32 / Node 24 实测：lstat 的 isSymbolicLink() 对 junction 也返回 true
 * （libuv 把 junction 与符号链接都归为符号链接），查它一个就够。
 */
export function statsIsSymlinkOrJunction(stats: Stats): boolean {
  return stats.isSymbolicLink()
}

/** lstat：占住名字就算存在（dangling 链接也算），拿不到就 null；ENOENT 之外的错误照抛 */
export function lstatOrNull(entryPath: string): Stats | null {
  try {
    return lstatSync(entryPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * 解析出真实路径：路径本身存在就直接 realpath；不存在就把最长存在前缀 realpath 后拼回剩余段。
 * 只 resolve 不够：父段里的符号链接不解析，模板与目标的重叠会看漏。
 */
export function realPathIfExisting(dirPath: string): string {
  const resolved = path.resolve(dirPath)
  const tail: string[] = []
  let current = resolved
  while (true) {
    try {
      return path.join(realpathSync(current), ...tail)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const parent = path.dirname(current)
    if (parent === current) return resolved
    tail.unshift(path.basename(current))
    current = parent
  }
}

/** Windows 不区分路径大小写，比较前统一小写；别的平台按原样 */
function pathKeyForComparison(dirPath: string): string {
  return process.platform === 'win32' ? dirPath.toLowerCase() : dirPath
}

/** parentDir 是否把 childDir 整个装在里面（相等也算）；跨盘符（path.relative 给出绝对路径）不算 */
export function dirContainsDir(parentDir: string, childDir: string): boolean {
  const relative = path.relative(pathKeyForComparison(parentDir), pathKeyForComparison(childDir))
  if (path.isAbsolute(relative)) return false
  return relative === '' || relative.split(path.sep)[0] !== '..'
}

const windowsReservedBaseNames = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])

/**
 * 按单段文件名检查，用 Windows 规则（模板可能在任意系统制作、在 Windows 用，按最严平台预检）。
 * Windows 的保留名看第一个点之前的基名：con.x.txt 也非法。返回 null 表示没问题，否则返回一句问题描述。
 */
export function windowsFileNameProblem(fileName: string): string | null {
  if (fileName === '') return '文件名为空'
  if (/[<>:"|?*\u0000-\u001f]/.test(fileName)) return `文件名里有 Windows 不允许的字符：${JSON.stringify(fileName)}`
  if (fileName.endsWith('.') || fileName.endsWith(' ')) return `文件名不能以点或空格结尾：${JSON.stringify(fileName)}`
  const baseName = fileName.split('.')[0] ?? ''
  if (windowsReservedBaseNames.has(baseName.toLowerCase())) return `Windows 保留了这个名字：${fileName}`
  return null
}

export type PlannedFile = {
  /** 模板里的绝对路径 */
  sourcePath: string
  /** 写进站点的相对路径，正斜杠 */
  relativePath: string
}

export type SiteTemplatePlan = {
  /** 骨架文件：目标里已有同名条目 → 整体拒绝 */
  skeletonFiles: PlannedFile[]
  /** 数据材料文件（content/、comments/、people.json）：目标里已有同名条目 → 保留对方的，只写缺失的 */
  dataMaterialFiles: PlannedFile[]
}

/** 目录的 lstat 检查结果：null 表示是真实目录，否则是一句问题描述 */
function realDirectoryProblem(dirPath: string): string | null {
  const stats = lstatOrNull(dirPath)
  if (stats === null) return '不存在'
  if (statsIsSymlinkOrJunction(stats)) return '是符号链接或 junction'
  if (!stats.isDirectory()) return '不是目录'
  return null
}

/**
 * 扫描模板（一棵普通文件树），按目标路径把文件分成骨架与数据材料两组。
 * 模板里的任何符号链接、junction、非法名、非普通文件都当场拒绝。
 */
export function scanSiteTemplate(templateRootDir: string): SiteTemplatePlan {
  const rootProblem = realDirectoryProblem(templateRootDir)
  if (rootProblem !== null) {
    throw new CreateSiteError('template-error', `模板目录 ${templateRootDir} ${rootProblem}：模板要是棵普通文件树`)
  }
  const files = scanTreeCollectingFiles(templateRootDir, true, '').sort(byRelativePath)
  const skeletonFiles: PlannedFile[] = []
  const dataMaterialFiles: PlannedFile[] = []
  for (const file of files) {
    if (isDataMaterialPath(file.relativePath)) dataMaterialFiles.push(file)
    else skeletonFiles.push(file)
  }
  return { skeletonFiles, dataMaterialFiles }
}

/** 扫描序按条目原名排，顶层 gitignore 改名成 .gitignore 后位置会变，清单统一按映射后的相对路径排 */
const byRelativePath = (first: PlannedFile, second: PlannedFile) =>
  first.relativePath < second.relativePath ? -1 : first.relativePath > second.relativePath ? 1 : 0

function scanTreeCollectingFiles(dir: string, isTreeRoot: boolean, prefix: string): PlannedFile[] {
  const planned: PlannedFile[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((first, second) => (first.name < second.name ? -1 : first.name > second.name ? 1 : 0))
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    const entryStats = lstatOrNull(entryPath)
    if (entryStats === null) throw new CreateSiteError('template-error', `模板条目在扫描中消失了：${entryPath}`)
    if (statsIsSymlinkOrJunction(entryStats)) {
      throw new CreateSiteError('template-error', `模板里不能有符号链接或 junction（复制会越出模板目录）：${entryPath}`)
    }
    const entryName = isTreeRoot && entry.name === gitignoreSourceName && entryStats.isFile()
      ? gitignoreTargetName
      : entry.name
    const relativePath = prefix === '' ? entryName : `${prefix}/${entryName}`
    const nameProblem = windowsFileNameProblem(entryName)
    if (nameProblem !== null) {
      throw new CreateSiteError('template-error', `模板条目名不能用：${relativePath}（${nameProblem}）`)
    }
    if (entryStats.isDirectory()) planned.push(...scanTreeCollectingFiles(entryPath, false, relativePath))
    else if (entryStats.isFile()) planned.push({ sourcePath: entryPath, relativePath })
    else throw new CreateSiteError('template-error', `模板里只能有普通文件与目录：${entryPath}`)
  }
  return planned
}

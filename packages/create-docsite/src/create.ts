import fs from 'node:fs'
import path from 'node:path'
import {
  CreateSiteError,
  createMarkerFileName,
  dirContainsDir,
  lstatOrNull,
  realPathIfExisting,
  scanSiteTemplate,
  statsIsSymlinkOrJunction,
  type PlannedFile,
} from './plan.ts'

export { CreateSiteError } from './plan.ts'
export type { CreateSiteErrorCode } from './plan.ts'

export type CreateSiteResult = {
  /** 本次新建的文件，相对站点根、正斜杠，含创建标记 */
  createdFiles: string[]
  /** 目标里已存在而被保留的数据材料（content/、comments/、people.json 里那些）：模板的默认值没有写入 */
  keptFiles: string[]
}

/** 这三个名字任何一个存在就认定目标已经是站点，拒绝新建 */
const existingSiteEntryNames = ['package.json', 'app', createMarkerFileName]

/**
 * 一次性建站：把 templateDir（一棵普通文件树）写进 dir。
 * 骨架文件目标里已有同名就整体拒绝（预检全量列清，一个字节不写）；数据材料（content/、comments/、
 * people.json）目标里已有就保留对方的，只写缺失的。
 * 全程只用新建式写入（wx），预检与写入之间冒出的同名文件也不会被覆盖；失败只回滚本次新建的文件与目录。
 */
export function createSite({ dir, templateDir }: { dir: string; templateDir: string }): CreateSiteResult {
  assertNonEmptyString(dir, 'dir')
  assertNonEmptyString(templateDir, 'templateDir')

  const templateRoot = realPathIfExisting(templateDir)
  const templateStats = lstatOrNull(templateRoot)
  if (templateStats === null) throw new CreateSiteError('invalid-path', `模板目录不存在：${templateDir}`)
  if (!templateStats.isDirectory()) throw new CreateSiteError('invalid-path', `模板路径不是目录：${templateDir}`)

  const targetRoot = realPathIfExisting(dir)
  const targetStats = lstatOrNull(targetRoot)
  if (targetStats !== null && !targetStats.isDirectory()) {
    throw new CreateSiteError('invalid-path', `目标路径已存在且不是目录：${dir}`)
  }

  if (dirContainsDir(targetRoot, templateRoot) || dirContainsDir(templateRoot, targetRoot)) {
    throw new CreateSiteError('overlap', `模板目录与目标目录重叠（一方在另一方里面或相同），模板 ${templateRoot}、目标 ${targetRoot}`)
  }

  const template = scanSiteTemplate(templateRoot)

  const existingSiteEntries = existingSiteEntryNames.filter((name) => lstatOrNull(path.join(targetRoot, name)) !== null)
  if (existingSiteEntries.length > 0) {
    throw new CreateSiteError(
      'existing-site',
      `目标目录已经是站点（${existingSiteEntries.join('、')} 已存在）：本工具只做一次性新建，不改动已有站点`,
    )
  }

  const conflictDetails: string[] = []
  const keptFiles: string[] = []
  const filesToWrite: PlannedFile[] = []
  for (const file of template.skeletonFiles) {
    if (lstatOrNull(targetPathOf(targetRoot, file.relativePath)) !== null) {
      conflictDetails.push(`${file.relativePath}（目标里已有同名条目）`)
    } else {
      filesToWrite.push(file)
    }
  }
  for (const file of template.dataMaterialFiles) {
    if (lstatOrNull(targetPathOf(targetRoot, file.relativePath)) !== null) keptFiles.push(file.relativePath)
    else filesToWrite.push(file)
  }
  if (conflictDetails.length === 0) {
    const parentDirsToCheck = new Set<string>()
    for (const file of filesToWrite) {
      const segments = file.relativePath.split('/')
      for (let end = 1; end < segments.length; end++) parentDirsToCheck.add(segments.slice(0, end).join('/'))
    }
    for (const relativeDir of [...parentDirsToCheck].sort()) {
      const stats = lstatOrNull(targetPathOf(targetRoot, relativeDir))
      if (stats === null) continue
      if (statsIsSymlinkOrJunction(stats)) {
        conflictDetails.push(`${relativeDir}（已是符号链接或 junction：往里写会越出目标目录）`)
      } else if (!stats.isDirectory()) {
        conflictDetails.push(`${relativeDir}（已是同名文件，挡住了要在这里建的目录）`)
      }
    }
  }
  if (conflictDetails.length > 0) {
    throw new CreateSiteError('conflict', '目标目录与模板冲突，一处也不会写，先处理这些再建站：', conflictDetails)
  }

  const createdFilePaths: string[] = []
  const createdDirPaths: string[] = []
  try {
    for (const file of filesToWrite) {
      writePlannedFile(targetRoot, file, createdFilePaths, createdDirPaths)
    }
    writeMarkerFile(targetRoot, createdFilePaths)
  } catch (error) {
    throw rollbackAndReport(targetRoot, createdFilePaths, createdDirPaths, error)
  }
  return {
    createdFiles: createdFilePaths
      .map((filePath) => path.relative(targetRoot, filePath).split(path.sep).join('/'))
      .sort(),
    keptFiles: [...keptFiles].sort(),
  }
}

/**
 * 独占创建并写入一个文件，文件何时归本次所有在这里界定：openSync('wx') 成功的那一刻
 * 文件就是本次创建的（先登记再写内容），之后写内容中途失败（如磁盘写满只写了一半）
 * 也由回滚撤走；open 阶段的任何错误（EEXIST、权限等）发生在登记之前，那个文件不是
 * 本次创建的，绝不登记、绝不删。
 */
function createFileExclusive(targetPath: string, content: string | Uint8Array, createdFilePaths: string[]): void {
  const fd = fs.openSync(targetPath, 'wx')
  createdFilePaths.push(targetPath)
  try {
    fs.writeFileSync(fd, content)
  } finally {
    fs.closeSync(fd)
  }
}

function writePlannedFile(
  targetRoot: string,
  file: PlannedFile,
  createdFilePaths: string[],
  createdDirPaths: string[],
): void {
  const targetPath = targetPathOf(targetRoot, file.relativePath)
  ensureDirChain(path.dirname(targetPath), targetRoot, createdDirPaths)
  const sourceStats = lstatOrNull(file.sourcePath)
  if (sourceStats === null || !sourceStats.isFile() || statsIsSymlinkOrJunction(sourceStats)) {
    throw new CreateSiteError('template-error', `模板文件在扫描之后变了，不再照抄它：${file.sourcePath}`)
  }
  const content = fs.readFileSync(file.sourcePath)
  try {
    createFileExclusive(targetPath, content, createdFilePaths)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new CreateSiteError('conflict', `预检之后目标里出现了同名文件（未覆盖）：${file.relativePath}`)
    }
    throw error
  }
}

function writeMarkerFile(targetRoot: string, createdFilePaths: string[]): void {
  const markerPath = path.join(targetRoot, createMarkerFileName)
  const content = `${JSON.stringify({ tool: 'create-docsite', createdAt: new Date().toISOString() }, null, 2)}\n`
  try {
    createFileExclusive(markerPath, content, createdFilePaths)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new CreateSiteError('conflict', `预检之后目标里出现了 ${createMarkerFileName}（未覆盖）`)
    }
    throw error
  }
}

/**
 * 建出站点根到 dirToEnsure 的目录链，把本次新建的目录段记进 createdDirPaths。
 * 根不存在时根也算本次新建——不管 dirToEnsure 是根本身还是更深的目录，都登记，
 * 回滚才删得掉它；已存在的段不登记，预存在目录绝不删。从第一个缺失段起，后面的段
 * 要么是本次建的、要么建的时候还不存在，回滚删不掉会进残留报告而不误伤。
 */
function ensureDirChain(dirToEnsure: string, siteRoot: string, createdDirPaths: string[]): void {
  const relative = path.relative(siteRoot, dirToEnsure)
  const segments = relative === '' ? [] : relative.split(path.sep)
  if (segments.length > 0 && (segments[0] === '..' || path.isAbsolute(relative))) {
    throw new Error(`内部错误：要建的目录 ${dirToEnsure} 不在站点根 ${siteRoot} 里`)
  }
  let sawMissing = false
  if (lstatOrNull(siteRoot) === null) {
    sawMissing = true
    createdDirPaths.push(siteRoot)
  }
  let current = siteRoot
  for (const segment of segments) {
    current = path.join(current, segment)
    if (sawMissing || lstatOrNull(current) === null) {
      sawMissing = true
      createdDirPaths.push(current)
    }
  }
  if (sawMissing) fs.mkdirSync(dirToEnsure, { recursive: true })
}

export type RollbackReport = {
  removedFiles: string[]
  removedDirs: string[]
  leftovers: string[]
}

/**
 * 建站失败后撤回本次新建的文件与目录。只删传进来的路径，且先确认它在站点根里面——
 * 站点根本身也算界内：目标根是本次建的时候它在清单里，要正常删掉，不能误报越界；
 * 目录只删空的（rmdir 不递归），删不掉的记进残留，不动任何别人的文件。
 */
export function rollbackCreatedEntries(
  siteRoot: string,
  createdFilePaths: readonly string[],
  createdDirPaths: readonly string[],
): RollbackReport {
  const insideSite = (entryPath: string) => {
    const relative = path.relative(siteRoot, entryPath)
    return relative === '' || (relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative))
  }
  const leftovers: string[] = []
  const removedFiles: string[] = []
  const removedDirs: string[] = []
  for (const filePath of [...createdFilePaths].reverse()) {
    if (!insideSite(filePath)) {
      leftovers.push(`${filePath}（不在站点根内，跳过不删）`)
      continue
    }
    try {
      fs.unlinkSync(filePath)
      removedFiles.push(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') removedFiles.push(filePath)
      else leftovers.push(`${filePath}（删除失败：${errorMessageOf(error)}）`)
    }
  }
  const byDepthDescending = (first: string, second: string) =>
    second.split(path.sep).length - first.split(path.sep).length
  for (const dirPath of [...createdDirPaths].sort(byDepthDescending)) {
    if (!insideSite(dirPath)) {
      leftovers.push(`${dirPath}（不在站点根内，跳过不删）`)
      continue
    }
    try {
      fs.rmdirSync(dirPath)
      removedDirs.push(dirPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') removedDirs.push(dirPath)
      else leftovers.push(`${dirPath}（目录非空或删除失败，保留）`)
    }
  }
  return { removedFiles, removedDirs, leftovers }
}

function rollbackAndReport(
  targetRoot: string,
  createdFilePaths: readonly string[],
  createdDirPaths: readonly string[],
  cause: unknown,
): unknown {
  const failure = cause instanceof CreateSiteError
    ? cause
    : new CreateSiteError('io-error', `写站点文件失败：${errorMessageOf(cause)}`)
  const report = rollbackCreatedEntries(targetRoot, createdFilePaths, createdDirPaths)
  if (report.leftovers.length > 0) {
    failure.message += `\n回滚后仍有残留，需要手动处理：${report.leftovers.join('；')}`
  }
  return failure
}

function targetPathOf(targetRoot: string, relativePath: string): string {
  return path.join(targetRoot, ...relativePath.split('/'))
}

function assertNonEmptyString(value: string, optionName: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CreateSiteError('invalid-argument', `${optionName} 要是非空字符串`)
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { projectDirOfCollabRepo } from '@godcreator/collab-model/project-model'
import { messageOf } from '../../errors.js'
import { settlerOf } from '../../settle.js'
import { otherRepoNamesOf } from '../../project/project.js'
import { otherRepoHeadOf, type OtherRepoHead } from './state.js'

/** .git 里只有这几样变了 HEAD 才会和服务器比出不同：切分支、提交、取回、快进都改 HEAD 或引用 */
function affectsHead(fileInGitDir: string): boolean {
  const name = fileInGitDir.split(path.sep).join('/')
  return name === 'HEAD' || name === 'packed-refs' || name.startsWith('refs/')
}

export type OtherReposWatcher = { close(): void }

type WatchOptions = {
  /** 各仓的 HEAD 状态变了：交出全部仓的，按目录名排 */
  onChange(heads: OtherRepoHead[]): void
  /** 某个仓读不出来、监视出错：这个仓留着上次的，下次变化再算 */
  onError(message: string): void
  settleMilliseconds: number
}

/**
 * 盯着项目文件夹（协作仓的上一级）里协作仓以外的仓：开始时每个仓算一次 HEAD 和服务器比的结果，
 * 之后哪个仓的 HEAD 或引用变了就只重算那一个；项目文件夹里多了、少了仓，停一会儿再重新列
 * （git clone 先建目录、后建 .git，目录刚出现时还不算仓）。工作区里的文件不盯。项目文件夹不存在时 watch 直接抛错
 */
export function watchOtherRepoHeads(collabRepo: string, options: WatchOptions): OtherReposWatcher {
  const projectDir = projectDirOfCollabRepo(collabRepo)
  const heads = new Map<string, OtherRepoHead>()
  const repoWatchers = new Map<string, FSWatcher>()
  const latestRun = new Map<string, number>()
  let closed = false
  /** 重新列仓用的等待键；仓名里不会有 \0，不会和仓名撞上 */
  const relistKey = '\0项目文件夹'
  const settler = settlerOf(options.settleMilliseconds, (key, error) =>
    options.onError(`${key === relistKey ? '重新列出项目文件夹里的仓' : `重算 ${key} 仓的 HEAD`}失败：${messageOf(error)}`),
  )

  const emit = () => {
    if (!closed) options.onChange([...heads.values()].sort((a, b) => a.repo.localeCompare(b.repo)))
  }
  const recompute = async (name: string) => {
    const run = (latestRun.get(name) ?? 0) + 1
    latestRun.set(name, run)
    try {
      const head = await otherRepoHeadOf(path.join(projectDir, name), name)
      if (closed || !repoWatchers.has(name) || latestRun.get(name) !== run) return
      heads.set(name, head)
      emit()
    } catch (error) {
      options.onError(`${name} 仓的 HEAD 读不出来，先留着上次的：${messageOf(error)}`)
    }
  }
  const follow = (name: string) => {
    const watcher = watch(path.join(projectDir, name, '.git'), { recursive: true }, (_event, file) => {
      if (file === null || affectsHead(file)) settler.later(name, () => void recompute(name))
    })
    // 仓被删掉时监视会报错；不接住会让整个 gwb 崩溃。报出来，项目文件夹的监视会接着把它从列表里拿掉
    watcher.on('error', (error) => options.onError(`监视 ${name} 仓失败：${messageOf(error)}`))
    repoWatchers.set(name, watcher)
    void recompute(name)
  }
  const unfollow = (name: string) => {
    repoWatchers.get(name)!.close()
    repoWatchers.delete(name)
    settler.cancel(name)
    heads.delete(name)
  }
  const relist = () => {
    const names = otherRepoNamesOf(collabRepo)
    const removed = [...repoWatchers.keys()].filter((name) => !names.includes(name))
    for (const name of removed) unfollow(name)
    for (const name of names) if (!repoWatchers.has(name)) follow(name)
    if (removed.length > 0) emit()
  }

  const projectWatcher = watch(projectDir, () => settler.later(relistKey, relist))
  projectWatcher.on('error', (error) => options.onError(`监视项目文件夹失败：${messageOf(error)}`))
  relist()
  if (repoWatchers.size === 0) emit()
  return {
    close: () => {
      closed = true
      projectWatcher.close()
      settler.close()
      for (const watcher of repoWatchers.values()) watcher.close()
      repoWatchers.clear()
    },
  }
}

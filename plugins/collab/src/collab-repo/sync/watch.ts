import { watch } from 'node:fs'
import path from 'node:path'
import { messageOf } from '../../errors.js'
import { settlerOf } from '../../settle.js'
import { collabRepoLocalStateOf, type CollabRepoLocalState } from './local-state.js'

/** .git 里只有这几样变了才会改变本机状态：提交改 index 与分支，同步改分支，切分支改 HEAD */
function affectsLocalState(fileInRepo: string): boolean {
  const name = fileInRepo.split(path.sep).join('/')
  if (!name.startsWith('.git/')) return true
  const inGitDir = name.slice('.git/'.length)
  return inGitDir === 'index' || inGitDir === 'HEAD' || inGitDir === 'packed-refs' || inGitDir.startsWith('refs/')
}

export type CollabRepoWatcher = { close(): void }

type WatchOptions = {
  /** 算出了此刻的本机状态：开始时一次，之后文件一变就再交一次（状态没变也交：collab/ 里的记录可能改了内容） */
  onChange(state: CollabRepoLocalState): void
  /** 重算失败、监视出错：先留着上次的，下次变化再算 */
  onError(message: string): void
  settleMilliseconds: number
}

/**
 * 盯着协作仓：开始时算一次本机状态，之后仓里的文件或 git 状态变了，停一会儿没有新变化就重算。
 * 只盯协作仓自己，项目文件夹里别的仓由别的仓那一套盯。目录不存在时 watch 直接抛错，由调用方报出来
 */
export function watchCollabRepo(repo: string, options: WatchOptions): CollabRepoWatcher {
  let closed = false
  /** 最近一次开始重算的编号：接连重算时，先开始的晚算完也不覆盖后一次的结果 */
  let latestRun = 0
  const settler = settlerOf(options.settleMilliseconds, (_key, error) => options.onError(`重算协作仓的本机状态失败：${messageOf(error)}`))
  const recompute = async () => {
    const run = ++latestRun
    try {
      const state = await collabRepoLocalStateOf(repo)
      if (!closed && run === latestRun) options.onChange(state)
    } catch (error) {
      options.onError(`协作仓的本机状态读不出来，先留着上次的：${messageOf(error)}`)
    }
  }
  const watcher = watch(repo, { recursive: true }, (_event, file) => {
    if (file === null || affectsLocalState(file)) settler.later('collab-repo', () => void recompute())
  })
  // 仓的目录被删掉时监视会报错；不接住会让整个 gwb 崩溃
  watcher.on('error', (error) => options.onError(`监视协作仓失败：${messageOf(error)}`))
  void recompute()
  return {
    close: () => {
      closed = true
      settler.close()
      watcher.close()
    },
  }
}

import { collabPathInRepo, sitePathInRepo } from '@godcreator/collab'
import { conflictedFilesAmong, currentBranch, filesUnder, statusEntriesOf } from '../../git/status.js'
import { sourcesPathInRepo } from '../sources.js'

/**
 * 协作仓此刻的本机状态：当前分支（分离的 HEAD 为 null）；还没提交审核的文件，records 相对 collab/、siteFiles 相对 site/、sourceFiles 相对 sources/；
 * 提交审核合 main 出冲突、还没改好的文件（相对仓根）
 */
export type CollabRepoLocalState = {
  branch: string | null
  unsubmitted: { records: string[]; siteFiles: string[]; sourceFiles: string[] }
  conflicts: string[]
}

/** git status 只运行一次，按路径分出 collab/、site/ 与 sources/，冲突也从状态码里读：协作仓里文件一保存就要重算，运行的 git 越少越好 */
export async function collabRepoLocalStateOf(repo: string): Promise<CollabRepoLocalState> {
  const [branch, entries] = await Promise.all([currentBranch(repo), statusEntriesOf(repo)])
  return {
    branch: branch === '' ? null : branch,
    unsubmitted: {
      records: filesUnder(entries, collabPathInRepo),
      siteFiles: filesUnder(entries, sitePathInRepo),
      sourceFiles: filesUnder(entries, sourcesPathInRepo),
    },
    conflicts: conflictedFilesAmong(entries),
  }
}

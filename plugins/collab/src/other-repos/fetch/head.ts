import { currentBranch, serverCountsOf } from '../../git/status.js'

/**
 * 一个别的仓的 HEAD 和服务器上的同名分支（上次取回的 origin/<分支>）比：ahead 是本地多出来的提交，behind 是服务器上多出来的。
 * 只看 HEAD，工作区里没提交的文件不算，那是正常干活的状态。repo 是项目文件夹里的目录名
 */
export type OtherRepoHead = { repo: string; ahead: number; behind: number }

export async function otherRepoHeadOf(repoDir: string, repo: string): Promise<OtherRepoHead> {
  return { repo, ...(await serverCountsOf(repoDir, await currentBranch(repoDir))) }
}

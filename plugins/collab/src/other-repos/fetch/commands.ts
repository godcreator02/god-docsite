import { updateOtherRepo } from './update.js'
import { registerCommand, remoteAuthUsage, remoteProjectAt, repoAndNameOf, type PluginServices } from '../../commands.js'

/** 项目文件夹里协作仓以外的仓按普通 git 仓管理，插件只在 agent 调命令时更新 */
export function registerOtherRepoCommands(services: PluginServices): void {
  const { commands } = services
  registerCommand(
    commands,
    {
      name: 'collab.repos.update',
      effect: 'write',
      description: '把项目文件夹里协作仓以外的一个仓（资料库、代码仓）取回并快进 main 到 origin/main；检查时不替人更新这些仓，人要更新时由 agent 调它，不能快进就写明原因，不动',
      usage:
        '{ repo, name }：repo 是项目仓根（协作仓）的绝对路径；name 是项目文件夹里协作仓以外的 git 仓的文件夹名（只含字母、数字与 _ . -），不是项目文件夹里的 git 仓、或者是协作仓（协作仓由检查时的自动同步跟上 main）就拒绝。' +
        `${remoteAuthUsage}。` +
        '先用令牌对这个仓 git fetch origin（失败就拒绝，附 git 的原话），再把它的 main 快进到 origin/main，工作区里没提交的改动照留；只做快进，拒绝的情况：当前不在 main 上（写明在哪个分支或分离的 HEAD）、仓里没有 origin/main、有一次合并还没完成（MERGE_HEAD 还在）、' +
        '本地 main 上有服务器上没有的提交（合并请求还没合并，或者是没推上去的提交）、没提交的改动和新改动碰到了同一个文件（附 git 的原话，git 这时什么都没动）。' +
        '快进带着令牌的请求头，LFS 文件在检出时下载。' +
        '回 { repo, outcome, commits? }：repo 是仓名；outcome 是 merged（带 commits，快进进来几个提交）或 up-to-date（本来就和 origin/main 一样新）',
    },
    async (args) => {
      const { repo, name } = repoAndNameOf(args, [])
      return updateOtherRepo(await remoteProjectAt(services, repo), name)
    },
  )
}

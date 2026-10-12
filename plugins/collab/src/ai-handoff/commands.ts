import { aiPromptOf, type AiHandoffReceipt } from './prompt.js'
import { projectTitleOf } from '../project/project.js'
import { registerCommand, repoUsage, type PluginServices, repoOfArgs } from '../commands.js'

/** 交给 AI：一个项目此刻的全部通知写成一份提示词，照设置 ai-handling 交出去 */
export function registerAiCommands({ commands, notifications }: PluginServices, handOffToAi: (repo: string, prompt: string) => Promise<AiHandoffReceipt>): void {
  registerCommand(
    commands,
    {
      name: 'collab.ai.handoff',
      effect: 'external',
      description: '把一个项目此刻的全部通知（网站顶部提示栏里的每一条）写成一份提示词，照设置 ai-handling 交给 ZCode 或 Claude Code',
      usage:
        `${repoUsage}。通知和网站提示栏、协作窗格的计数是同一份，分三组：协作仓（还没提交审核的文件、冲突、提交审核失败、没能同步、检查出错、不在 main、记录读不对、组织 webhook 没配好）、` +
        '别的仓（未推送、未拉取、分叉，等我审阅的合并请求、轮到负责人回的 issue，我开的合并请求被要求修改或有了新评论，我提的 issue 负责人回了，没按规矩配好的仓）、找我的（任务、@ 与回复）。' +
        '每条写成组、短句、原文，并写明照说明书 collab 哪个附件的哪一节处理；提示词开头（读说明书之前）写明这一轮只读和整理：先列出每条打算怎么处理、停下等人回复，人明确同意之前不改文件、不调会改东西的命令；接着让 AI 读说明书主文件和用到的附件；末尾再重复一句这条，并让它照主文件的「始终照做」。一个项目的全部通知一起交，没有通知就拒绝。设置 ai-handling：off 拒绝并写明去哪里改；zcode 把 ZCode 桌面端切到协作仓、新建一条完全访问的会话（要装 gwb-zcode 0.4 以上）；' +
        'claude-terminal 把提示词写进临时文件，新开一个 pwsh 窗口在协作仓里运行 Claude Code 读它。' +
        '协作窗格每个项目一行上的「交给 AI 处理」调它。回 { handler, detail, items }：handler 是 zcode 或 claude-terminal，detail 是 ZCode 的会话 id 或写着提示词的文件，items 是交出去几条',
    },
    async (args) => {
      const { project, notifications: current, nameOf } = await notifications.currentOf(repoOfArgs(args))
      const prompt = aiPromptOf({ title: projectTitleOf(project), repo: project.repo }, current, nameOf)
      return { ...(await handOffToAi(project.repo, prompt)), items: current.length }
    },
  )
}

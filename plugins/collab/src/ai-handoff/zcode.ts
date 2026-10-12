import type { GwbZcodeApi } from '@godcreator/gwb-zcode'
import { CollabRejected, messageOf } from '../errors.js'

/**
 * 经服务 gwbZcode 交给 ZCode：侧栏只显示窗口当前工作区的会话，先把窗口切到协作仓再建会话，回会话 id。
 * 人在电脑前点的按钮，AI 先列出要做的事问人：不附回报约定、不记账，结果就在那条会话里。
 * zcode 为 null 表示 gwb-zcode 没装；ZCode 那边的报错原话写进拒绝里
 */
export async function handOffToZcode(zcode: GwbZcodeApi | null, repo: string, prompt: string): Promise<string> {
  if (zcode === null) throw new CollabRejected('没装 gwb-zcode（0.4 以上）：装上之后再交给 ZCode，或把设置 ai-handling 改成 claude-terminal')
  try {
    await zcode.open({ workspace: repo })
  } catch (error) {
    throw new CollabRejected(`把 ZCode 切到 ${repo} 失败：${messageOf(error)}`)
  }
  try {
    return (await zcode.create({ workspace: repo, prompt })).taskId
  } catch (error) {
    throw new CollabRejected(`在 ZCode 里建会话失败：${messageOf(error)}`)
  }
}

import { CollabRejected, messageOf } from '../../errors.js'
import type { GiteaAccess } from '../../gitea-api/access.js'
import { pushTopicOf } from './messages.js'

/**
 * collab.repo.setup、collab.repo.create 配完负责人以后发到这个组织的 topic：Gitea 换协作者不发 webhook，别的成员靠这一条去重读那个仓。
 * 格式和 webhook 推来的一样（标题 <组织>/<仓>）；ntfy 回的不是 2xx 就报出来
 */
export async function publishLeadsChanged(fetcher: typeof fetch, pushUrl: string, organization: string, repo: string): Promise<void> {
  const response = await fetcher(`${pushUrl}/${pushTopicOf(organization)}`, { method: 'POST', headers: { Title: `${organization}/${repo}` }, body: 'leads changed' })
  if (!response.ok) throw new CollabRejected(`发 leads changed 到 ${pushUrl}/${pushTopicOf(organization)} 失败：ntfy 回 HTTP ${response.status} ${await response.text()}`)
}

/** 发出去了为 sent；配置已经改好、只是消息没发出去时写原因，别的成员要等下一次完整刷新才看到新负责人 */
export type LeadsChangedNotice = 'sent' | { failed: string }

/** 负责人改好以后往组织的 topic 发一条 leads changed；发不出去不算这条命令失败，回执里写明 */
export async function noticeLeadsChanged(gitea: GiteaAccess, organization: string, repo: string): Promise<LeadsChangedNotice> {
  try {
    await publishLeadsChanged(globalThis.fetch, await gitea.pushUrl(), organization, repo)
    return 'sent'
  } catch (error) {
    return { failed: messageOf(error) }
  }
}

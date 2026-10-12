import { useRevalidator } from 'react-router'
import { collabApiUrl, type CollabWriteAction } from '../site-data.js'

async function writeCollab<Result>(action: CollabWriteAction, record: Record<string, unknown>): Promise<Result> {
  const response = await fetch(collabApiUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, record }) })
  const text = await response.text()
  if (!response.ok) {
    const error = response.headers.get('content-type')?.includes('application/json') ? (JSON.parse(text) as { error: string }).error : text
    throw new Error(error)
  }
  return JSON.parse(text) as Result
}

/**
 * 写任务与模块：写完让整站布局的 loader 重新读一遍，等读完再返回，接着跳到新建的那一页时它已经在了。
 * 被写入规则拒绝时抛错，消息是给人看的原话
 */
export function useCollabWriter() {
  const { revalidate } = useRevalidator()
  const afterWrite = async <Result,>(written: Promise<Result>) => {
    const result = await written
    await revalidate()
    return result
  }
  return {
    /** 新建一条记录（不含 id 与作者）；回新记录的 id */
    create: (record: Record<string, unknown>) => afterWrite(writeCollab<{ id: string }>('create', record)),
    /** 修改一条记录的字段 */
    update: (id: string, fields: Record<string, unknown>) => afterWrite(writeCollab<Record<string, never>>('update', { id, fields })),
    /** 删掉一条任务或一个模块 */
    remove: (id: string) => afterWrite(writeCollab<{ files: string[] }>('delete', { ids: [id] })),
  }
}

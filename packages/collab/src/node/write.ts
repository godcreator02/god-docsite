import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collabPathInRepo } from '../core/layout.js'
import { planCreate, planDelete, planUpdate } from '../core/write-rules.js'
import { readCollabSnapshot } from './snapshot.js'

type WriteRequest = { repo: string; person: string | null; body: Record<string, unknown> }

/** 新建一条记录：补上 id 与作者，写成新文件 collab/records/<id>.json；flag wx 保证不覆盖已有的文件 */
export async function createRecord({ repo, person, body }: WriteRequest): Promise<{ id: string }> {
  const { plan, id } = planCreate({ snapshot: await readCollabSnapshot(repo), person, body })
  for (const { file, content } of plan.write) {
    const target = path.join(repo, collabPathInRepo, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' })
  }
  return { id }
}

/** 修改一条记录的字段：直接改写它的文件 */
export async function updateRecord({ repo, person, body }: WriteRequest): Promise<Record<string, never>> {
  const plan = planUpdate({ snapshot: await readCollabSnapshot(repo), person, body })
  for (const { file, content } of plan.write) await writeFile(path.join(repo, collabPathInRepo, file), content, 'utf8')
  return {}
}

/** 删掉 ids 列出的任务与模块的记录文件；planDelete 全部判断通过才删。回 files：删掉的记录文件，相对 collab/ */
export async function deleteRecords({ repo, person, body, projectLeads }: WriteRequest & { projectLeads: string[] }): Promise<{ files: string[] }> {
  const plan = planDelete({ snapshot: await readCollabSnapshot(repo), person, body, projectLeads })
  await Promise.all(plan.remove.map((file) => unlink(path.join(repo, collabPathInRepo, file))))
  return { files: plan.remove }
}

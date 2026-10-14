import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collabPathInRepo, peoplePathInRepo } from '../project-model/project-layout.js'
import type { CollabSnapshot } from './state.js'
import { planCreate, planDelete, planUpdate } from './write.js'

export { WriteRejected } from './write.js'

async function listFilesUnder(dir: string, prefix = ''): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      return entry.isDirectory() ? listFilesUnder(path.join(dir, entry.name), relative) : Promise.resolve([relative])
    }),
  )
  return nested.flat()
}

/** 读出磁盘上协作仓的记录：collab/ 下的文件原样放进 files，site/people.json 不在时 people 为 null */
export async function readCollabSnapshot(repo: string): Promise<CollabSnapshot> {
  const collabDir = path.join(repo, collabPathInRepo)
  const files: Record<string, string> = {}
  for (const relative of (await listFilesUnder(collabDir)).sort()) files[relative] = await readFile(path.join(collabDir, relative), 'utf8')
  const peopleFile = path.join(repo, ...peoplePathInRepo.split('/'))
  return { people: existsSync(peopleFile) ? await readFile(peopleFile, 'utf8') : null, files }
}

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

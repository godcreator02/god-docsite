import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { collabPathInRepo, peoplePathInRepo } from '../core/layout.js'
import type { CollabSnapshot } from '../core/state.js'

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

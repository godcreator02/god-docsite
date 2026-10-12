import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** 在临时目录里摆出一个协作仓：site/people.json 与 collab/ 下的文件；people 为 null 时不写人员列表 */
export function repoOnDisk(files: Record<string, string>, people: string | null): string {
  const repo = mkdtempSync(path.join(tmpdir(), 'collab-repo-'))
  mkdirSync(path.join(repo, 'collab'), { recursive: true })
  if (people !== null) {
    mkdirSync(path.join(repo, 'site'), { recursive: true })
    writeFileSync(path.join(repo, 'site', 'people.json'), people)
  }
  for (const [file, content] of Object.entries(files)) writeCollabFile(repo, file, content)
  return repo
}

export function writeCollabFile(repo: string, file: string, content: string) {
  const target = path.join(repo, 'collab', file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
}

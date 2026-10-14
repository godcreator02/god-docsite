/**
 * 从 git 的某个版本里读出记录，交给数据模型包的格式校验：它只认「一组文件」，不认识 git。
 * 记录是一条一个文件：逐个 git show 每个文件都要起一次 git，所以先 ls-tree 列出文件，再一次 cat-file 读完
 */
import { spawn } from 'node:child_process'
import { collabPathInRepo, peoplePathInRepo, type CollabSnapshot } from '@godcreator/collab'
import { git } from '../../git/git.js'

/**
 * `git cat-file --batch` 一次读出多个对象的内容，顺序与 objects 相同；对象写成「版本:路径」。
 * 每条输出是「<id> <类型> <字节数>\n<内容>\n」；读不到的对象回「<名字> missing」，这时报错写明是哪个
 */
function readObjects(repo: string, objects: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], { cwd: repo, windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`git cat-file --batch 失败${stderr.trim() ? `：${stderr.trim()}` : ''}`))
      const output = Buffer.concat(chunks)
      const contents: string[] = []
      let offset = 0
      for (const object of objects) {
        const headerEnd = output.indexOf(0x0a, offset)
        const header = output.subarray(offset, headerEnd).toString('utf8')
        const size = Number(/^\S+ blob (\d+)$/.exec(header)?.[1])
        if (!Number.isInteger(size)) return reject(new Error(`git cat-file --batch 读不到 ${object}：${header}`))
        contents.push(output.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'))
        offset = headerEnd + 1 + size + 1
      }
      resolve(contents)
    })
    child.stdin.end(objects.map((object) => `${object}\n`).join(''))
  })
}

/** git 某个版本里一个目录下的全部文件路径，相对该目录、用 / 分隔；这个版本里没有这个目录时为空 */
async function listFilesAtRevision(repo: string, revision: string, dirInRepo: string): Promise<string[]> {
  const prefix = `${dirInRepo}/`
  const listed = await git(repo, ['ls-tree', '-r', '--name-only', '-z', revision, '--', prefix])
  return listed.split('\0').filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length))
}

/** git 某个版本里的 collab/ 与 site/people.json；这个版本里没有人员列表时 people 为 null */
export async function readCollabSnapshotAtRevision(repo: string, revision: string): Promise<CollabSnapshot> {
  const relativePaths = await listFilesAtRevision(repo, revision, collabPathInRepo)
  const hasPeople = (await git(repo, ['ls-tree', '--name-only', '-z', revision, '--', peoplePathInRepo])).split('\0').includes(peoplePathInRepo)
  const objects = [...relativePaths.map((relative) => `${revision}:${collabPathInRepo}/${relative}`), ...(hasPeople ? [`${revision}:${peoplePathInRepo}`] : [])]
  const contents = await readObjects(repo, objects)
  const files: Record<string, string> = {}
  relativePaths.forEach((relative, index) => (files[relative] = contents[index]!))
  return { people: hasPeople ? contents.at(-1)! : null, files }
}

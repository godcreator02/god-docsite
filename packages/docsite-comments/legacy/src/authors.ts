/**
 * 评论包认识的作者/参与者：宿主投影后传入——可以来自身份包、也可以来自任何来源。
 * 评论包不知道身份码、people.json、Origin 核对这些身份概念：谁在操作由宿主先核对好再传（服务端入口的 actor）
 */

/** 一个作者/参与者：id 存进评论文件的 frontmatter，name 用于显示；agent 只影响 @ 提及的语义（人和 agent 都能被 @） */
export type CommentAuthor = { id: string; name: string; agent?: boolean }

/** 按 id 取作者：评论文件里的作者已经核对过都在名单里，取不到是调用方传错了 */
export function authorOf<T extends CommentAuthor>(people: readonly T[], id: string): T {
  const author = people.find((candidate) => candidate.id === id)
  if (!author) throw new Error(`参与者名单里没有 ${id}`)
  return author
}

/** 评论正文里 @ 了谁：写成 @<id>，id 要在名单里；按出现顺序、不重复 */
export function mentionsOf(body: string, people: readonly CommentAuthor[]): string[] {
  const known = new Set(people.map((person) => person.id))
  const mentioned: string[] = []
  for (const [, id] of body.matchAll(/(?<![\w@])@([\w-]+)/g)) if (known.has(id!) && !mentioned.includes(id!)) mentioned.push(id!)
  return mentioned
}

/** 光标前正在打的 @：start 是 @ 的位置，query 是 @ 后面已经打的字；不在打 @ 时是 null。认法和 mentionsOf 一样 */
export function mentionBeingTyped(textBeforeCursor: string): { start: number; query: string } | null {
  const match = /(?<![\w@])@([\w-]*)$/.exec(textBeforeCursor)
  return match ? { start: match.index, query: match[1]! } : null
}

/** 写 @ 时弹出的名单：id 或名字里含 query 的人（不分大小写），id 以 query 开头的排前面 */
export function authorsMatching<T extends CommentAuthor>(people: readonly T[], query: string): T[] {
  const lowered = query.toLowerCase()
  const matching = people.filter((person) => person.id.toLowerCase().includes(lowered) || person.name.toLowerCase().includes(lowered))
  const startsWithQuery = (person: CommentAuthor) => person.id.toLowerCase().startsWith(lowered)
  return [...matching.filter(startsWithQuery), ...matching.filter((person) => !startsWithQuery(person))]
}

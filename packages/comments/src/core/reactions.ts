/** 能点的表情回应，界面按这个顺序摆；只收这几个，别的表情写进正文 */
export const reactionEmojis = ['👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'] as const
export type ReactionEmoji = (typeof reactionEmojis)[number]

/** 存表情回应的 frontmatter 字段：值是 JSON 字符串 {"<表情>": ["<人员 id>", …]}，人按点的先后排；没人点时整个字段不写 */
export const reactionsField = 'reactions'

/** 一条评论的表情回应：每个表情点了它的人员 id；没有人点的表情不出现 */
export type Reactions = Partial<Record<ReactionEmoji, string[]>>

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (reactionEmojis as readonly string[]).includes(value)
}

/** 读 frontmatter 里的 reactions：不写是没有回应；写了就要是上面那种 JSON，形状不对直接报错并点名文件 */
export function reactionsOf(file: string, value: unknown): Reactions {
  if (value === undefined) return {}
  if (typeof value !== 'string') throw new Error(`${file} 的 ${reactionsField} 要是 JSON 字符串，收到 ${JSON.stringify(value)}`)
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    throw new Error(`${file} 的 ${reactionsField} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${file} 的 ${reactionsField} 要是「表情: [人员 id…]」的对象`)
  const reactions: Reactions = {}
  for (const [emoji, people] of Object.entries(parsed)) {
    if (!isReactionEmoji(emoji)) throw new Error(`${file} 的 ${reactionsField} 里有不能点的表情 ${JSON.stringify(emoji)}`)
    if (!Array.isArray(people) || people.length === 0 || people.some((person) => typeof person !== 'string' || person === '')) {
      throw new Error(`${file} 的 ${reactionsField} 里 ${emoji} 要是非空的人员 id 列表`)
    }
    if (new Set(people).size !== people.length) throw new Error(`${file} 的 ${reactionsField} 里 ${emoji} 有重复的人`)
    reactions[emoji] = people as string[]
  }
  return reactions
}

/** 写回 frontmatter 的值：按 reactionEmojis 的顺序；一个回应都没有时回 undefined，调用方去掉这个字段 */
export function serializeReactions(reactions: Reactions): string | undefined {
  const entries = reactionEmojis.flatMap((emoji) => (reactions[emoji] === undefined ? [] : [[emoji, reactions[emoji]] as const]))
  return entries.length === 0 ? undefined : JSON.stringify(Object.fromEntries(entries))
}

/** 加上（on）或撤掉一个人的一个表情，回新的回应，不改传入的；调用方先确认这个人此刻没点过（加）或点过（撤） */
export function withReaction(reactions: Reactions, emoji: ReactionEmoji, personId: string, on: boolean): Reactions {
  const current = reactions[emoji] ?? []
  const next = on ? [...current, personId] : current.filter((person) => person !== personId)
  const { [emoji]: _removed, ...others } = reactions
  return next.length === 0 ? others : { ...others, [emoji]: next }
}

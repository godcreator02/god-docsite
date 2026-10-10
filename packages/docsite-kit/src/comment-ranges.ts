import DiffMatchPatch from 'diff-match-patch'

/** 评论批的位置：快照里第 start 个字到第 end 个字（不含 end） */
export type CommentRange = readonly [start: number, end: number]

/** 推算到现在这一版页面文字里的位置；changed 表示被批的那段自己被改过 */
export type MappedRange = { start: number; end: number; changed: boolean }

type Diff = [operation: number, text: string]

const equal = 0
const deleted = -1

const differ = new DiffMatchPatch()
// 两版差得太多时最多算 1 秒，算不完就按已算出的粗略结果，不卡住页面
differ.Diff_Timeout = 1

/**
 * 两版页面文字的逐字差异。整理成按词句的差异：碰巧相同的零星几个字不算没改，
 * 否则整段重写后，被批原文的首尾字可能对上新文字里不相干的字
 */
export function diffOfTexts(snapshot: string, current: string): Diff[] {
  const diffs = differ.diff_main(snapshot, current)
  differ.diff_cleanupSemantic(diffs)
  return diffs
}

/**
 * 快照里的位置按差异推算到现在：首尾两个字都落在没改动的文字里才推算得出来，否则返回 undefined。
 * 首尾之间有删改或插入时 changed 为 true
 */
export function mapRangeThroughDiff(diffs: readonly Diff[], [start, end]: CommentRange): MappedRange | undefined {
  let oldAt = 0
  let newAt = 0
  let newStart: number | undefined
  let newEnd: number | undefined
  let changed = false
  for (const [operation, text] of diffs) {
    const { length } = text
    if (operation === equal) {
      if (start >= oldAt && start < oldAt + length) newStart = newAt + start - oldAt
      if (end - 1 >= oldAt && end - 1 < oldAt + length) newEnd = newAt + end - oldAt
      oldAt += length
      newAt += length
    } else if (operation === deleted) {
      if (oldAt < end && oldAt + length > start) changed = true
      oldAt += length
    } else {
      if (oldAt > start && oldAt < end) changed = true
      newAt += length
    }
  }
  if (newStart === undefined || newEnd === undefined || newEnd <= newStart) return undefined
  return { start: newStart, end: newEnd, changed }
}

export type RangeMapper = (snapshot: string, current: string, range: CommentRange) => MappedRange | undefined

/**
 * 把快照里的位置推算到现在这一版页面文字；两版一样时原样返回。
 * 记住每份快照和现在文字的差异：页面每次重排都要重新找位置，文字没变就不重算
 */
export function createRangeMapper(): RangeMapper {
  const diffsOfSnapshot = new Map<string, { current: string; diffs: Diff[] }>()
  return (snapshot, current, range) => {
    if (snapshot === current) return { start: range[0], end: range[1], changed: false }
    let cached = diffsOfSnapshot.get(snapshot)
    if (cached?.current !== current) {
      cached = { current, diffs: diffOfTexts(snapshot, current) }
      diffsOfSnapshot.set(snapshot, cached)
    }
    return mapRangeThroughDiff(cached.diffs, range)
  }
}

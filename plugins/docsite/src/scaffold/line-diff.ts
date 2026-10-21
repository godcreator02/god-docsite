type DiffLine = { kind: ' ' | '-' | '+'; text: string; oldLine: number; newLine: number }

/** 按最长公共子序列把两份文本逐行对齐；模板文件只有几百行，平方级的表够用 */
function alignedLinesOf(oldLines: readonly string[], newLines: readonly string[]): DiffLine[] {
  const common: number[][] = Array.from({ length: oldLines.length + 1 }, () => new Array<number>(newLines.length + 1).fill(0))
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      common[i]![j] = oldLines[i] === newLines[j] ? common[i + 1]![j + 1]! + 1 : Math.max(common[i + 1]![j]!, common[i]![j + 1]!)
    }
  }
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      lines.push({ kind: ' ', text: oldLines[i]!, oldLine: i + 1, newLine: j + 1 })
      i += 1
      j += 1
    } else if (i < oldLines.length && (j === newLines.length || common[i + 1]![j]! >= common[i]![j + 1]!)) {
      // 同样长时先出删掉的行：一处改动读起来是先 - 后 +
      lines.push({ kind: '-', text: oldLines[i]!, oldLine: i + 1, newLine: j })
      i += 1
    } else {
      lines.push({ kind: '+', text: newLines[j]!, oldLine: i, newLine: j + 1 })
      j += 1
    }
  }
  return lines
}

function linesOf(text: string): string[] {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

/** 统一差异格式里一段的行号范围：从第几行起、共几行；0 行时起点是它前面那一行 */
function rangeOf(start: number, count: number): string {
  return count === 1 ? String(start) : `${count === 0 ? start - 1 : start},${count}`
}

/**
 * 两份文本的统一差异格式（只有 @@ 段，没有文件头），每段前后带 context 行没变的；一样就回空串。
 * 行尾的 \r\n 与 \n 算一样
 */
export function unifiedDiffOf(oldText: string, newText: string, context = 2): string {
  const lines = alignedLinesOf(linesOf(oldText), linesOf(newText))
  const changed = lines.flatMap((line, index) => (line.kind === ' ' ? [] : [index]))
  if (changed.length === 0) return ''
  const hunks: Array<[number, number]> = []
  for (const index of changed) {
    const last = hunks.at(-1)
    const start = Math.max(0, index - context)
    const end = Math.min(lines.length - 1, index + context)
    if (last !== undefined && start <= last[1] + 1) last[1] = end
    else hunks.push([start, end])
  }
  return hunks
    .map(([start, end]) => {
      const slice = lines.slice(start, end + 1)
      const oldCount = slice.filter((line) => line.kind !== '+').length
      const newCount = slice.filter((line) => line.kind !== '-').length
      const oldStart = slice.find((line) => line.kind !== '+')?.oldLine ?? slice[0]!.oldLine + 1
      const newStart = slice.find((line) => line.kind !== '-')?.newLine ?? slice[0]!.newLine + 1
      return [`@@ -${rangeOf(oldStart, oldCount)} +${rangeOf(newStart, newCount)} @@`, ...slice.map((line) => `${line.kind}${line.text}`)].join('\n')
    })
    .join('\n')
}

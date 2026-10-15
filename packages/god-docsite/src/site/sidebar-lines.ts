/** 侧栏宽 268px，一格放图标加两个字，一行最多放下四格 */
export const maxCellsPerLine = 4

/**
 * 侧栏横排的格子分成几行：行数取放得下的最少行数，格子平均分到各行，前面的行多放一格。
 * 五格是 3 + 2，六格是 3 + 3，七格是 4 + 3，九格是 3 + 3 + 3
 */
export function sidebarLinesOf<T>(cells: readonly T[]): { lines: T[][]; cellsPerLine: number } {
  const lineCount = Math.max(1, Math.ceil(cells.length / maxCellsPerLine))
  const cellsPerLine = Math.ceil(cells.length / lineCount)
  const lines: T[][] = []
  for (let start = 0; start < cells.length; start += cellsPerLine) lines.push(cells.slice(start, start + cellsPerLine))
  return { lines, cellsPerLine }
}

import { describe, expect, it } from 'vitest'
import { sidebarLinesOf } from '../src/site/sidebar-lines.js'

const lineSizesOf = (count: number) => sidebarLinesOf(Array.from({ length: count }, (_, index) => index)).lines.map((line) => line.length)

describe('侧栏横排分几行', () => {
  it('四格以内一行', () => {
    expect(lineSizesOf(1)).toEqual([1])
    expect(lineSizesOf(3)).toEqual([3])
    expect(lineSizesOf(4)).toEqual([4])
  })

  it('超过四格时用最少的行数，格子平均分，前面的行多放一格', () => {
    expect(lineSizesOf(5)).toEqual([3, 2])
    expect(lineSizesOf(6)).toEqual([3, 3])
    expect(lineSizesOf(7)).toEqual([4, 3])
    expect(lineSizesOf(8)).toEqual([4, 4])
    expect(lineSizesOf(9)).toEqual([3, 3, 3])
  })

  it('各行按第一行的格数分宽', () => {
    expect(sidebarLinesOf([1, 2, 3, 4, 5]).cellsPerLine).toBe(3)
  })
})

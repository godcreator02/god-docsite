import { describe, expect, it } from 'vitest'
import { ProvidedSiteDirs } from '../src/provided-dirs.js'

describe('ProvidedSiteDirs：插件给个人站提供的本机目录', () => {
  it('登记与撤销都让托管方上下文重推；撤销以后名字可以再用', () => {
    let pushes = 0
    const dirs = new ProvidedSiteDirs(() => (pushes += 1))
    const undo = dirs.provide('papers', 'D:/library/papers')
    expect(dirs.all()).toEqual({ papers: 'D:/library/papers' })
    expect(pushes).toBe(1)
    undo()
    undo()
    expect(dirs.all()).toEqual({})
    expect(pushes).toBe(2)
    dirs.provide('papers', 'E:/papers')
    expect(dirs.all()).toEqual({ papers: 'E:/papers' })
  })

  it('同一个名字只许一个提供者；名字与路径写错直接报错', () => {
    const dirs = new ProvidedSiteDirs(() => {})
    dirs.provide('papers', 'D:/library/papers')
    expect(() => dirs.provide('papers', 'E:/other')).toThrow('目录名 papers 已经有人提供了（D:/library/papers）')
    expect(() => dirs.provide('Papers', 'D:/x')).toThrow('要是小写字母开头')
    expect(() => dirs.provide('materials', 'relative/dir')).toThrow('要写绝对路径')
  })
})

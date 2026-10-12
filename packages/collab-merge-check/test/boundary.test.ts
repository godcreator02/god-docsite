import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('合并检查包的边界', () => {
  it('别的包只引用数据模型包的 project-model：执行器只装这个包和没有依赖的数据模型包', () => {
    const srcDir = path.resolve(import.meta.dirname, '../src')
    const outside = readdirSync(srcDir)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => [...readFileSync(path.join(srcDir, name), 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1]!).filter((spec) => !spec.startsWith('./') && !spec.startsWith('node:') && spec !== '@godcreator/collab-model/project-model').map((spec) => `${name} → ${spec}`))
    expect(outside).toEqual([])
  })
})

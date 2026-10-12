import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = path.resolve(import.meta.dirname, '../src')
/** src 下全部源文件，相对 src、用 / 分隔：src 根下的小工具与三个模型目录里的文件 */
const sources = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .map((name) => name.split(path.sep).join('/'))
  .filter((name) => name.endsWith('.ts') && statSync(path.join(srcDir, name)).isFile())
const sourceOf = (name: string) => readFileSync(path.join(srcDir, name), 'utf8')
const importsOf = (name: string) => [...sourceOf(name).matchAll(/from '([^']+)'/g)].map((match) => match[1]!)
/** 相对引用指向的文件，相对 src、用 / 分隔，后缀写回 .ts */
const importedFilesOf = (name: string) =>
  importsOf(name)
    .filter((spec) => spec.startsWith('.'))
    .map((spec) => path.posix.join(path.posix.dirname(name), spec).replace(/\.js$/, '.ts'))
/** 文件属于哪一块：三个模型目录各算一块，src 根下的文件算 root */
const blockOf = (name: string) => (name.includes('/') ? name.split('/')[0]! : 'root')

/** 能在浏览器里用的基础包出口：人员列表与评论的格式 */
const docsiteKitBrowserEntry = '@godcreator/docsite-kit/comments'

describe('数据模型包的边界', () => {
  it('只引用自己的文件、node 内置模块与基础包的人员与评论格式：不认识网站、合并检查与别的包', () => {
    const outside = sources.flatMap((name) =>
      importsOf(name)
        .filter((spec) => !spec.startsWith('.') && !spec.startsWith('node:') && spec !== docsiteKitBrowserEntry)
        .map((spec) => `${name} → ${spec}`),
    )
    expect(outside).toEqual([])
  })

  it('不运行 git：没有文件引用 node:child_process', () => {
    expect(sources.filter((name) => importsOf(name).includes('node:child_process'))).toEqual([])
  })

  it('出口 ./task-model 与 ./notification-model 能在浏览器里用：引用 node 内置模块的只有 task-model/node.ts 与项目布局 project-model/project-layout.ts，别的文件不引用它们', () => {
    const usingNode = sources.filter((name) => importsOf(name).some((spec) => spec.startsWith('node:')))
    expect(usingNode.sort()).toEqual(['project-model/project-layout.ts', 'task-model/node.ts'])
    const nodeOnly = ['task-model/node.ts', 'project-model/project-layout.ts']
    const reachingNode = sources
      .filter((name) => blockOf(name) !== 'project-model' && !nodeOnly.includes(name))
      .flatMap((name) => importedFilesOf(name).filter((file) => nodeOnly.includes(file)).map((file) => `${name} → ${file}`))
    expect(reachingNode).toEqual([])
  })

  it('目录之间的方向：project-model 不引用别的目录；task-model 只引用小工具与项目布局，notification-model 只引用 project-model 与小工具，两者互不引用', () => {
    const allowedBlocks: Record<string, string[]> = {
      root: [],
      'project-model': [],
      'task-model': ['root', 'project-model'],
      'notification-model': ['project-model', 'root'],
    }
    const violations = sources.flatMap((name) => {
      const self = blockOf(name)
      return importedFilesOf(name)
        .map(blockOf)
        .filter((block) => block !== self && !allowedBlocks[self]!.includes(block))
        .map((block) => `${name} → ${block}`)
    })
    expect(violations).toEqual([])
  })

  it('task-model 里文件之间的方向：records 不引用别的文件，people 只引用 records，state、write、inbox 只往 records、people、state 方向引用，node 可以引用全部', () => {
    const allowedImports: Record<string, string[]> = {
      'records.ts': [],
      'people.ts': ['./records.js'],
      'state.ts': ['./records.js', './people.js'],
      'write.ts': ['./records.js', './people.js', './state.js'],
      'inbox.ts': ['./state.js'],
      'node.ts': ['./records.js', './people.js', './state.js', './write.js'],
      'index.ts': ['./records.js', './people.js', './state.js', './write.js', './inbox.js'],
    }
    const inTaskModel = sources.filter((name) => blockOf(name) === 'task-model').map((name) => name.slice('task-model/'.length))
    expect(inTaskModel.slice().sort()).toEqual(Object.keys(allowedImports).sort())
    const violations = inTaskModel.flatMap((name) =>
      importsOf(`task-model/${name}`)
        .filter((spec) => spec.startsWith('./') && !allowedImports[name]!.includes(spec))
        .map((spec) => `${name} → ${spec}`),
    )
    expect(violations).toEqual([])
  })
})

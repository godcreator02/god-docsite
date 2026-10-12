import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createMarkerFileName } from '../src/plan.ts'
import { createSite, rollbackCreatedEntries } from '../src/create.ts'
import {
  binaryFixture,
  expectedCreatedFilesForFullTemplate,
  expectCreateSiteError,
  fileHashesUnder,
  makeTempRoot,
  tryCreateJunction,
  writeSampleTemplate,
} from './helpers.ts'

let root: string
beforeEach(() => {
  root = makeTempRoot('create')
})
afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('createSite', () => {
  it('空目录建站：多层文件、中文、二进制逐字节原样，gitignore 改名，返回清单准确', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)

    const result = createSite({ dir: siteDir, templateDir })

    expect(result.createdFiles).toEqual(expectedCreatedFilesForFullTemplate())
    expect(result.keptFiles).toEqual([])
    expect(fs.readFileSync(path.join(siteDir, 'app', 'root.tsx'), 'utf8')).toBe('中文正文 root\n')
    expect(fs.readFileSync(path.join(siteDir, 'app', 'assets', 'logo.png')).equals(binaryFixture)).toBe(true)
    expect(fs.readFileSync(path.join(siteDir, '.gitignore'), 'utf8')).toBe('node_modules\n')
    expect(fs.existsSync(path.join(siteDir, 'gitignore'))).toBe(false)
    const marker = JSON.parse(fs.readFileSync(path.join(siteDir, createMarkerFileName), 'utf8')) as { tool: string }
    expect(marker.tool).toBe('create-docsite')
  })

  it('同一目标再运行：拒绝且全部文件 hash 不变', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    createSite({ dir: siteDir, templateDir })
    const hashesBefore = fileHashesUnder(siteDir)

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('existing-site')
    expect(fileHashesUnder(siteDir)).toEqual(hashesBefore)
  })

  it('目录里有用户材料（content/、comments/、people.json）：原样保留，默认数据只填缺失', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'content'), { recursive: true })
    fs.mkdirSync(path.join(siteDir, 'comments'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'content', 'keep.mdx'), '用户自己的材料\n')
    fs.writeFileSync(path.join(siteDir, 'comments', '1.json'), '{"已发表":"评论"}\n')
    fs.writeFileSync(path.join(siteDir, 'people.json'), '{"people":[{"id":"u1"}]}\n')
    const userMaterialHashes = new Map([
      ['content/keep.mdx', fileHashesUnder(path.join(siteDir, 'content')).get('keep.mdx')!],
      ['comments/1.json', fileHashesUnder(path.join(siteDir, 'comments')).get('1.json')!],
      ['people.json', fileHashesUnder(siteDir).get('people.json')!],
    ])

    const result = createSite({ dir: siteDir, templateDir })

    expect(result.keptFiles).toEqual(['people.json'])
    expect(result.createdFiles).toContain('content/index.mdx')
    expect(result.createdFiles).not.toContain('people.json')
    expect(fs.readFileSync(path.join(siteDir, 'content', 'keep.mdx'), 'utf8')).toBe('用户自己的材料\n')
    expect(fs.readFileSync(path.join(siteDir, 'comments', '1.json'), 'utf8')).toBe('{"已发表":"评论"}\n')
    expect(fs.readFileSync(path.join(siteDir, 'people.json'), 'utf8')).toBe('{"people":[{"id":"u1"}]}\n')
    expect(fileHashesUnder(path.join(siteDir, 'content')).get('keep.mdx')).toBe(userMaterialHashes.get('content/keep.mdx'))
    expect(fileHashesUnder(path.join(siteDir, 'comments')).get('1.json')).toBe(userMaterialHashes.get('comments/1.json'))
    expect(fileHashesUnder(siteDir).get('people.json')).toBe(userMaterialHashes.get('people.json'))
  })

  it('骨架文件冲突：预检一次列清全部冲突，连不冲突的文件也不写', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    // 冲突文件只能选顶层名字：预置 app/ 或 package.json 会先被「已有站点」判定拦下，到不了冲突预检
    fs.mkdirSync(siteDir, { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'vite.config.ts'), '用户改过的 vite\n')
    fs.writeFileSync(path.join(siteDir, '.gitignore'), '用户自己的忽略规则\n')
    const hashesBefore = fileHashesUnder(siteDir)

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))

    expect(error.code).toBe('conflict')
    expect(error.details.some((line) => line.startsWith('.gitignore（'))).toBe(true)
    expect(error.details.some((line) => line.startsWith('vite.config.ts（'))).toBe(true)
    expect(fileHashesUnder(siteDir)).toEqual(hashesBefore)
    expect(fs.existsSync(path.join(siteDir, 'app'))).toBe(false)
    expect(fs.existsSync(path.join(siteDir, '.create-docsite.json'))).toBe(false)
  })

  it('数据材料不构成冲突：目标已有的 comments 文件按保留处理而不是拒绝', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    // 模板数据材料之外再放一个 comments 默认文件，目标已有同名 → 保留
    fs.mkdirSync(path.join(templateDir, 'comments'), { recursive: true })
    fs.writeFileSync(path.join(templateDir, 'comments', 'seed.json'), '{"默认":"种子"}\n')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'comments'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'comments', 'seed.json'), '{"用户":"自己的"}\n')

    const result = createSite({ dir: siteDir, templateDir })

    expect(result.keptFiles).toContain('comments/seed.json')
    expect(fs.readFileSync(path.join(siteDir, 'comments', 'seed.json'), 'utf8')).toBe('{"用户":"自己的"}\n')
  })

  it('已有站点判定：package.json、app、创建标记各挡一次，全部原样', () => {
    const templateDir = path.join(root, 'template')
    writeSampleTemplate(templateDir)
    for (const markName of ['package.json', 'app', createMarkerFileName]) {
      const siteDir = path.join(root, `site-${markName.replaceAll('.', '_')}`)
      fs.mkdirSync(siteDir, { recursive: true })
      if (markName === 'app') fs.mkdirSync(path.join(siteDir, 'app'))
      else fs.writeFileSync(path.join(siteDir, markName), '{}\n')
      const hashesBefore = fileHashesUnder(siteDir)
      const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
      expect(error.code, `${markName} 存在时要拒绝`).toBe('existing-site')
      expect(error.message).toMatch(new RegExp(markName.replaceAll('.', '\\.')))
      expect(fileHashesUnder(siteDir)).toEqual(hashesBefore)
    }
  })

  it('模板与目标重叠：互相包含与相同都拒绝', () => {
    const templateDir = path.join(root, 'template')
    writeSampleTemplate(templateDir)

    const templateInsideTarget = path.join(root, 'target-1')
    fs.mkdirSync(templateInsideTarget, { recursive: true })
    fs.cpSync(templateDir, path.join(templateInsideTarget, 'template'), { recursive: true })
    const innerTemplate = path.join(templateInsideTarget, 'template')
    expect(expectCreateSiteError(() => createSite({ dir: templateInsideTarget, templateDir: innerTemplate })).code).toBe('overlap')

    const targetInsideTemplate = path.join(templateDir, 'site-inside')
    expect(expectCreateSiteError(() => createSite({ dir: targetInsideTemplate, templateDir })).code).toBe('overlap')

    expect(expectCreateSiteError(() => createSite({ dir: templateDir, templateDir })).code).toBe('overlap')
    expect(fs.existsSync(targetInsideTemplate)).toBe(false)
  })

  it('目标路径已是文件：拒绝且不动它', () => {
    const templateDir = path.join(root, 'template')
    writeSampleTemplate(templateDir)
    const targetFile = path.join(root, 'site.txt')
    fs.writeFileSync(targetFile, '一个文件\n')
    expect(expectCreateSiteError(() => createSite({ dir: targetFile, templateDir })).code).toBe('invalid-path')
    expect(fs.readFileSync(targetFile, 'utf8')).toBe('一个文件\n')
  })

  it('模板目录不存在或不是目录：拒绝', () => {
    const siteDir = path.join(root, 'site')
    expect(expectCreateSiteError(() => createSite({ dir: siteDir, templateDir: path.join(root, 'no-such-template') })).code).toBe('invalid-path')
    const templateFile = path.join(root, 'template.txt')
    fs.writeFileSync(templateFile, '不是目录')
    expect(expectCreateSiteError(() => createSite({ dir: siteDir, templateDir: templateFile })).code).toBe('invalid-path')
    expect(fs.existsSync(siteDir)).toBe(false)
  })

  it.skipIf(process.platform !== 'win32')('目标里的路径段是 junction：预检判冲突，不越界写入', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    const outsideDir = path.join(root, 'outside')
    fs.mkdirSync(siteDir, { recursive: true })
    // content 是数据材料路径：往 junction 里写默认数据同样算越界
    expect(tryCreateJunction(path.join(siteDir, 'content'), outsideDir)).toBe(true)

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('conflict')
    expect(error.details.some((line) => line.startsWith('content（'))).toBe(true)
    expect(fs.readdirSync(outsideDir)).toEqual([])
  })

  it('open 阶段 EEXIST：判冲突，不误记、不误删，用户材料原样（mock 只拦目标内 wx 创建，其余真实 open）', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'content'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'content', 'keep.mdx'), '建站前就在的用户材料\n')
    const before = fileHashesUnder(siteDir)

    const realOpenSync = fs.openSync
    vi.spyOn(fs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
      const file = args[0]
      if (typeof file === 'string' && file.startsWith(siteDir + path.sep) && args[1] === 'wx') {
        throw Object.assign(new Error('模拟预检后目标冒出同名文件'), { code: 'EEXIST' })
      }
      return realOpenSync(...args)
    })

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('conflict')
    expect(error.message).toMatch(/未覆盖/)
    expect(fileHashesUnder(siteDir), 'open 失败的文件不归本次所有，目标一个字节都不能变').toEqual(before)
    expect(fs.existsSync(path.join(siteDir, '.gitignore'))).toBe(false)
  })

  it('open 阶段其他失败（EACCES）：不登记、不删除，目标回到建站前', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'content'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'content', 'keep.mdx'), '建站前就在的用户材料\n')
    const before = fileHashesUnder(siteDir)

    const realOpenSync = fs.openSync
    vi.spyOn(fs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
      const file = args[0]
      if (typeof file === 'string' && file.startsWith(siteDir + path.sep) && args[1] === 'wx') {
        throw Object.assign(new Error('模拟无权创建文件'), { code: 'EACCES' })
      }
      return realOpenSync(...args)
    })

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('io-error')
    expect(error.message).not.toMatch(/残留/)
    expect(fileHashesUnder(siteDir)).toEqual(before)
  })

  it('正文文件部分写入后失败：已创建的文件被回滚撤走，用户材料原样，无残留报告（writeFileSync 注入，落盘与回滚都是真实 IO）', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'content'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'content', 'keep.mdx'), '建站前就在的用户材料\n')
    const before = fileHashesUnder(siteDir)

    let writeCount = 0
    const realWriteFileSync = fs.writeFileSync
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, data: string | Uint8Array, options?: fs.WriteFileOptions) => {
      writeCount += 1
      if (writeCount === 1) {
        // 先真实写入一部分再失败：writeFileSync 的 open 阶段已创建文件，必须有登记、有回滚
        const partial = typeof data === 'string' ? data.slice(0, 5) : data.subarray(0, 5)
        realWriteFileSync(file, partial, options)
        throw Object.assign(new Error('模拟磁盘写满：写入一半失败'), { code: 'ENOSPC' })
      }
      return realWriteFileSync(file, data, options)
    }) as typeof fs.writeFileSync)

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('io-error')
    expect(error.message).toMatch(/磁盘写满/)
    expect(error.message).not.toMatch(/残留/)
    expect(fileHashesUnder(siteDir), '半写的文件也要被撤走，目标回到建站前的样子').toEqual(before)
    expect(fs.existsSync(path.join(siteDir, '.gitignore'))).toBe(false)
  })

  it('创建标记部分写入后失败：marker 与全部正文、目录一起回滚，目标回到建站前', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'content'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'content', 'keep.mdx'), '建站前就在的用户材料\n')
    const before = fileHashesUnder(siteDir)

    const realWriteFileSync = fs.writeFileSync
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, data: string | Uint8Array, options?: fs.WriteFileOptions) => {
      if (typeof data === 'string' && data.includes('create-docsite')) {
        realWriteFileSync(file, data.slice(0, 12), options)
        throw Object.assign(new Error('模拟磁盘写满：marker 写入一半失败'), { code: 'ENOSPC' })
      }
      return realWriteFileSync(file, data, options)
    }) as typeof fs.writeFileSync)

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('io-error')
    expect(error.message).toMatch(/marker/)
    expect(error.message).not.toMatch(/残留/)
    expect(fileHashesUnder(siteDir)).toEqual(before)
    expect(fs.existsSync(path.join(siteDir, createMarkerFileName))).toBe(false)
    expect(fs.existsSync(path.join(siteDir, 'app'))).toBe(false)
  })

  it('目标根目录是本次新建且失败：回滚连根目录一起撤掉，不误报越界', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'made', 'site')
    writeSampleTemplate(templateDir)

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw Object.assign(new Error('模拟写入失败'), { code: 'EIO' })
    })

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('io-error')
    expect(error.message).not.toMatch(/残留|越界/)
    expect(fs.existsSync(siteDir), '自己建的根目录要删干净').toBe(false)
  })

  it('nested-only 模板、目标根不存在、写失败：新建的根目录同样回滚掉', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    fs.mkdirSync(path.join(templateDir, 'nested'), { recursive: true })
    fs.writeFileSync(path.join(templateDir, 'nested', 'file.txt'), 'content')

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw Object.assign(new Error('模拟磁盘写满'), { code: 'ENOSPC' })
    })

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('io-error')
    expect(fs.existsSync(siteDir), 'nested 分支建的根也要登记并回滚').toBe(false)
  })

  it('目标根目录预存在且失败：根目录保留，内部回到建站前', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(path.join(siteDir, 'content'), { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'content', 'keep.mdx'), '建站前就在的用户材料\n')
    const before = fileHashesUnder(siteDir)

    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw Object.assign(new Error('模拟写入失败'), { code: 'EIO' })
    })

    const error = expectCreateSiteError(() => createSite({ dir: siteDir, templateDir }))
    expect(error.code).toBe('io-error')
    expect(fs.existsSync(siteDir), '预存在的根目录不能删').toBe(true)
    expect(fileHashesUnder(siteDir)).toEqual(before)
  })

  it('rollbackCreatedEntries：只删清单里的文件与目录链，越界路径与非空目录不删', () => {
    const siteRoot = path.join(root, 'site')
    fs.mkdirSync(path.join(siteRoot, 'a', 'b'), { recursive: true })
    fs.mkdirSync(path.join(siteRoot, 'stay'), { recursive: true })
    const newFile = path.join(siteRoot, 'a', 'b', 'new.txt')
    fs.writeFileSync(newFile, 'x')
    const userFile = path.join(siteRoot, 'stay', 'user.txt')
    fs.writeFileSync(userFile, '用户文件')

    const report = rollbackCreatedEntries(siteRoot, [newFile], [path.join(siteRoot, 'a', 'b'), path.join(siteRoot, 'a')])
    expect(fs.existsSync(newFile)).toBe(false)
    expect(fs.existsSync(path.join(siteRoot, 'a'))).toBe(false)
    expect(report.leftovers).toEqual([])

    const nonEmptyReport = rollbackCreatedEntries(siteRoot, [], [path.join(siteRoot, 'stay')])
    expect(fs.existsSync(userFile)).toBe(true)
    expect(fs.existsSync(path.join(siteRoot, 'stay'))).toBe(true)
    expect(nonEmptyReport.leftovers).toEqual([`${path.join(siteRoot, 'stay')}（目录非空或删除失败，保留）`])

    const outside = path.join(root, 'outside.txt')
    fs.writeFileSync(outside, '站点根外')
    const outsideReport = rollbackCreatedEntries(siteRoot, [outside], [])
    expect(fs.existsSync(outside)).toBe(true)
    expect(outsideReport.leftovers.length).toBe(1)
  })

  it('目录还不存在：整条链建出来，成功后都在', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'made', 'up', 'path', 'site')
    writeSampleTemplate(templateDir)
    const result = createSite({ dir: siteDir, templateDir })
    expect(fs.existsSync(path.join(siteDir, 'app', 'routes', 'page.tsx'))).toBe(true)
    expect(result.createdFiles.length).toBe(10)
  })
})

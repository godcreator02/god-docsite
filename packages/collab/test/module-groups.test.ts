import { describe, expect, it } from 'vitest'
import { collabState, moduleSectionsOf, parseModuleGroups, planCreate, planUpdate, validateCollab, WriteRejected, type ModuleRecord } from '../src/core/index.js'
import { fileOf, filesOf, moduleId, moduleRecord, snapshotOf, task } from './fixtures.js'

const groupsText = `${JSON.stringify([{ id: 'sst', title: 'SST' }, { id: 'mmc', title: 'MMC' }], null, 2)}\n`
const sstModule: ModuleRecord = { ...moduleRecord, group: 'sst' }
const mmcModule: ModuleRecord = { id: '20260921090000-m2b3c4d', type: 'module', author: 'bob-test', title: '子模块板', due: '2026-10-20', group: 'mmc' }

describe('分组列表 collab/groups.json', () => {
  it('照写的先后读出各组', () => {
    expect(parseModuleGroups(groupsText)).toEqual([
      { id: 'sst', title: 'SST' },
      { id: 'mmc', title: 'MMC' },
    ])
  })

  it('空数组、id 不合规、多出字段、id 或标题重复都报错，写明错在哪', () => {
    const cases: Array<[unknown, RegExp]> = [
      [[], /至少要列一组；不分组就删掉这个文件/],
      [[{ id: 'SST', title: 'SST' }], /第 1 项的 id 要是小写字母、数字，用 - 连接/],
      [[{ id: 'sst', title: 'SST', color: 'red' }], /第 1 项里认不出的字段 color/],
      [[{ id: 'sst', title: '' }], /第 1 项的 title 要是非空字符串/],
      [[{ id: 'sst', title: 'SST' }, { id: 'sst', title: '另一组' }], /id 「sst」写了不止一次/],
      [[{ id: 'sst', title: 'SST' }, { id: 'sst-2', title: 'SST' }], /title 「SST」写了不止一次/],
      [{ sst: 'SST' }, /要是分组的数组/],
    ]
    for (const [value, message] of cases) expect(() => parseModuleGroups(JSON.stringify(value))).toThrow(message)
  })
})

describe('读出状态与校验', () => {
  it('分组列表不当记录读；模块的分组照原样读出', () => {
    const state = collabState(snapshotOf({ ...filesOf(sstModule, mmcModule), 'groups.json': groupsText }))
    expect(state.problems).toEqual([])
    expect(state.groups.map((group) => group.id)).toEqual(['sst', 'mmc'])
    expect(state.modules.map((module) => module.group)).toEqual(['sst', 'mmc'])
  })

  it('没有分组列表时 groups 是空的；模块写了分组就是指向不存在的分组', () => {
    const state = collabState(snapshotOf(filesOf(sstModule)))
    expect(state.groups).toEqual([])
    expect(state.problems).toEqual([{ file: fileOf(sstModule), message: '模块的分组 sst 不在 collab/groups.json 里' }])
  })

  it('分组列表读不出：只报这个文件，不再逐个报模块的分组', () => {
    const problems = validateCollab(snapshotOf({ ...filesOf(sstModule), 'groups.json': '[]\n' }))
    expect(problems).toEqual([{ file: 'groups.json', message: expect.stringMatching(/至少要列一组/) as string }])
  })

  it('模块写的分组不在列表里，校验报出来', () => {
    const stray: ModuleRecord = { ...moduleRecord, group: 'hil' }
    expect(validateCollab(snapshotOf({ ...filesOf(stray), 'groups.json': groupsText }))).toEqual([{ file: fileOf(stray), message: '模块的分组 hil 不在 collab/groups.json 里' }])
  })
})

describe('写入规则', () => {
  const snapshot = snapshotOf({ ...filesOf(task, moduleRecord), 'groups.json': groupsText })

  it('别人能改模块的分组', () => {
    const plan = planUpdate({ snapshot, person: 'carol-test', body: { id: moduleId, fields: { group: 'mmc' } } })
    expect(plan.write[0]!.content).toContain('"group": "mmc"')
  })

  it('新建模块写了列表里没有的分组：拒绝', () => {
    expect(() => planCreate({ snapshot, person: 'bob-test', body: { type: 'module', title: 'HIL 板', due: '2026-11-01', group: 'hil' } })).toThrow(WriteRejected)
  })
})

describe('分到各张甘特图', () => {
  const ungrouped: ModuleRecord = { id: '20260922090000-m3c4d5e', type: 'module', author: 'godcreator', title: '机架', due: '2026-10-05' }
  const groups = parseModuleGroups(groupsText)
  const modules = [sstModule, mmcModule, ungrouped].map(({ type: _type, ...module }) => module)

  it('不分组时只有一张，按截止日排', () => {
    expect(moduleSectionsOf(modules, []).map((section) => [section.group, section.modules.map((module) => module.title)])).toEqual([[null, ['机架', '子模块板', '采样板']]])
  })

  it('分组时按列表的先后，没有模块的组不画，没写分组的放在最后', () => {
    const sections = moduleSectionsOf(modules, [...groups, { id: 'hil', title: 'HIL' }])
    expect(sections.map((section) => [section.group?.id ?? null, section.modules.map((module) => module.title)])).toEqual([
      ['sst', ['采样板']],
      ['mmc', ['子模块板']],
      [null, ['机架']],
    ])
  })
})

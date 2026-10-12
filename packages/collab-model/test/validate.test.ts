import { describe, expect, it } from 'vitest'
import { validateCollab } from '../src/task-model/index.js'
import { cleanSnapshot, fileOf, filesOf, moduleRecord, snapshotOf, task, textOf } from './fixtures.js'

const messagesOf = (issues: ReturnType<typeof validateCollab>) => issues.map((issue) => `${issue.file} ${issue.message}`)

describe('校验', () => {
  it('规范的记录没有问题', () => {
    expect(validateCollab(cleanSnapshot)).toEqual([])
  })

  it('缺人员列表', () => {
    expect(messagesOf(validateCollab(snapshotOf({}, null)))).toEqual(['people.json 缺少人员列表 site/people.json'])
  })

  it('人员列表格式不对', () => {
    expect(messagesOf(validateCollab(snapshotOf({}, '[1]')))).toEqual([expect.stringMatching(/^people\.json /)])
  })

  it('不是规范写法：键序不对、写成一行、缺最后的换行', () => {
    const { type, ...rest } = task
    const shuffled = `${JSON.stringify({ type, ...rest }, null, 2)}\n`
    for (const text of [shuffled, `${JSON.stringify(task)}\n`, textOf(task).slice(0, -1)]) {
      const issues = validateCollab(snapshotOf({ [fileOf(task)]: text }))
      expect(messagesOf(issues)).toEqual([`${fileOf(task)} 不是规范写法：键序、缩进、空白、转义或结尾换行和重新编码的结果不同`])
    }
  })

  it('解码失败的文件报出来', () => {
    const issues = validateCollab(snapshotOf({ [fileOf(task)]: '{"id":\n' }))
    expect(messagesOf(issues)).toEqual([expect.stringMatching(/^records\/20260925160530-t5v9w3d\.json .*不是合法 JSON/)])
  })

  it('文件名和记录的 id 对不上', () => {
    const issues = validateCollab(snapshotOf({ ...filesOf(moduleRecord), 'records/20260925000000-aaaaaaa.json': textOf(task) }))
    expect(messagesOf(issues)).toEqual([expect.stringMatching(/文件名是 20260925000000-aaaaaaa\.json，记录的 id 却是 20260925160530-t5v9w3d/)])
  })

  it('人员列表里没有的作者、负责人', () => {
    const strangerTask = { ...task, author: 'dave', owner: 'frank' }
    const issues = messagesOf(validateCollab(snapshotOf(filesOf(strangerTask))))
    expect(issues).toEqual([`${fileOf(task)} 作者 dave 不在 site/people.json 里`, `${fileOf(task)} 负责人 frank 不在 site/people.json 里`])
  })

  it('换行符是 CRLF', () => {
    const issues = validateCollab(snapshotOf({ [fileOf(task)]: textOf(task).replaceAll('\n', '\r\n') }))
    expect(messagesOf(issues)).toEqual([expect.stringMatching(/CRLF/)])
  })

  it('认不出的文件：不在 records/ 下、扩展名不对、目录套了两层', () => {
    const issues = validateCollab(snapshotOf({ ...cleanSnapshot.files, 'notes.txt': 'x', 'bob-test/a.json': 'x', 'records/draft.md': 'x', 'records/bob-test/a.json': 'x' }))
    expect(messagesOf(issues)).toEqual([
      expect.stringMatching(/^notes\.txt .*认不出/),
      expect.stringMatching(/^bob-test\/a\.json .*认不出/),
      expect.stringMatching(/^records\/draft\.md .*认不出/),
      expect.stringMatching(/^records\/bob-test\/a\.json .*认不出/),
    ])
  })
})

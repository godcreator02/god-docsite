import { describe, expect, it } from 'vitest'
import { CollabFormatError, decodeRecordFile, encodeRecordFile } from '../src/core/index.js'
import { moduleRecord, task, textOf } from './fixtures.js'

describe('记录文件的编码与解码', () => {
  it('两格缩进、一个字段一行、中文不转义、以换行结尾', () => {
    expect(encodeRecordFile(moduleRecord)).toBe(
      [
        '{',
        '  "id": "20260920090000-m1a2b3c",',
        '  "type": "module",',
        '  "author": "godcreator",',
        '  "title": "采样板",',
        '  "due": "2026-10-31",',
        '  "owner": "bob-test"',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('规范的文件解码再编码，字节不变', () => {
    for (const record of [task, moduleRecord]) {
      expect(encodeRecordFile(decodeRecordFile(textOf(record)))).toBe(textOf(record))
    }
  })

  it('编码时键序固定：id、type、author 在前，其余按记录类型的顺序', () => {
    const text = encodeRecordFile({ due: '2026-10-10', owner: 'carol-test', title: '补 ADC 通道对比', status: 'todo', author: 'godcreator', type: 'task', id: task.id })
    expect(text).toBe(textOf(task))
  })

  it('没有的字段不写', () => {
    const { owner: _owner, due: _due, ...bare } = task
    expect(encodeRecordFile(bare)).not.toMatch(/owner|due|null/)
  })

  const rejected: Array<[string, string, RegExp]> = [
    ['不是 JSON', '{"id":', /不是合法 JSON/],
    ['不是对象', '[1,2]', /JSON 对象/],
    ['认不出的键', textOf({ ...task, extra: 1 }), /认不出的字段 extra/],
    ['评论记录（评论在站点的 comments/ 里）', textOf({ id: '20260925143201-k3f9x2a', type: 'comment', author: 'bob-test' }), /认不出的记录类型 comment：collab\/records\/ 里只有任务 task 与模块 module，评论在站点的 comments\/ 里/],
    ['id 格式不对', textOf({ ...task, id: '2026-09-25' }), /id/],
    ['缺必填字段', textOf({ id: task.id, type: 'task', author: 'godcreator', status: 'todo' }), /缺少字段 title/],
    ['任务状态认不出', textOf({ ...task, status: 'blocked' }), /status 只能是 todo、doing、done/],
    ['截止日期格式不对', textOf({ ...task, due: '10/10' }), /due/],
    ['写成 null', textOf({ ...task, due: null }), /due/],
  ]
  for (const [name, text, message] of rejected) {
    it(`拒绝：${name}`, () => {
      expect(() => decodeRecordFile(text)).toThrow(CollabFormatError)
      expect(() => decodeRecordFile(text)).toThrow(message)
    })
  }

  it('没解决完的 git 冲突：报出每个冲突标记所在的行', () => {
    const conflicted = textOf(task).replace(
      '  "status": "todo",\n',
      '<<<<<<< HEAD\n  "status": "doing",\n=======\n  "status": "done",\n>>>>>>> 1a2b3c4 (bob 的改动)\n',
    )
    expect(() => decodeRecordFile(conflicted)).toThrow(/git 合并冲突没解决完（第 5、7、9 行是冲突标记）/)
  })

  it('编码前同样校验，不合规的记录不能写出去', () => {
    expect(() => encodeRecordFile({ ...task, title: '' })).toThrow(/title/)
  })
})

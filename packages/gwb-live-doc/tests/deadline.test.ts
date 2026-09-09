import { describe, expect, it } from 'vitest'
import {
  autoStopMinutes,
  deadlineFor,
  dueState,
  formatRemaining,
  WARN_BEFORE_MS,
} from '../src/deadline.js'

/**
 * 到点自动关的算术：设置值怎么收窄、到期时刻怎么算、剩多少怎么显、什么时候该提醒。
 * 全是纯函数——时间由调用方传进来，不读系统时钟。
 */

const NOW = 1_700_000_000_000

describe('autoStopMinutes：设置值 → 分钟数', () => {
  it('数字原样；0 合法（= 不自动关）', () => {
    expect(autoStopMinutes(120)).toBe(120)
    expect(autoStopMinutes(0)).toBe(0)
  })
  it('数字串也认——设置件的 number 型值从界面来时可能是字符串', () => {
    expect(autoStopMinutes('90')).toBe(90)
    expect(autoStopMinutes(' 30 ')).toBe(30)
  })
  it('缺、空、负数、NaN、非数都回缺省 120', () => {
    for (const raw of [undefined, null, '', 'abc', -5, Number.NaN, {}, true]) {
      expect(autoStopMinutes(raw), JSON.stringify(raw)).toBe(120)
    }
  })
  it('小数向下取整到分钟', () => {
    expect(autoStopMinutes(2.9)).toBe(2)
  })
})

describe('deadlineFor：绝对到期时刻', () => {
  it('分钟数 × 60 秒加到 now 上', () => {
    expect(deadlineFor(NOW, 120)).toBe(NOW + 120 * 60_000)
  })
  it('0 分钟 = 没有到期时刻', () => {
    expect(deadlineFor(NOW, 0)).toBeUndefined()
  })
})

describe('formatRemaining：剩余毫秒 → 人看的短串', () => {
  it('不到一分钟、几分钟、带小时', () => {
    expect(formatRemaining(30_000)).toBe('<1m')
    expect(formatRemaining(9 * 60_000)).toBe('9m')
    expect(formatRemaining(118 * 60_000)).toBe('1h58m')
    expect(formatRemaining(2 * 60 * 60_000 + 5 * 60_000)).toBe('2h05m')
  })
  it('负数按 <1m 显——到点那一刻还没来得及停时不显负数', () => {
    expect(formatRemaining(-5000)).toBe('<1m')
  })
})

describe('dueState：对表的三态', () => {
  it('没有到期时刻永远 ok', () => {
    expect(dueState(undefined, NOW)).toBe('ok')
  })
  it('还早是 ok；进了提前量是 warn；过了点是 expired', () => {
    const deadline = NOW + 60 * 60_000
    expect(dueState(deadline, NOW)).toBe('ok')
    expect(dueState(deadline, deadline - WARN_BEFORE_MS)).toBe('warn')
    expect(dueState(deadline, deadline - 1)).toBe('warn')
    expect(dueState(deadline, deadline)).toBe('expired')
    expect(dueState(deadline, deadline + 1)).toBe('expired')
  })
  it('提前量是五分钟', () => {
    expect(WARN_BEFORE_MS).toBe(5 * 60_000)
  })
})

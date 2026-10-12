import { isPlainObject } from '../plain-object.js'

/** gwb-collab 推给网站的数据（整份 SiteFeed 或其中的通知列表）形状不对 */
export class InvalidSiteFeed extends Error {}

/** 下面每个函数查一项外部输入，where 写明是哪一项，不对就抛 InvalidSiteFeed */
export type FieldCheck<T> = (value: unknown, where: string) => T

export function objectOf(value: unknown, where: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new InvalidSiteFeed(`${where} 要是对象`)
  return value
}

/** 只收这几个键，多了、少了、认不出的直接拒收 */
export function fieldsOf(value: unknown, where: string, keys: readonly string[]): Record<string, unknown> {
  const object = objectOf(value, where)
  const unknownKey = Object.keys(object).find((key) => !keys.includes(key))
  if (unknownKey !== undefined) throw new InvalidSiteFeed(`${where} 里认不出的字段 ${unknownKey}`)
  const missingKey = keys.find((key) => !(key in object))
  if (missingKey !== undefined) throw new InvalidSiteFeed(`${where} 里缺字段 ${missingKey}`)
  return object
}

export function textOf(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new InvalidSiteFeed(`${where} 要是字符串，收到 ${JSON.stringify(value)}`)
  return value
}

export function textOrNullOf(value: unknown, where: string): string | null {
  return value === null ? null : textOf(value, where)
}

export function countOf(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new InvalidSiteFeed(`${where} 要是非负整数，收到 ${JSON.stringify(value)}`)
  return value
}

export function textsOf(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new InvalidSiteFeed(`${where} 要是字符串数组`)
  return value
}

export function oneOf<T extends string>(value: unknown, where: string, allowed: readonly T[]): T {
  const found = allowed.find((each) => each === value)
  if (found === undefined) throw new InvalidSiteFeed(`${where} 要是 ${allowed.join(' / ')} 之一，收到 ${JSON.stringify(value)}`)
  return found
}

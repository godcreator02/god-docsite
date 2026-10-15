import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve(import.meta.dirname, '../src')

/** src 下全部源文件，相对 src、用 / 分隔 */
export const sources = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .map((name) => name.split(path.sep).join('/'))
  .filter((name) => /\.tsx?$/.test(name))

export const importsOfFile = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1]!)

export const importsOf = (name: string) => importsOfFile(path.join(srcDir, name))

/** 一个文件经相对 import 能走到的全部本包文件（含自己） */
export function reachableFrom(name: string, seen = new Set<string>()): Set<string> {
  if (seen.has(name)) return seen
  seen.add(name)
  for (const spec of importsOf(name).filter((each) => each.startsWith('.'))) {
    const target = path.posix.join(path.posix.dirname(name), spec).replace(/\.js$/, '')
    reachableFrom(sources.find((file) => file.replace(/\.tsx?$/, '') === target)!, seen)
  }
  return seen
}

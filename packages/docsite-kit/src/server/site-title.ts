import { existsSync } from 'node:fs'
import path from 'node:path'
import { jsonFileOf } from './site-people.js'

/** 站名：content/meta.json 的 title（侧栏顶上那个名字）；没有这个文件或没写 title 时为 null */
export function siteTitleOf(siteDir: string): string | null {
  const file = path.join(siteDir, 'content', 'meta.json')
  if (!existsSync(file)) return null
  const meta = jsonFileOf(file, `站点目录里没有 content/meta.json`)
  const title = typeof meta === 'object' && meta !== null && !Array.isArray(meta) ? (meta as Record<string, unknown>)['title'] : undefined
  return typeof title === 'string' && title !== '' ? title : null
}

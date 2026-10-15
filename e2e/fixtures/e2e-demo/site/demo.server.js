import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function countIn(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).count : 0
}

export function demoLoader(_args, site) {
  return { count: countIn(site.counterFile) }
}

export async function demoAction({ request }, site) {
  if (request.method !== 'POST') throw new Response(null, { status: 405 })
  const count = countIn(site.counterFile) + 1
  mkdirSync(path.dirname(site.counterFile), { recursive: true })
  writeFileSync(site.counterFile, `${JSON.stringify({ count })}\n`)
  return { count }
}

/** 集合页面的 loader：按地址里的 slug 找集合条目，交给浏览器路径与标题 */
export function noteLoader({ params }, site) {
  const entry = site.notes.find((candidate) => candidate.info.path === `${params.slug}.mdx`)
  if (!entry) throw new Response(`没有笔记 ${params.slug}`, { status: 404 })
  return { path: entry.info.path, title: entry.title }
}

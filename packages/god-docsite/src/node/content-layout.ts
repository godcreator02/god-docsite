import { readdirSync } from 'node:fs'
import path from 'node:path'
import { pageNameOf } from '../core/page-files.js'

const wherePageFilesGo = '只给一页用的放进和页面同名的文件夹，同一组里几页共用的放进组里 _ 开头的文件夹，几组都要用的放站点 app/components/'

/**
 * 内容目录里放错位置的文件，每条写明是哪个文件（相对内容目录）、该怎么放；都放对了是空数组。
 * 组文件夹（内容目录本身与里面的子组）只放页面、meta.json、页面的同名文件夹、_ 开头的文件夹与子组；
 * 同名文件夹与 _ 开头的文件夹里放页面要用的文件，不放页面与 meta.json：fumadocs 解析 meta.json 的 pages 时先找文件夹，
 * 同名文件夹里一有页面就被当成一组，同名的那一页从侧栏消失
 */
export function misplacedContentFilesOf(contentDir: string): string[] {
  const problems: string[] = []

  const visitPageAssets = (dir: string, relative: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = `${relative}/${entry.name}`
      if (entry.isDirectory()) visitPageAssets(path.join(dir, entry.name), entryPath)
      else if (entry.name === 'meta.json' || pageNameOf(entry.name) !== null) {
        problems.push(`${entryPath}：页面的同名文件夹与 _ 开头的文件夹里不放页面和 meta.json；页面放进组文件夹，有子页面的页写成文件夹加 index 页`)
      }
    }
  }

  const visitGroup = (dir: string, relative: string) => {
    const entries = readdirSync(dir, { withFileTypes: true })
    const pageNames = new Set(entries.filter((entry) => !entry.isDirectory()).map((entry) => pageNameOf(entry.name)))
    for (const entry of entries) {
      const entryPath = relative === '' ? entry.name : `${relative}/${entry.name}`
      if (!entry.isDirectory()) {
        if (entry.name !== 'meta.json' && pageNameOf(entry.name) === null) problems.push(`${entryPath}：组文件夹里只放页面、meta.json 与文件夹；${wherePageFilesGo}`)
      } else if (pageNames.has(entry.name) || entry.name.startsWith('_')) visitPageAssets(path.join(dir, entry.name), entryPath)
      else visitGroup(path.join(dir, entry.name), entryPath)
    }
  }

  visitGroup(contentDir, '')
  return problems
}

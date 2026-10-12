import type { ComponentType } from 'react'

export type PageMeta = { title: string }
type PageModule = { meta: PageMeta; default: ComponentType }

export type CommentAnchor = {
  /** 页面区块上的 data-anchor 值；有它就按它定位 */
  selector?: string
  /** 被批注元素开头的一段文字，按「包含这段文字的最内层元素」定位 */
  quote?: string
  tag?: string
  /** 批注当时 code-inspector-plugin 给出的源码位置（文件:行:列:标签），只给 AI 找源码用，不参与定位 */
  insp?: string
}
export type CommentReply = { author: string; createdAt: string; text: string }
export type Comment = {
  id: string
  anchor: CommentAnchor
  author: string
  createdAt: string
  status: 'open' | 'resolved'
  text: string
  replies: CommentReply[]
}
export type Task = {
  id: string
  group?: string
  groupWhen?: string
  title: string
  detail?: string
  owner: string | null
  status: 'todo' | 'doing' | 'done'
  due: string | null
}
export type CollabData = { comments: Comment[]; tasks: Task[] }

export type SitePage = {
  /** 相对站点根、去掉扩展名的源文件路径，如 pages/sst/comm-test；collab.json 与它同名 */
  key: string
  url: string
  title: string
  Component: ComponentType
  collab: CollabData
}

const pageModules = import.meta.glob<PageModule>('/pages/**/*.tsx', { eager: true })
const collabFiles = import.meta.glob<CollabData>('/pages/**/*.collab.json', { eager: true, import: 'default' })
const folderMetaFiles = import.meta.glob<{ title: string }>('/pages/**/_folder.json', { eager: true, import: 'default' })

function keyToUrl(key: string) {
  const withoutRoot = key.replace(/^pages/, '')
  const withoutIndex = withoutRoot.replace(/\/index$/, '')
  return withoutIndex === '' ? '/' : withoutIndex
}

export const sitePages: SitePage[] = Object.entries(pageModules)
  .map(([file, module]) => {
    const key = file.replace(/^\//, '').replace(/\.tsx$/, '')
    if (!module.meta?.title) throw new Error(`${file} 没有导出 meta.title`)
    return {
      key,
      url: keyToUrl(key),
      title: module.meta.title,
      Component: module.default,
      collab: collabFiles[`/${key}.collab.json`] ?? { comments: [], tasks: [] },
    }
  })
  .sort((a, b) => a.key.localeCompare(b.key))

export function folderTitle(folderPath: string) {
  return folderMetaFiles[`/${folderPath}/_folder.json`]?.title ?? folderPath.split('/').at(-1)!
}

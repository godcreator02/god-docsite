import path from 'node:path'
import { commentsAccessOf } from '@godcreator/comments/site'
import { externalPageThreads, handleCommentWrite } from '@godcreator/comments/site/server'
import { compileExternalMdx, externalFileResponse } from '@godcreator/god-docsite/server'
import { allItems, itemOf, itemsDirOf, pageFileOf, type LibraryItem } from 'fixture-papers'
import { site } from '@/lib/site.server'

const urlBase = '/fixture-papers'
const filesUrlBase = '/fixture-papers-files'

const itemsDir = () => itemsDirOf({ siteDir: site.dir, audience: site.audience, providedDirs: site.providedDirs() })

function itemAt(id: string): LibraryItem {
  const dir = itemsDir()
  const item = dir === undefined ? undefined : itemOf(dir, id)
  if (item === undefined) throw new Response(`本站没有条目 ${id}`, { status: 404 })
  return item
}

/** 评论跟着材料走：个人站存在条目旁边的 comments/，shared 站存在站点自己的 comments/（进全站评论页） */
function commentsDirOf(item: LibraryItem): string {
  return site.audience === 'personal' ? path.join(item.dir, 'comments') : site.commentsDir
}

/** 条目一页的数据：外部 mdx 的编译结果与这一页的评论；评论归属键是页面地址（按路由参数拼：客户端导航时 loader 收到的地址带 .data） */
export async function itemPageData(id: string, pageName: string | undefined) {
  const item = itemAt(id)
  const page = pageName === undefined ? item.pages[0] : item.pages.find((each) => each.name === pageName)
  if (page === undefined) throw new Response(`条目 ${id} 没有 ${pageName} 这一页`, { status: 404 })
  const plugins = await site.mdxPlugins()
  const key = pageName === undefined ? `${urlBase}/${id}` : `${urlBase}/${id}/${pageName}`
  const commentsDir = commentsDirOf(item)
  const { threads, bodies } = await externalPageThreads({
    commentsDir,
    people: site.people(),
    page: key,
    compileBody: (file) => compileExternalMdx(file, { plugins, rootDir: commentsDir, assetsHrefOf: (relative) => relative }),
  })
  return {
    title: item.pages.length === 1 ? item.title : `${page.title} · ${item.title}`,
    key,
    compiled: await compileExternalMdx(pageFileOf(item, page.name), { plugins, rootDir: item.dir, assetsHrefOf: (relative) => `${filesUrlBase}/${item.id}/${relative}` }),
    threads,
    bodies,
    access: commentsAccessOf(site.identity()),
  }
}

export function writeItemComment(request: Request, id: string) {
  return handleCommentWrite({ request, commentsDir: commentsDirOf(itemAt(id)), people: site.people(), identity: site.identity(), trustedOrigin: site.trustedOrigin() })
}

export function itemFileResponse(request: Request, id: string, relativePath: string) {
  return externalFileResponse(itemAt(id).dir, relativePath, request)
}

export function searchItems() {
  return allItems(itemsDir()).map((item) => ({ id: item.id, title: item.title, url: `${urlBase}/${item.id}` }))
}

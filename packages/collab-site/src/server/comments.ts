import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { data } from 'react-router'
import { createReply, createThread, deleteReply, deleteThread } from '@godcreator/docsite-comments/server'
import { authorizeWrite, identityCodeEnvName, identityOf, sitePeople, writeAccessResponse } from '@godcreator/docsite-identity/server'
import { pageThreads } from '@site/lib/comments.server'
import { siteOrigin } from './index.js'

/*
 * 协作站页面（任务页、任务与模块各自那一页、日志页）上的评论，接法照骨架的内容页：loader 读这一页的评论与本机身份，
 * action 核对后调评论包的写函数。评论归属键用页面地址（如 /tasks、/tasks/<记录 id>）：功能包页面不在 docs 集合里，
 * 评论串 frontmatter 的 page 写的也是地址，两边一致；删了任务，批它那一页的评论照样留着
 */

const commentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../comments')

/** 一页上的评论要的数据：评论串（作者解析成可信的 {id, name}）、能不能写、写的人是谁；只在路由的 loader 里调 */
export function routeCommentData(page: string) {
  const identity = identityOf(sitePeople(), process.env[identityCodeEnvName])
  return {
    threads: pageThreads(page),
    writable: identity.person !== null,
    writer: identity.person ? { id: identity.person.id, name: identity.person.name } : null,
    readOnlyReason: identity.person ? null : identity.reason,
  }
}

export type RouteCommentData = Awaited<ReturnType<typeof routeCommentData>>

/** 写评论的接口（表单 POST，骨架内容页的 action 同一套）：核对 Origin 与身份后建串、回复、删除 */
export async function routeCommentsAction(request: Request) {
  const form = await request.formData()
  try {
    const author = authorizeWrite(request, { identity: identityOf(sitePeople(), process.env[identityCodeEnvName]), people: sitePeople(), origin: siteOrigin })
    const intent = form.get('intent')
    switch (intent) {
      case 'create-thread': {
        const created = await createThread(commentsDir, {
          page: String(form.get('page') ?? ''),
          authorId: author.id,
          body: String(form.get('body') ?? ''),
          ...(String(form.get('anchor') ?? '') !== '' ? { anchor: String(form.get('anchor')) } : {}),
        })
        return data({ ok: true, intent, threadId: created.id })
      }
      case 'reply': {
        const threadId = String(form.get('threadId') ?? '')
        const created = await createReply(commentsDir, threadId, { authorId: author.id, body: String(form.get('body') ?? '') })
        return data({ ok: true, intent, threadId, replyId: created.id })
      }
      case 'delete-reply':
        await deleteReply(commentsDir, String(form.get('threadId') ?? ''), String(form.get('replyId') ?? ''))
        return data({ ok: true, intent })
      case 'delete-thread':
        await deleteThread(commentsDir, String(form.get('threadId') ?? ''))
        return data({ ok: true, intent })
      default:
        return data({ ok: false, error: 'unknown-intent' }, { status: 400 })
    }
  } catch (error) {
    return writeAccessResponse(error)
  }
}

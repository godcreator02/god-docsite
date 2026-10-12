import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useState, type ComponentType } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { DocsBody, DocsDescription, DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { data } from 'react-router'
import { contentFileUrlOf, type HtmlHeadingAnchor } from '@godcreator/docsite-page-sources'
import { HtmlPageBody, TsxPageBody } from '@godcreator/docsite-page-sources/ui'
import { createReply, createThread, deleteReply, deleteThread } from '@godcreator/docsite-comments/server'
import { CommentsSidebar } from '@godcreator/docsite-comments/react'
import { PageTitleWithWideToggle } from '@godcreator/docsite-ui'
import { pageThreads } from '../lib/comments.server'
import { authorizeCommentWrite, siteIdentity, sitePeople, writeAccessResponse } from '../lib/identity.server'
import { siteName, source } from '../lib/source.server'
import { tsxPageModules } from '../lib/collections'
import { commentContent, docsContent } from '../lib/client-content'
import type { Route } from './+types/page'

const commentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../comments')

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })

  // 评论归属键用页面在 docs 集合里的路径（如 "index.mdx"、"writing/collapse-test.mdx"）
  const identity = siteIdentity()
  const shared = {
    title: page.data.title,
    description: page.data.description ?? null,
    url: page.url,
    siteName: siteName(),
    pageTree: await source.serializePageTree(source.getPageTree()),
    pageKey: page.path,
    threads: pageThreads(page.path),
    writable: identity.person !== null,
    writer: identity.person ? { id: identity.person.id, name: identity.person.name } : null,
    readOnlyReason: identity.person ? null : identity.reason,
    asChoices: identity.person
      ? [identity.person, ...sitePeopleAgents(identity.person.id)]
      : [],
  }
  if (page.type === 'mdx') return { type: 'mdx' as const, ...shared, path: page.path }
  if (page.type === 'tsx') return { type: 'tsx' as const, ...shared, file: page.data.file }
  return { type: 'html' as const, ...shared, src: contentFileUrlOf(page.data.file), headings: page.data.headings }
}

/** 可代署名的 agent（本人之外） */
function sitePeopleAgents(exceptId: string) {
  return sitePeople().filter((person) => person.agent && person.id !== exceptId).map((person) => ({ id: person.id, name: person.name }))
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData()
  try {
    const author = authorizeCommentWrite(request, form)
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

/** 评论正文：宿主把集合的 client loader 包成组件交给评论包的侧栏 */
function CommentBody({ path: commentPath }: { path: string }) {
  return commentContent.useContent(commentPath)
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { type, pageKey, threads, writable, writer, readOnlyReason, asChoices, siteName, title, description } = loaderData
  const sidebar = (
    <CommentsSidebar
      pagePath={pageKey}
      threads={threads}
      access={writable && writer ? { kind: 'writable', writer, asChoices } : { kind: 'readonly', reasonCode: 'readonly', reasonText: readOnlyReason ?? '站点只读' }}
      BodyComponent={CommentBody as ComponentType<{ path: string }>}
    />
  )
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <title>{`${title} · ${siteName}`}</title>
        {type === 'mdx' ? <MdxPage path={loaderData.path} /> : type === 'tsx' ? <TsxPage file={loaderData.file} title={title} description={description} /> : <HtmlPage src={loaderData.src} title={title} description={description} headings={loaderData.headings} />}
      </div>
      {sidebar}
    </div>
  )
}

function MdxPage({ path }: { path: string }) {
  return docsContent.useContent(path)
}

function TsxPage({ file, title, description }: { file: string; title: string; description: string | null }) {
  const load = tsxPageModules[file]
  if (!load) throw new Error(`浏览器端没有这个 TSX 页面：${file}`)
  const [toc, setToc] = useState<TOCItemType[]>([])
  return (
    <DocsPage toc={toc} tableOfContentPopover={{ enabled: toc.length > 0 }}>
      <PageTitleWithWideToggle>{title}</PageTitleWithWideToggle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <TsxPageBody load={load} onToc={setToc} />
      </DocsBody>
    </DocsPage>
  )
}

function HtmlPage({ src, title, description, headings }: { src: string; title: string; description: string | null; headings: HtmlHeadingAnchor[] }) {
  const toc = headings.map(({ id, text, level }) => ({ title: text, url: `#${id}`, depth: level }) satisfies TOCItemType)
  return (
    <DocsPage toc={toc} tableOfContentPopover={{ enabled: toc.length > 0 }}>
      <PageTitleWithWideToggle>{title}</PageTitleWithWideToggle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <HtmlPageBody src={src} headings={headings} />
      </DocsBody>
    </DocsPage>
  )
}

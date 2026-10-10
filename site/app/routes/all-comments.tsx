import path from 'node:path'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import { assertCommentAuthorsKnown } from '@godcreator/docsite-kit/comments'
import { commentThreadIdsAbout, readCommentThreads, siteCommenter, sitePeople } from '@godcreator/docsite-kit/server'
import { AllComments } from '@godcreator/docsite-kit/ui'
import { allThreads, renderCommentBody } from '../lib/comment-threads'
import { source } from '../lib/source'
import type { Route } from './+types/all-comments'

/** 全部评论页：「和我有关」要看评论正文里的 @，正文只有从文件读 */
export async function loader() {
  const people = sitePeople()
  assertCommentAuthorsKnown(allThreads, people)
  const commenter = siteCommenter()
  const aboutMe = commenter ? commentThreadIdsAbout(await readCommentThreads(path.resolve('comments')), commenter.id, people) : []
  const pageTitles = Object.fromEntries(source.getPages().map((page) => [page.url, page.data.title ?? page.url]))
  return { people, commenter, aboutMe, pageTitles }
}

export default function AllCommentsPage({ loaderData }: Route.ComponentProps) {
  const { people, commenter, aboutMe, pageTitles } = loaderData
  return (
    <DocsPage>
      <title>全部评论</title>
      <DocsTitle>全部评论</DocsTitle>
      <DocsDescription>全站的评论，按最近活动排；挂在页面上的点了去那一页</DocsDescription>
      <DocsBody>
        <AllComments threads={allThreads} people={people} commenter={commenter} aboutMe={aboutMe} pageTitles={pageTitles} renderBody={renderCommentBody} />
      </DocsBody>
    </DocsPage>
  )
}

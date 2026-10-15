import browserCollections from '../../../.source/browser'
import { mdxComponents } from '@/lib/mdx-components'

const journalContent = browserCollections.journal.createClientLoader({
  id: 'journal',
  component: ({ default: Mdx }) => <Mdx components={mdxComponents} />,
})

/**
 * 日志正文：日志集合（mdx.ts 的 journal）的 client loader 按 journal/<日期>.mdx 在浏览器加载。
 * dev 下刚写的日志页，服务端已经认出这一天有日志，浏览器里的集合入口要等 HMR 换新，在那之前先占位
 */
export function JournalBody({ date }: { date: string }) {
  const file = `${date}.mdx`
  if (!(`./${file}` in browserCollections.journal.raw)) return <p data-journal-pending="">日志正文还没加载到浏览器</p>
  return journalContent.useContent(file)
}

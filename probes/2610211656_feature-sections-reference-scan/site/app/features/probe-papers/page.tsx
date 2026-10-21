import type { Route } from './+types/page'
import { useLoaderData } from 'react-router'
import { mdxComponents } from '@/lib/mdx-components'
import { compileExternalMdx } from '@/probe-platform/external-mdx.server'
import { ExternalMdxPage } from '@/probe-platform/external-page'
import { papers } from './site.server'

export const loader = ({ params }: Route.LoaderArgs) => compileExternalMdx(papers.pageFile(params.id, params.page))

export default function PaperPage() {
  return <ExternalMdxPage data={useLoaderData<typeof loader>()} components={mdxComponents} />
}

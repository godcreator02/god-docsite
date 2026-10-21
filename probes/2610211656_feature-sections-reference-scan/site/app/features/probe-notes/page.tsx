import type { Route } from './+types/page'
import { useLoaderData } from 'react-router'
import { mdxComponents } from '@/lib/mdx-components'
import { compileExternalMdx } from '@/probe-platform/external-mdx.server'
import { ExternalMdxPage } from '@/probe-platform/external-page'
import { notes } from './site.server'

export const loader = ({ params }: Route.LoaderArgs) => compileExternalMdx(notes.pageFile(params.id, params.page))

export default function NotePage() {
  return <ExternalMdxPage data={useLoaderData<typeof loader>()} components={mdxComponents} />
}

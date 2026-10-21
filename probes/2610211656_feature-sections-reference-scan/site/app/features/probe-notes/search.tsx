import { Link, useLoaderData } from 'react-router'
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import { notes } from './site.server'

export const loader = () => notes.all()

export default function NotesSearch() {
  const items = useLoaderData<typeof loader>()
  return (
    <DocsPage>
      <DocsTitle>笔记检索</DocsTitle>
      <DocsBody>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.url}>{item.title}</Link>
            </li>
          ))}
        </ul>
      </DocsBody>
    </DocsPage>
  )
}

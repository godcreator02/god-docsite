import { Link, useLoaderData } from 'react-router'
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import { papers } from './site.server'

export const loader = () => papers.all()

export default function PapersSearch() {
  const items = useLoaderData<typeof loader>()
  return (
    <DocsPage>
      <DocsTitle>论文检索</DocsTitle>
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

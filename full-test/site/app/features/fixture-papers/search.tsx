import { Link, useLoaderData } from 'react-router'
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import { searchItems } from './library.server'

export const loader = () => ({ items: searchItems() })

/** 分区最上面「检索」指向的页：列出本站全部条目 */
export default function FixturePapersSearch() {
  const { items } = useLoaderData<typeof loader>()
  return (
    <DocsPage>
      <title>试验论文检索</title>
      <DocsTitle>试验论文检索</DocsTitle>
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

import type { Route } from './+types/home'

export async function loader(_: Route.LoaderArgs) {
  const { source } = await import('@/lib/source.server')
  const pages = source.getPages().map((page) => ({
    url: page.url,
    title: page.data.title ?? page.url,
    type: page.type,
  }))
  return { pages }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold">页面来源与搜索</h1>
      <p className="mb-8 text-fd-muted-foreground">
        MDX、TSX、HTML 三种格式的页面进同一棵页面树与同一个搜索索引。试试右上角的搜索（中文可用）。
      </p>
      <ul className="space-y-2">
        {loaderData.pages.map((page) => (
          <li key={page.url}>
            <a href={page.url} className="underline decoration-dotted">
              {page.title}
            </a>
            <span className="ml-2 rounded bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">{page.type}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}

import { useLoaderData } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { CalendarPage } from '../ui/calendar-page.js'

/** 服务端模块只能在 loader 里动态引：模块顶层引的话，客户端懒加载这个路由模块时 vite 直接拒（整页被报错层盖住） */
export async function loader() {
  const { siteName } = await import('@site/lib/source.server')
  return { siteName: siteName() }
}

export default function Calendar() {
  const { siteName } = useLoaderData<typeof loader>()
  return (
    <DocsPage>
      <title>{`日历 · ${siteName}`}</title>
      <CalendarPage />
    </DocsPage>
  )
}

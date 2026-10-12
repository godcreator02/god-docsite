import { useLoaderData } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { siteName } from '@site/lib/source'
import { CalendarPage } from '../ui/calendar-page.js'

export function loader() {
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

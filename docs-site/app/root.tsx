import type { ReactNode } from 'react'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { RootProvider } from '@fumadocs/base-ui/provider/react-router'
import { widePageScript, zhTranslations } from '@godcreator/docsite-ui'
import type { Route } from './+types/root'
import '@godcreator/docsite-identity/styles.css'
import '@godcreator/docsite-comments/styles.css'
import './app.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: widePageScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider i18n={{ translations: zhTranslations }}>{children}</RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

/** 没有这一页回 404；别的错误把原话显示出来，开发时带上调用栈 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">{error.status === 404 ? '没有这一页' : `出错了（${error.status}）`}</h1>
        <p className="mt-2 text-fd-muted-foreground">{String(error.data)}</p>
      </main>
    )
  }
  const message = error instanceof Error ? error.message : String(error)
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">出错了</h1>
      <pre className="mt-2 text-sm whitespace-pre-wrap">{message}</pre>
      {import.meta.env.DEV && error instanceof Error && <pre className="mt-4 overflow-x-auto text-xs text-fd-muted-foreground">{error.stack}</pre>}
    </main>
  )
}

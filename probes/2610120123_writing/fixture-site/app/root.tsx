import type { ReactNode } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from 'react-router'
import { RootProvider } from '@fumadocs/base-ui/provider/react-router'
import 'katex/dist/katex.css'
import '@probe/writing/styles.css'
import './app.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <RootProvider>{children}</RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">{error.status === 404 ? '没有这一页' : `出错了（${error.status}）`}</h1>
      </main>
    )
  }
  const message = error instanceof Error ? error.message : String(error)
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">出错了</h1>
      <pre className="mt-2 text-sm whitespace-pre-wrap">{message}</pre>
    </main>
  )
}

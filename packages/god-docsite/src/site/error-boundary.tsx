import { isRouteErrorResponse, useRouteError } from 'react-router'

/**
 * 根路由的错误页：没有这一页回 404 的说明，别的错误把原话与调用栈显示出来（start 下服务端错误的细节已由 React Router 去掉）。
 * 用 useRouteError 取错误：站点 root.tsx 写 export { SiteErrorBoundary as ErrorBoundary } 时组件拿不到 props
 */
export function SiteErrorBoundary() {
  const error = useRouteError()
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
      {error instanceof Error && error.stack ? <pre className="mt-4 overflow-x-auto text-xs text-fd-muted-foreground">{error.stack}</pre> : null}
    </main>
  )
}

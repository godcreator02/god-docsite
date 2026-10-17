import { useEffect, useState, type ReactNode } from 'react'
import { isRouteErrorResponse, Link, useLocation, useRouteError } from 'react-router'
import { DevIssuesButton, DevSiteUpdates, useDevIssues } from './dev-updates.js'
import { TopNotices } from './top-notices.js'

const buttonClassName = 'inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors'

/** 错误页底下的两个按钮：回首页；浏览器里有上一页时再给一个返回 */
function ErrorPageActions() {
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  useEffect(() => setHasPreviousPage(window.history.length > 1), [])
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Link to="/" className={`${buttonClassName} border-fd-primary bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90`}>
        回首页
      </Link>
      {hasPreviousPage ? (
        <button type="button" onClick={() => window.history.back()} className={`${buttonClassName} bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent`}>
          返回上一页
        </button>
      ) : null}
    </div>
  )
}

function ErrorPage({ code, title, children }: { code: string; title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <title>{title}</title>
      <p className="text-6xl font-bold text-fd-muted-foreground/40">{code}</p>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      {children}
      <ErrorPageActions />
      <DevSiteUpdates />
      <TopNotices>
        <DevIssuesButton />
      </TopNotices>
    </main>
  )
}

/**
 * 根路由的错误页：没有这一页写明地址并给回首页的按钮，别的错误把原话与调用栈显示出来（start 下服务端错误的细节已由 React Router 去掉）。
 * 用 useRouteError 取错误：站点 root.tsx 写 export { SiteErrorBoundary as ErrorBoundary } 时组件拿不到 props
 */
export function SiteErrorBoundary() {
  const error = useRouteError()
  const { pathname } = useLocation()
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      // 没有路由匹配时 React Router 自己造的 404（internal）带的是英文原话；loader 抛的 404 带着写明原因的中文
      const loaderReason = !(error as { internal?: boolean }).internal && typeof error.data === 'string' && error.data !== '' ? error.data : null
      return (
        <ErrorPage code="404" title="没有这一页">
          {loaderReason !== null ? (
            <p className="mt-3 text-fd-muted-foreground">{loaderReason}</p>
          ) : (
            <p className="mt-3 text-fd-muted-foreground">
              <code className="rounded bg-fd-muted px-1.5 py-0.5 text-sm">{pathname}</code> 这个地址没有页面，可能已经改名或删掉了。
            </p>
          )}
        </ErrorPage>
      )
    }
    return (
      <ErrorPage code={String(error.status)} title="出错了">
        <p className="mt-2 text-fd-muted-foreground">{String(error.data)}</p>
      </ErrorPage>
    )
  }
  return <RenderErrorPage error={error} />
}

/**
 * 页面渲染不出来：dev 下热更新失败时浏览器这边只拿到「动态导入失败」，真正的原因（哪个文件第几行写错了）在开发服务推来的报错里，有就先显示它；
 * 改好以后页面自己恢复
 */
function RenderErrorPage({ error }: { error: unknown }) {
  const hotUpdateIssue = useDevIssues().hotUpdate[0]
  const message = error instanceof Error ? error.message : String(error)
  return (
    <ErrorPage code="出错了" title="页面没能显示出来">
      {hotUpdateIssue !== undefined ? (
        <div data-error-page-dev-cause className="mt-4 w-full max-w-3xl text-left">
          <p className="text-sm font-medium">开发服务报的原因（改好后页面会自己恢复）：</p>
          <pre className="mt-2 text-sm whitespace-pre-wrap text-red-600 dark:text-red-400">{hotUpdateIssue.title}</pre>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap text-fd-muted-foreground">{hotUpdateIssue.detail}</pre>
        </div>
      ) : null}
      <pre className="mt-4 max-w-2xl text-left text-sm whitespace-pre-wrap">{message}</pre>
      {error instanceof Error && error.stack ? <pre className="mt-4 max-w-full overflow-x-auto text-left text-xs text-fd-muted-foreground">{error.stack}</pre> : null}
    </ErrorPage>
  )
}

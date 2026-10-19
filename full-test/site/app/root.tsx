import type { ReactNode } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router'
import { RootProvider } from '@fumadocs/base-ui/provider/react-router'
import { widePageScript, zhTranslations } from '@godcreator/god-docsite/react'
import { readerFontsCss } from '@godcreator/god-docsite/server'
import './app.css'

/** 读者在 gwb 设置里选的阅读字体（经 gwb-docsite 交来的文件），没设或不是 gwb 托管时是 null。放在根路由：首页与功能的独立页面不在布局路由里 */
export function loader() {
  return { readerFontsCss: readerFontsCss() }
}

export function Layout({ children }: { children: ReactNode }) {
  // 出错页也用 Layout 渲染，那时没有 loader 数据
  const readerFonts = useRouteLoaderData<typeof loader>('root')?.readerFontsCss
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: widePageScript }} />
        {readerFonts && <style dangerouslySetInnerHTML={{ __html: readerFonts }} />}
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

export { SiteErrorBoundary as ErrorBoundary } from '@godcreator/god-docsite/react'

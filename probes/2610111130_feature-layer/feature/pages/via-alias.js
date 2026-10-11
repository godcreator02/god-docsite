// 包里的路由模块经别名 @site 读站点项目里的页面树：@site 指站点的 app/，由站点的 vite.config.ts 设
import { jsx } from 'react/jsx-runtime'
import { useLoaderData } from 'react-router'
import { source } from '@site/lib/source'

export async function loader() {
  return { pageUrls: source.getPages().map((page) => page.url) }
}

export default function ViaAlias() {
  const { pageUrls } = useLoaderData()
  return jsx('p', { id: 'probe-via-alias', children: `经别名读到的页面：${pageUrls.join('、')}` })
}

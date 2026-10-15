import type { LoaderFunctionArgs } from 'react-router'
import type { BaseSiteContext } from '@godcreator/god-docsite/react'
import { DemoCounter, DemoLayoutTop, demoPageTreePlugin } from 'e2e-demo/site'

export const mdxComponents = { DemoCounter }

export const pageTreePlugins = [demoPageTreePlugin({ name: '演示功能', url: '/e2e-demo' })]

/** 这个模块会进浏览器：服务端的数据只经 base 的字段取 */
export function layoutData(_args: LoaderFunctionArgs, base: BaseSiteContext) {
  const pushed = base.feedValue('e2e-demo') as { note?: string } | undefined
  return { viewer: base.identity().person?.name ?? null, pages: base.source.getPages().length, pushed: pushed?.note ?? null }
}

export { DemoLayoutTop as LayoutTop }

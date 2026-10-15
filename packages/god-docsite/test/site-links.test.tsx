/**
 * 正文链接组件 siteLinkComponent 的渲染：在 React Router 与 fumadocs 的框架适配层里服务端渲染，看出来的卡片样子。
 */
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { ReactRouterProvider } from 'fumadocs-core/framework/react-router'
import { describe, expect, it } from 'vitest'
import { siteLinkComponent, SiteLinksProvider } from '../src/site/site-links.js'

const SiteLink = siteLinkComponent([])

function render(link: ReactNode) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/guide/intro']}>
      <ReactRouterProvider>
        <SiteLinksProvider pageTitles={{ '/guide/setup': '安装' }}>{link}</SiteLinksProvider>
      </ReactRouterProvider>
    </MemoryRouter>,
  )
}

describe('siteLinkComponent', () => {
  it('站里的页面：没写链接文字时显示页面标题，带锚点时标题后面接锚点', () => {
    const html = render(<SiteLink href="setup#第一步" />)
    expect(html).toContain('安装 › 第一步')
    expect(html).not.toContain('text-red-600')
  })

  it('写了链接文字就照写的显示', () => {
    expect(render(<SiteLink href="/guide/setup">去安装</SiteLink>)).toMatch(/<svg[^>]*>.*<\/svg>去安装<\/a>/)
  })

  it('站里没有的页面标红，没写文字时写「找不到的页面」', () => {
    const html = render(<SiteLink href="/nowhere" />)
    expect(html).toContain('text-red-600')
    expect(html).toContain('title="站里没有 /nowhere 这一页"')
    expect(html).toContain('找不到的页面')
  })

  it('内容目录里的文件开新标签页，没写文字时显示文件名', () => {
    const html = render(<SiteLink href="/api/content/docs/figure.svg" />)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('figure.svg</a>')
    expect(html).not.toContain('text-red-600')
  })

  it('没包 SiteLinksProvider 时站内链接直接报错', () => {
    expect(() =>
      renderToStaticMarkup(
        <MemoryRouter>
          <ReactRouterProvider>
            <SiteLink href="/guide/setup" />
          </ReactRouterProvider>
        </MemoryRouter>,
      ),
    ).toThrow(/SiteLinksProvider/)
  })
})

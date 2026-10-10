import { describe, expect, it } from 'vitest'
import { atomicCharacter } from '../src/page-text-rules.js'
import { pageTextOfHtml } from '../src/server/page-text.js'

function pageOf(body: string) {
  return `<!doctype html><html><head><title>t</title></head><body><nav>导航</nav><article data-comment-scope="">${body}</article><footer>页脚</footer></body></html>`
}

describe('页面文字（服务端解析 HTML）', () => {
  it('只算正文容器里面的字，文字节点照原样接上', () => {
    expect(pageTextOfHtml(pageOf('<h1>标题</h1>\n<p>第一段 <strong>加粗</strong>后</p>'))).toBe('标题\n第一段 加粗后')
  })

  it('sr-only 与 data-comment-ui 的元素连同里面的字一起跳过', () => {
    expect(pageTextOfHtml(pageOf('<h2>小节<a class="peer sr-only" href="#x">复制链接</a></h2><p>正文<button data-comment-ui="">3 条评论</button>完</p>'))).toBe('小节正文完')
  })

  it('img、svg、.katex 整个记成一个字，里面的东西不算', () => {
    const html = pageOf('<p>图<img src="a.png" alt="说明">后</p><p>矢量<svg><text>里面</text></svg>后</p><p>公式<span class="katex"><span class="katex-mathml">x+1</span><span>x</span></span>后</p>')
    expect(pageTextOfHtml(html)).toBe(`图${atomicCharacter}后矢量${atomicCharacter}后公式${atomicCharacter}后`)
  })

  it('HTML 注释不算字，实体照解码后的字算', () => {
    expect(pageTextOfHtml(pageOf('<p>前<!-- 注释 -->后 a &lt; b &amp; c&nbsp;d</p>'))).toBe('前后 a < b & c d')
  })

  it('<pre> 开头紧跟的换行按 HTML 规范去掉，和浏览器 DOM 一致', () => {
    expect(pageTextOfHtml(pageOf('<pre>\nline1\nline2</pre>'))).toBe('line1\nline2')
  })

  it('没有带 data-comment-scope 的正文容器时报错', () => {
    expect(() => pageTextOfHtml('<html><body><article>正文</article></body></html>')).toThrow('HTML 里没有正文容器：正文容器要带 data-comment-scope 属性')
  })
})

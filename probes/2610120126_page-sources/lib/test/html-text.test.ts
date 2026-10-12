import { describe, expect, test } from 'vitest'
import { decodeHtmlEntities, extractHtmlPage } from '../src/html-text'

const sample = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>波形图说明</title>
  <meta name="description" content="HTML 展示页面：原样渲染。" />
  <style>.x { color: red }</style>
  <script>window.shouldNotAppear = true</script>
</head>
<body>
  <h1 id="top">大标题</h1>
  <p>第一段，含<a href="https://example.com">链接</a>。</p>
  <h2>第二节</h2>
  <p>第二段文字。&amp;&nbsp;&#x4e2d;&#25991;</p>
  <img src="demo.svg" alt="波形示意" />
  <p>尾巴段。</p>
  <!-- 注释不该出现 -->
</body>
</html>`

describe('extractHtmlPage', () => {
  const extracted = extractHtmlPage('guide/waveform.html', sample)

  test('标题取 <title>，fumadocs:title 覆盖它', () => {
    expect(extracted.title).toBe('波形图说明')
    const overridden = extractHtmlPage('x.html', '<head><title>文件名标题</title><meta name="fumadocs:title" content="显示标题"></head><body><p>x</p></body>')
    expect(overridden.title).toBe('显示标题')
  })

  test('缺 <title> 直接报错并说明修法', () => {
    expect(() => extractHtmlPage('no-title.html', '<body><p>没有标题</p></body>')).toThrow(/no-title\.html.*<title>/)
  })

  test('description 取 <meta name="description">', () => {
    expect(extracted.description).toBe('HTML 展示页面：原样渲染。')
  })

  test('只有带 id 的标题产生锚点（id 是内容里写的，不是生成的）', () => {
    expect(extracted.headings).toEqual([{ id: 'top', text: '大标题', level: 1 }])
    const allWithIds = extractHtmlPage('ids.html', '<title>页</title><body><h2 id="a">甲</h2><h3 id="b">乙</h3></body>')
    expect(allWithIds.headings).toEqual([
      { id: 'a', text: '甲', level: 2 },
      { id: 'b', text: '乙', level: 3 },
    ])
  })

  test('无 id 标题不产生锚点，它下面的段落归到上一个有 id 的标题', () => {
    expect(extracted.contents).toEqual([
      { heading: 'top', content: '第一段，含[链接](https://example.com)。' },
      { heading: 'top', content: '第二段文字。& 中文' },
      { heading: 'top', content: '![波形示意](demo.svg)' },
      { heading: 'top', content: '尾巴段。' },
    ])
    const beforeAnyAnchor = extractHtmlPage('headless.html', '<title>页</title><body><h2>无锚点节</h2><p>孤立段</p></body>')
    expect(beforeAnyAnchor.headings).toEqual([])
    expect(beforeAnyAnchor.contents).toEqual([{ heading: undefined, content: '孤立段' }])
    expect(extracted.contents.every(({ content }) => !content.includes('shouldNotAppear') && !content.includes('color: red'))).toBe(true)
  })

  test('Markdown 形式：标题层级、描述、段落、链接与图片保留', () => {
    expect(extracted.markdown).toBe(`# 波形图说明

HTML 展示页面：原样渲染。

# 大标题

第一段，含[链接](https://example.com)。

## 第二节

第二段文字。& 中文

![波形示意](demo.svg)

尾巴段。
`)
  })

  test('正文外的段落也归页首（不属于任何标题）', () => {
    const noHeading = extractHtmlPage('plain.html', '<title>页</title><body><p>孤立段</p></body>')
    expect(noHeading.contents).toEqual([{ heading: undefined, content: '孤立段' }])
  })

  test('实体解码覆盖命名与数字形式，非法数字不抛错', () => {
    expect(decodeHtmlEntities('&lt;a&gt; &amp; &#20013; &#x4e2d; &unknown;')).toBe('<a> & 中 中 &unknown;')
    expect(decodeHtmlEntities('&#9999999999;')).toBe('&#9999999999;')
  })

  test('无 body 标签时按全文处理', () => {
    const bodyless = extractHtmlPage('frag.html', '<title>片段</title><h2 id="sec">小节</h2><p>段落</p>')
    expect(bodyless.contents).toEqual([{ heading: 'sec', content: '段落' }])
  })
})

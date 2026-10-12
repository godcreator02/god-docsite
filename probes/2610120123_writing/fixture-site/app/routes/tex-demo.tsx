import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import { Tex } from '@probe/writing'

/** TSX 页面的公式样本：children 是 KaTeX 写法，MDX 页面用 $…$ 不用它 */
export default function TexDemo() {
  return (
    <DocsPage>
      <title>{`TSX 公式 · 写作能力样本`}</title>
      <DocsTitle>TSX 公式</DocsTitle>
      <DocsBody>
        <p>
          行内公式：<Tex>{String.raw`\alpha + \beta \ge 2\sqrt{\alpha\beta}`}</Tex>，写在正文中间。
        </p>
        <p>块级公式单独成行居中：</p>
        <Tex block>{String.raw`\int_0^1 x^2\,dx = \frac{1}{3}`}</Tex>
        <p>
          与 MDX 页面的 <code>$…$</code> 走的是同一份 KaTeX 样式（root 引入的 katex.css）。
        </p>
      </DocsBody>
    </DocsPage>
  )
}

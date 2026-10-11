import katex from 'katex'

/**
 * TSX 页面里的公式，children 是 KaTeX 写法：<Tex>{String.raw`\frac{a}{b}`}</Tex>；block 时单独成一行居中。
 * MDX 页面直接写 $…$、$$…$$，不用它。写错的公式直接报错，样式由骨架的 root.tsx 引入的 katex.css 给
 */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: true })
  return <span className={block ? 'block' : undefined} dangerouslySetInnerHTML={{ __html: html }} />
}

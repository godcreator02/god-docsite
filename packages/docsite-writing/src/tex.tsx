/**
 * TSX 页面里的公式，children 是 KaTeX 写法：<Tex>{String.raw`\frac{a}{b}`}</Tex>；block 时单独成行居中。
 * MDX 页面直接写 $…$、$$…$$（站点 source.config.ts 里 remark-math + rehype-katex 的公开配置），不用它。
 * 写错的公式直接报错，样式由站点的 root 引入的 katex.css 给
 */
import katex from "katex";

export interface TexProps {
  children: string;
  block?: boolean;
}

export function Tex({ children, block = false }: TexProps) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: true });
  return <span className={block ? "block" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}

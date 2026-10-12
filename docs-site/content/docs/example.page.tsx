/**
 * TSX 页面的示例：正文是要运行的组件时用这种页面（MDX 页面里的组件是静态排版组件，不适合承载交互）。
 * 文件名以 .page.tsx 结尾、导出 meta 与 default 组件；meta 的说明见 @godcreator/docsite-page-sources 的 TsxPageMeta。
 * 这一页同时让「三种页面来源」的类型在任何 docfirst 站上都成立（只有 MDX 页面的站，类型会塌掉一个分支）。
 */
export const meta = {
  title: 'TSX 页面示例',
  description: '正文要运行组件的页面写成 .page.tsx：导出 meta 与默认组件，与 MDX 页面进同一棵页面树。',
}

export default function ExamplePage() {
  return (
    <>
      <p>MDX 页面适合文字为主的说明；这一页的正文是一个真正运行的 React 组件：</p>
      <p className="not-prose rounded-lg border p-4">要交互、要状态的页面写成这种，页面树、搜索、评论都与 MDX 页面一样。</p>
    </>
  )
}

import{r as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./jsx-runtime-ByKKNc-5.js";var n=e(t()),r={title:`三种页面来源`,description:`MDX、TSX、HTML 三种格式的页面进同一棵页面树与同一个搜索索引。`},i=`这一页是 MDX 写的。同一目录下还有 [TSX 页面](/guide/counter)与 [HTML 页面](/guide/waveform)，
三种格式在导航树里并列，搜索也一起收。

## MDX 走集合编译 [#mdx-走集合编译]

MDX 由 fumadocs-mdx 的集合编译：标题、描述来自 frontmatter，搜索分段由 remark 的 structure 插件切出，
Markdown 形式由官方 \`getText('processed')\` 通道给出。

### 标题层级 [#标题层级]

三级的标题也会进目录与搜索，锚点由编译链生成。
`,a={contents:[{heading:void 0,content:`这一页是 MDX 写的。同一目录下还有 TSX 页面与 HTML 页面，
三种格式在导航树里并列，搜索也一起收。`},{heading:`mdx-走集合编译`,content:"MDX 由 fumadocs-mdx 的集合编译：标题、描述来自 frontmatter，搜索分段由 remark 的 structure 插件切出，\nMarkdown 形式由官方 `getText('processed')` 通道给出。"},{heading:`标题层级`,content:`三级的标题也会进目录与搜索，锚点由编译链生成。`}],headings:[{id:`mdx-走集合编译`,content:`MDX 走集合编译`},{id:`标题层级`,content:`标题层级`}]},o=[{depth:2,url:`#mdx-走集合编译`,title:(0,n.jsx)(n.Fragment,{children:`MDX 走集合编译`})},{depth:3,url:`#标题层级`,title:(0,n.jsx)(n.Fragment,{children:`标题层级`})}];function s(e){let t={a:`a`,code:`code`,h2:`h2`,h3:`h3`,p:`p`,...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsxs)(t.p,{children:[`这一页是 MDX 写的。同一目录下还有 `,(0,n.jsx)(t.a,{href:`/guide/counter`,children:`TSX 页面`}),`与 `,(0,n.jsx)(t.a,{href:`/guide/waveform`,children:`HTML 页面`}),`，
三种格式在导航树里并列，搜索也一起收。`]}),`
`,(0,n.jsx)(t.h2,{id:`mdx-走集合编译`,children:`MDX 走集合编译`}),`
`,(0,n.jsxs)(t.p,{children:[`MDX 由 fumadocs-mdx 的集合编译：标题、描述来自 frontmatter，搜索分段由 remark 的 structure 插件切出，
Markdown 形式由官方 `,(0,n.jsx)(t.code,{children:`getText('processed')`}),` 通道给出。`]}),`
`,(0,n.jsx)(t.h3,{id:`标题层级`,children:`标题层级`}),`
`,(0,n.jsx)(t.p,{children:`三级的标题也会进目录与搜索，锚点由编译链生成。`})]})}function c(e={}){let{wrapper:t}=e.components||{};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(s,{...e})}):s(e)}export{i as _markdown,c as default,r as frontmatter,a as structuredData,o as toc};
import{Q as e,t}from"./jsx-runtime-CagI3dq2.js";import{t as n}from"./server.browser-CR9viUz_.js";var r=e(t()),i={title:`集合 A：启用术语标注`,description:`content/docs 集合的编译配置里带术语 remark 插件；同样的词在集合 B 不标`};function a(e){return n()?`这一页属于集合 A（\`content/docs/\`）：source.config.ts 里这个集合的 mdxOptions 配了术语插件，正文里的词会被自动包上 Term——把鼠标移到**隔离 home**上看看。

第二次出现就不再标了：隔离 home 在这一页只标第一次。

- 术语表在 \`content/glossary.terms.ts\`，构建期读，不进浏览器包
- 组件表在 \`app/mdx-components.ts\`：Fumadocs 公开组件原样登记，写作库只添 Term 一个
- [写作组件样本](/docs/writing-demo) 与 [术语边界样本](/docs/glossary-demo) 在集合 A 里；[集合 B 的对照页](/notes) 用同样的词，不标
`:null}var o={contents:[{heading:void 0,content:"这一页属于集合 A（`content/docs/`）：source.config.ts 里这个集合的 mdxOptions 配了术语插件，正文里的词会被自动包上 Term——把鼠标移到**隔离 home**上看看。"},{heading:void 0,content:`第二次出现就不再标了：隔离 home 在这一页只标第一次。`},{heading:void 0,content:"术语表在 `content/glossary.terms.ts`，构建期读，不进浏览器包"},{heading:void 0,content:"组件表在 `app/mdx-components.ts`：Fumadocs 公开组件原样登记，写作库只添 Term 一个"},{heading:void 0,content:`写作组件样本 与 术语边界样本 在集合 A 里；集合 B 的对照页 用同样的词，不标`}],headings:[]},s=[];function c(e){let t={a:`a`,code:`code`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components},{Term:n}=t;return n||u(`Term`,!0),(0,r.jsxs)(r.Fragment,{children:[(0,r.jsxs)(t.p,{children:[`这一页属于集合 A（`,(0,r.jsx)(t.code,{children:`content/docs/`}),`）：source.config.ts 里这个集合的 mdxOptions 配了术语插件，正文里的词会被自动包上 Term——把鼠标移到`,(0,r.jsx)(t.strong,{children:(0,r.jsx)(n,{def:`一套独立的环境：插件、端口、数据各自独立，验证东西不污染日常环境。`,children:`隔离 home`})}),`上看看。`]}),`
`,(0,r.jsx)(t.p,{children:`第二次出现就不再标了：隔离 home 在这一页只标第一次。`}),`
`,(0,r.jsxs)(t.ul,{children:[`
`,(0,r.jsxs)(t.li,{children:[`术语表在 `,(0,r.jsx)(t.code,{children:`content/glossary.terms.ts`}),`，构建期读，不进浏览器包`]}),`
`,(0,r.jsxs)(t.li,{children:[`组件表在 `,(0,r.jsx)(t.code,{children:`app/mdx-components.ts`}),`：Fumadocs 公开组件原样登记，写作库只添 Term 一个`]}),`
`,(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.a,{href:`/docs/writing-demo`,children:`写作组件样本`}),` 与 `,(0,r.jsx)(t.a,{href:`/docs/glossary-demo`,children:`术语边界样本`}),` 在集合 A 里；`,(0,r.jsx)(t.a,{href:`/notes`,children:`集合 B 的对照页`}),` 用同样的词，不标`]}),`
`]})]})}function l(e={}){let{wrapper:t}=e.components||{};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(c,{...e})}):c(e)}function u(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}export{a as _markdown,l as default,i as frontmatter,o as structuredData,s as toc};
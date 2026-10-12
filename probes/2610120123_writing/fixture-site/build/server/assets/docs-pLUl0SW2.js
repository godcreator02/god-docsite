import { t as asMarkdown } from "./server-C02Tx61K.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region content/docs/index.mdx?collection=docs
var frontmatter = {
	"title": "集合 A：启用术语标注",
	"description": "content/docs 集合的编译配置里带术语 remark 插件；同样的词在集合 B 不标"
};
function _markdown(props) {
	if (!asMarkdown()) return null;
	return "这一页属于集合 A（`content/docs/`）：source.config.ts 里这个集合的 mdxOptions 配了术语插件，正文里的词会被自动包上 Term——把鼠标移到**隔离 home**上看看。\n\n第二次出现就不再标了：隔离 home 在这一页只标第一次。\n\n- 术语表在 `content/glossary.terms.ts`，构建期读，不进浏览器包\n- 组件表在 `app/mdx-components.ts`：Fumadocs 公开组件原样登记，写作库只添 Term 一个\n- [写作组件样本](/docs/writing-demo) 与 [术语边界样本](/docs/glossary-demo) 在集合 A 里；[集合 B 的对照页](/notes) 用同样的词，不标\n";
}
var structuredData = {
	"contents": [
		{
			"heading": void 0,
			"content": "这一页属于集合 A（`content/docs/`）：source.config.ts 里这个集合的 mdxOptions 配了术语插件，正文里的词会被自动包上 Term——把鼠标移到**隔离 home**上看看。"
		},
		{
			"heading": void 0,
			"content": "第二次出现就不再标了：隔离 home 在这一页只标第一次。"
		},
		{
			"heading": void 0,
			"content": "术语表在 `content/glossary.terms.ts`，构建期读，不进浏览器包"
		},
		{
			"heading": void 0,
			"content": "组件表在 `app/mdx-components.ts`：Fumadocs 公开组件原样登记，写作库只添 Term 一个"
		},
		{
			"heading": void 0,
			"content": "写作组件样本 与 术语边界样本 在集合 A 里；集合 B 的对照页 用同样的词，不标"
		}
	],
	"headings": []
};
var toc = [];
function _createMdxContent(props) {
	const _components = {
		a: "a",
		code: "code",
		li: "li",
		p: "p",
		strong: "strong",
		ul: "ul",
		...props.components
	}, { Term } = _components;
	if (!Term) _missingMdxReference("Term", true);
	return jsxs(Fragment, { children: [
		jsxs(_components.p, { children: [
			"这一页属于集合 A（",
			jsx(_components.code, { children: "content/docs/" }),
			"）：source.config.ts 里这个集合的 mdxOptions 配了术语插件，正文里的词会被自动包上 Term——把鼠标移到",
			jsx(_components.strong, { children: jsx(Term, {
				def: "一套独立的环境：插件、端口、数据各自独立，验证东西不污染日常环境。",
				children: "隔离 home"
			}) }),
			"上看看。"
		] }),
		"\n",
		jsx(_components.p, { children: "第二次出现就不再标了：隔离 home 在这一页只标第一次。" }),
		"\n",
		jsxs(_components.ul, { children: [
			"\n",
			jsxs(_components.li, { children: [
				"术语表在 ",
				jsx(_components.code, { children: "content/glossary.terms.ts" }),
				"，构建期读，不进浏览器包"
			] }),
			"\n",
			jsxs(_components.li, { children: [
				"组件表在 ",
				jsx(_components.code, { children: "app/mdx-components.ts" }),
				"：Fumadocs 公开组件原样登记，写作库只添 Term 一个"
			] }),
			"\n",
			jsxs(_components.li, { children: [
				jsx(_components.a, {
					href: "/docs/writing-demo",
					children: "写作组件样本"
				}),
				" 与 ",
				jsx(_components.a, {
					href: "/docs/glossary-demo",
					children: "术语边界样本"
				}),
				" 在集合 A 里；",
				jsx(_components.a, {
					href: "/notes",
					children: "集合 B 的对照页"
				}),
				" 用同样的词，不标"
			] }),
			"\n"
		] })
	] });
}
function MDXContent(props = {}) {
	const { wrapper: MDXLayout } = props.components || {};
	return MDXLayout ? jsx(MDXLayout, {
		...props,
		children: jsx(_createMdxContent, { ...props })
	}) : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
	throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}
//#endregion
export { _markdown, MDXContent as default, frontmatter, structuredData, toc };

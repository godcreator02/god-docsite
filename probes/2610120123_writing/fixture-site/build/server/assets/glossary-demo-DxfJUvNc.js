import { t as asMarkdown } from "./server-C02Tx61K.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region content/docs/glossary-demo.mdx?collection=docs
var frontmatter = {
	"title": "术语边界样本",
	"description": "正文首现标注；代码、链接、标题、公式里的同一个词不动"
};
function _markdown(props) {
	if (!asMarkdown()) return null;
	return "## 标题里的命令总线不标\n\n标题换节点会动到目录与锚点，所以标题里的「命令总线」是普通文字；正文首现的词才标——上面这段里的命令总线就是它这篇的第一次。\n\n一条术语一篇只标第一次：这句里的命令总线不再标。子词按自己的词条算——「命令总线」标过之后，单独的「总线」是另一条术语，仍会标它自己的第一次（就在前面那句里），再往后（包括这句的总线）就都不标了。\n\n这些地方的同一个词都不动：\n\n- 代码块：\n\n  ```text\n  命令总线\n  ```\n\n- 行内代码：`命令总线`\n- 链接文字：[命令总线](/docs/glossary-demo)\n- 公式：$命令总线 \\times 2$ 与块级 $$命令总线$$\n- MDX 表达式：{'命令总线'}\n\n西文词按词边界认：panes 是别名也标（这里首现），panel 不会被 pane 打断、不标。\n";
}
var structuredData = {
	"contents": [
		{
			"heading": "标题里的命令总线不标",
			"content": "标题换节点会动到目录与锚点，所以标题里的「命令总线」是普通文字；正文首现的词才标——上面这段里的命令总线就是它这篇的第一次。"
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "一条术语一篇只标第一次：这句里的命令总线不再标。子词按自己的词条算——「命令总线」标过之后，单独的「总线」是另一条术语，仍会标它自己的第一次（就在前面那句里），再往后（包括这句的总线）就都不标了。"
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "这些地方的同一个词都不动："
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "代码块："
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "行内代码：`命令总线`"
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "链接文字：命令总线"
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "公式：$命令总线 \\times 2$ 与块级 $$命令总线$$"
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "MDX 表达式：{'命令总线'}"
		},
		{
			"heading": "标题里的命令总线不标",
			"content": "西文词按词边界认：panes 是别名也标（这里首现），panel 不会被 pane 打断、不标。"
		}
	],
	"headings": [{
		"id": "标题里的命令总线不标",
		"content": "标题里的命令总线不标"
	}]
};
var toc = [{
	depth: 2,
	url: "#标题里的命令总线不标",
	title: jsx(Fragment, { children: "标题里的命令总线不标" })
}];
function _createMdxContent(props) {
	const _components = {
		a: "a",
		annotation: "annotation",
		code: "code",
		h2: "h2",
		li: "li",
		math: "math",
		mn: "mn",
		mo: "mo",
		mrow: "mrow",
		mtext: "mtext",
		p: "p",
		pre: "pre",
		semantics: "semantics",
		span: "span",
		ul: "ul",
		...props.components
	}, { Term } = _components;
	if (!Term) _missingMdxReference("Term", true);
	return jsxs(Fragment, { children: [
		jsx(_components.h2, {
			id: "标题里的命令总线不标",
			children: "标题里的命令总线不标"
		}),
		"\n",
		jsxs(_components.p, { children: [
			"标题换节点会动到目录与锚点，所以标题里的「",
			jsx(Term, {
				def: "组件间传命令的一条通道，收发双方都只认这条通道。",
				href: "/docs/glossary-demo",
				children: "命令总线"
			}),
			"」是普通文字；正文首现的词才标——上面这段里的命令",
			jsx(Term, {
				def: "多台设备共用的一条传输线。",
				children: "总线"
			}),
			"就是它这篇的第一次。"
		] }),
		"\n",
		jsx(_components.p, { children: "一条术语一篇只标第一次：这句里的命令总线不再标。子词按自己的词条算——「命令总线」标过之后，单独的「总线」是另一条术语，仍会标它自己的第一次（就在前面那句里），再往后（包括这句的总线）就都不标了。" }),
		"\n",
		jsx(_components.p, { children: "这些地方的同一个词都不动：" }),
		"\n",
		jsxs(_components.ul, { children: [
			"\n",
			jsxs(_components.li, { children: [
				"\n",
				jsx(_components.p, { children: "代码块：" }),
				"\n",
				jsx(Fragment, { children: jsx(_components.pre, {
					className: "shiki shiki-themes github-light github-dark",
					style: {
						"--shiki-light": "#24292e",
						"--shiki-dark": "#e1e4e8",
						"--shiki-light-bg": "#fff",
						"--shiki-dark-bg": "#24292e"
					},
					tabIndex: "0",
					icon: "<svg viewBox=\"0 0 24 24\"><path d=\"M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z\" fill=\"currentColor\" /></svg>",
					children: jsx(_components.code, { children: jsx(_components.span, {
						className: "line",
						children: jsx(_components.span, { children: "命令总线" })
					}) })
				}) }),
				"\n"
			] }),
			"\n",
			jsxs(_components.li, { children: [
				"\n",
				jsxs(_components.p, { children: ["行内代码：", jsx(_components.code, { children: "命令总线" })] }),
				"\n"
			] }),
			"\n",
			jsxs(_components.li, { children: [
				"\n",
				jsxs(_components.p, { children: ["链接文字：", jsx(_components.a, {
					href: "/docs/glossary-demo",
					children: "命令总线"
				})] }),
				"\n"
			] }),
			"\n",
			jsxs(_components.li, { children: [
				"\n",
				jsxs(_components.p, { children: [
					"公式：",
					jsxs(_components.span, {
						className: "katex",
						children: [jsx(_components.span, {
							className: "katex-mathml",
							children: jsx(_components.math, {
								xmlns: "http://www.w3.org/1998/Math/MathML",
								children: jsxs(_components.semantics, { children: [jsxs(_components.mrow, { children: [
									jsx(_components.mtext, { children: "命令总线" }),
									jsx(_components.mo, { children: "×" }),
									jsx(_components.mn, { children: "2" })
								] }), jsx(_components.annotation, {
									encoding: "application/x-tex",
									children: "命令总线 \\times 2"
								})] })
							})
						}), jsxs(_components.span, {
							className: "katex-html",
							"aria-hidden": "true",
							children: [jsxs(_components.span, {
								className: "base",
								children: [
									jsx(_components.span, {
										className: "strut",
										style: {
											height: "0.7667em",
											verticalAlign: "-0.0833em"
										}
									}),
									jsx(_components.span, {
										className: "mord cjk_fallback",
										children: "命令总线"
									}),
									jsx(_components.span, {
										className: "mspace",
										style: { marginRight: "0.2222em" }
									}),
									jsx(_components.span, {
										className: "mbin",
										children: "×"
									}),
									jsx(_components.span, {
										className: "mspace",
										style: { marginRight: "0.2222em" }
									})
								]
							}), jsxs(_components.span, {
								className: "base",
								children: [jsx(_components.span, {
									className: "strut",
									style: { height: "0.6444em" }
								}), jsx(_components.span, {
									className: "mord",
									children: "2"
								})]
							})]
						})]
					}),
					" 与块级 ",
					jsxs(_components.span, {
						className: "katex",
						children: [jsx(_components.span, {
							className: "katex-mathml",
							children: jsx(_components.math, {
								xmlns: "http://www.w3.org/1998/Math/MathML",
								children: jsxs(_components.semantics, { children: [jsx(_components.mrow, { children: jsx(_components.mtext, { children: "命令总线" }) }), jsx(_components.annotation, {
									encoding: "application/x-tex",
									children: "命令总线"
								})] })
							})
						}), jsx(_components.span, {
							className: "katex-html",
							"aria-hidden": "true",
							children: jsxs(_components.span, {
								className: "base",
								children: [jsx(_components.span, {
									className: "strut",
									style: { height: "0.6833em" }
								}), jsx(_components.span, {
									className: "mord cjk_fallback",
									children: "命令总线"
								})]
							})
						})]
					})
				] }),
				"\n"
			] }),
			"\n",
			jsxs(_components.li, { children: [
				"\n",
				jsxs(_components.p, { children: ["MDX 表达式：", "命令总线"] }),
				"\n"
			] }),
			"\n"
		] }),
		"\n",
		jsxs(_components.p, { children: [
			"西文词按词边界认：",
			jsx(Term, {
				def: "界面上的一个窗格。",
				children: "panes"
			}),
			" 是别名也标（这里首现），panel 不会被 pane 打断、不标。"
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

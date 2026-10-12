import { t as asMarkdown } from "./server-C02Tx61K.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region content/notes/index.mdx?collection=notes
var frontmatter = {
	"title": "集合 B：不启用术语标注",
	"description": "与集合 A 同样的词，这个集合的编译配置里没有术语插件"
};
function _markdown(props) {
	if (!asMarkdown()) return null;
	return "这一页属于集合 B（`content/notes/`）：正文里同样写命令总线、隔离 home、pane 这些词，但 source.config.ts 里这个集合的 mdxOptions 没配术语插件——页面上没有任何点线下划线。\n\n对照 [集合 A 的首页](/docs)：同样的词在那里首现标注。两边的差别在构建期就定了，浏览器端不加载术语插件与词表。\n\n这一页也走同样的组件表，Tabs、公式这些照常可用：$a^2 + b^2 = c^2$。\n";
}
var structuredData = {
	"contents": [
		{
			"heading": void 0,
			"content": "这一页属于集合 B（`content/notes/`）：正文里同样写命令总线、隔离 home、pane 这些词，但 source.config.ts 里这个集合的 mdxOptions 没配术语插件——页面上没有任何点线下划线。"
		},
		{
			"heading": void 0,
			"content": "对照 集合 A 的首页：同样的词在那里首现标注。两边的差别在构建期就定了，浏览器端不加载术语插件与词表。"
		},
		{
			"heading": void 0,
			"content": "这一页也走同样的组件表，Tabs、公式这些照常可用：$a^2 + b^2 = c^2$。"
		}
	],
	"headings": []
};
var toc = [];
function _createMdxContent(props) {
	const _components = {
		a: "a",
		annotation: "annotation",
		code: "code",
		math: "math",
		mi: "mi",
		mn: "mn",
		mo: "mo",
		mrow: "mrow",
		msup: "msup",
		p: "p",
		semantics: "semantics",
		span: "span",
		...props.components
	};
	return jsxs(Fragment, { children: [
		jsxs(_components.p, { children: [
			"这一页属于集合 B（",
			jsx(_components.code, { children: "content/notes/" }),
			"）：正文里同样写命令总线、隔离 home、pane 这些词，但 source.config.ts 里这个集合的 mdxOptions 没配术语插件——页面上没有任何点线下划线。"
		] }),
		"\n",
		jsxs(_components.p, { children: [
			"对照 ",
			jsx(_components.a, {
				href: "/docs",
				children: "集合 A 的首页"
			}),
			"：同样的词在那里首现标注。两边的差别在构建期就定了，浏览器端不加载术语插件与词表。"
		] }),
		"\n",
		jsxs(_components.p, { children: [
			"这一页也走同样的组件表，Tabs、公式这些照常可用：",
			jsxs(_components.span, {
				className: "katex",
				children: [jsx(_components.span, {
					className: "katex-mathml",
					children: jsx(_components.math, {
						xmlns: "http://www.w3.org/1998/Math/MathML",
						children: jsxs(_components.semantics, { children: [jsxs(_components.mrow, { children: [
							jsxs(_components.msup, { children: [jsx(_components.mi, { children: "a" }), jsx(_components.mn, { children: "2" })] }),
							jsx(_components.mo, { children: "+" }),
							jsxs(_components.msup, { children: [jsx(_components.mi, { children: "b" }), jsx(_components.mn, { children: "2" })] }),
							jsx(_components.mo, { children: "=" }),
							jsxs(_components.msup, { children: [jsx(_components.mi, { children: "c" }), jsx(_components.mn, { children: "2" })] })
						] }), jsx(_components.annotation, {
							encoding: "application/x-tex",
							children: "a^2 + b^2 = c^2"
						})] })
					})
				}), jsxs(_components.span, {
					className: "katex-html",
					"aria-hidden": "true",
					children: [
						jsxs(_components.span, {
							className: "base",
							children: [
								jsx(_components.span, {
									className: "strut",
									style: {
										height: "0.8974em",
										verticalAlign: "-0.0833em"
									}
								}),
								jsxs(_components.span, {
									className: "mord",
									children: [jsx(_components.span, {
										className: "mord mathnormal",
										children: "a"
									}), jsx(_components.span, {
										className: "msupsub",
										children: jsx(_components.span, {
											className: "vlist-t",
											children: jsx(_components.span, {
												className: "vlist-r",
												children: jsx(_components.span, {
													className: "vlist",
													style: { height: "0.8141em" },
													children: jsxs(_components.span, {
														style: {
															top: "-3.063em",
															marginRight: "0.05em"
														},
														children: [jsx(_components.span, {
															className: "pstrut",
															style: { height: "2.7em" }
														}), jsx(_components.span, {
															className: "sizing reset-size6 size3 mtight",
															children: jsx(_components.span, {
																className: "mord mtight",
																children: "2"
															})
														})]
													})
												})
											})
										})
									})]
								}),
								jsx(_components.span, {
									className: "mspace",
									style: { marginRight: "0.2222em" }
								}),
								jsx(_components.span, {
									className: "mbin",
									children: "+"
								}),
								jsx(_components.span, {
									className: "mspace",
									style: { marginRight: "0.2222em" }
								})
							]
						}),
						jsxs(_components.span, {
							className: "base",
							children: [
								jsx(_components.span, {
									className: "strut",
									style: { height: "0.8141em" }
								}),
								jsxs(_components.span, {
									className: "mord",
									children: [jsx(_components.span, {
										className: "mord mathnormal",
										children: "b"
									}), jsx(_components.span, {
										className: "msupsub",
										children: jsx(_components.span, {
											className: "vlist-t",
											children: jsx(_components.span, {
												className: "vlist-r",
												children: jsx(_components.span, {
													className: "vlist",
													style: { height: "0.8141em" },
													children: jsxs(_components.span, {
														style: {
															top: "-3.063em",
															marginRight: "0.05em"
														},
														children: [jsx(_components.span, {
															className: "pstrut",
															style: { height: "2.7em" }
														}), jsx(_components.span, {
															className: "sizing reset-size6 size3 mtight",
															children: jsx(_components.span, {
																className: "mord mtight",
																children: "2"
															})
														})]
													})
												})
											})
										})
									})]
								}),
								jsx(_components.span, {
									className: "mspace",
									style: { marginRight: "0.2778em" }
								}),
								jsx(_components.span, {
									className: "mrel",
									children: "="
								}),
								jsx(_components.span, {
									className: "mspace",
									style: { marginRight: "0.2778em" }
								})
							]
						}),
						jsxs(_components.span, {
							className: "base",
							children: [jsx(_components.span, {
								className: "strut",
								style: { height: "0.8141em" }
							}), jsxs(_components.span, {
								className: "mord",
								children: [jsx(_components.span, {
									className: "mord mathnormal",
									children: "c"
								}), jsx(_components.span, {
									className: "msupsub",
									children: jsx(_components.span, {
										className: "vlist-t",
										children: jsx(_components.span, {
											className: "vlist-r",
											children: jsx(_components.span, {
												className: "vlist",
												style: { height: "0.8141em" },
												children: jsxs(_components.span, {
													style: {
														top: "-3.063em",
														marginRight: "0.05em"
													},
													children: [jsx(_components.span, {
														className: "pstrut",
														style: { height: "2.7em" }
													}), jsx(_components.span, {
														className: "sizing reset-size6 size3 mtight",
														children: jsx(_components.span, {
															className: "mord mtight",
															children: "2"
														})
													})]
												})
											})
										})
									})
								})]
							})]
						})
					]
				})]
			}),
			"。"
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
//#endregion
export { _markdown, MDXContent as default, frontmatter, structuredData, toc };

import { n as jsxComponents, t as asMarkdown } from "./server-C02Tx61K.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region content/docs/figure.svg
var figure_default = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNjAiIGhlaWdodD0iMTgwIiB2aWV3Qm94PSIwIDAgMzYwIDE4MCI+CiAgPHJlY3Qgd2lkdGg9IjM2MCIgaGVpZ2h0PSIxODAiIGZpbGw9IiNmYWZhZmEiLz4KICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSI5MCIgcj0iNzAiIGZpbGw9IiMzYjgyZjYiIGZpbGwtb3BhY2l0eT0iMC4yNSIgc3Ryb2tlPSIjM2I4MmY2IiBzdHJva2Utd2lkdGg9IjIiLz4KICA8Y2lyY2xlIGN4PSIyMTAiIGN5PSI5MCIgcj0iNzAiIGZpbGw9IiNmOTczMTYiIGZpbGwtb3BhY2l0eT0iMC4yNSIgc3Ryb2tlPSIjZjk3MzE2IiBzdHJva2Utd2lkdGg9IjIiLz4KICA8dGV4dCB4PSIxMTUiIHk9Ijk1IiBmb250LXNpemU9IjE2IiBmaWxsPSIjMWUzYThhIj7pm4blkIggQTwvdGV4dD4KICA8dGV4dCB4PSIyMTUiIHk9Ijk1IiBmb250LXNpemU9IjE2IiBmaWxsPSIjN2MyZDEyIj7pm4blkIggQjwvdGV4dD4KICA8dGV4dCB4PSI2MCIgeT0iMTcwIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNTI1MjViIj5kb2Nz77ya5ZCv55So5pyv6K+t5o+S5Lu2IMK3IG5vdGVz77ya5LiN5ZCv55SoPC90ZXh0Pgo8L3N2Zz4K";
//#endregion
//#region content/docs/writing-demo.mdx?collection=docs
var frontmatter = {
	"title": "写作组件样本",
	"description": "表格、代码块、公式、Tabs、Files、折叠、图片各一段紧凑样本"
};
function _markdown(props) {
	if (!asMarkdown()) return null;
	const _c = jsxComponents(props.components);
	return jsxs(Fragment, { children: [
		"表格、代码块、公式这些都不用 import：组件表（`app/mdx-components.ts`）登记的是锁定版 Fumadocs 公开组件。\n\n## 表格\n\n| 组件 | 来自 | 备注 |\n| --- | --- | --- |\n| Tabs | `@fumadocs/base-ui/components/tabs` | 一次只看一种写法 |\n| TypeTable | `@fumadocs/base-ui/components/type-table` | 参数说明 |\n| img | `ImageZoom` | 点了放大 |\n\n## 代码块\n\n```ts title=\"collections.ts\" {3}\nimport { defineDocs } from 'fumadocs-mdx/macro'\n\n// 集合 A：术语插件只对它生效\nexport const docs = defineDocs({ dir: 'content/docs' })\n```\n\n行内代码里的术语不标：`命令总线`。\n\n## 公式\n\n行内 $e^{i\\pi} + 1 = 0$ 与块级：\n\n$$\n\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}\n$$\n\n公式里的词不标：$命令总线 + x$。\n\n## 标签页\n\n",
		jsxs(_c.Tabs, {
			items: ["pnpm", "npm"],
			children: [
				"\n",
				jsx(_c.Tab, {
					value: "pnpm",
					children: "\n```bash\npnpm install\n```\n"
				}),
				"\n",
				jsx(_c.Tab, {
					value: "npm",
					children: "\n```bash\nnpm install\n```\n"
				}),
				"\n"
			]
		}),
		"\n\n## 文件树\n\n",
		jsxs(_c.Files, { children: [
			"\n",
			jsxs(_c.Folder, {
				name: "fixture-site",
				defaultOpen: true,
				children: [
					"\n",
					jsxs(_c.Folder, {
						name: "app",
						defaultOpen: true,
						children: [
							"\n",
							jsx(_c.File, { name: "source.config.ts" }),
							"\n",
							jsx(_c.File, { name: "routes.ts" }),
							"\n"
						]
					}),
					"\n",
					jsxs(_c.Folder, {
						name: "content",
						defaultOpen: true,
						children: [
							"\n",
							jsxs(_c.Folder, {
								name: "docs",
								defaultOpen: true,
								children: [
									"\n",
									jsx(_c.File, { name: "writing-demo.mdx" }),
									"\n"
								]
							}),
							"\n",
							jsxs(_c.Folder, {
								name: "notes",
								children: [
									"\n",
									jsx(_c.File, { name: "index.mdx" }),
									"\n"
								]
							}),
							"\n"
						]
					}),
					"\n"
				]
			}),
			"\n"
		] }),
		"\n\n## 折叠\n\n",
		jsxs(_c.Accordions, { children: [
			"\n",
			jsx(_c.Accordion, {
				title: "术语为什么不在浏览器里查表",
				children: "\n定义在构建期写成 Term 的属性，组件是纯展示的，客户端包里不用带词表。\n"
			}),
			"\n",
			jsx(_c.Accordion, {
				title: "为什么一篇只标第一次",
				children: "\n标注是为了解释，不是为了统计词频；满页虚线反而没法读。\n"
			}),
			"\n"
		] }),
		"\n\n## 图片\n\n点一下放大：\n\n![三个叠加的圆表示集合 A 与集合 B](./figure.svg)\n\n## 参数表\n\n",
		jsx(_c.TypeTable, { type: {
			terms: {
				type: "TermEntry[]",
				description: "术语表，构建期由 source.config.ts 读入",
				required: true
			},
			skipFile: {
				type: "(path: string) => boolean",
				description: "哪些文件不标：术语页自己要跳过（集合分发由集合配置负责）"
			}
		} }),
		"\n"
	] });
}
var structuredData = {
	"contents": [
		{
			"heading": void 0,
			"content": "表格、代码块、公式这些都不用 import：组件表（`app/mdx-components.ts`）登记的是锁定版 Fumadocs 公开组件。"
		},
		{
			"heading": "表格",
			"content": "| 组件   | 来自                                  | 备注       |\n| ---- | ----------------------------------- | -------- |\n| Tabs | `@fumadocs/base-ui/components/tabs` | 一次只看一种写法 |",
			"table": "table-0"
		},
		{
			"heading": "表格",
			"content": "| 组件        | 来自                                        | 备注   |\n| --------- | ----------------------------------------- | ---- |\n| TypeTable | `@fumadocs/base-ui/components/type-table` | 参数说明 |",
			"table": "table-0"
		},
		{
			"heading": "表格",
			"content": "| 组件  | 来自          | 备注   |\n| --- | ----------- | ---- |\n| img | `ImageZoom` | 点了放大 |",
			"table": "table-0"
		},
		{
			"heading": "代码块",
			"content": "行内代码里的术语不标：`命令总线`。"
		},
		{
			"heading": "公式",
			"content": "行内 $e^{i\\pi} + 1 = 0$ 与块级："
		},
		{
			"heading": "公式",
			"content": "公式里的词不标：$命令总线 + x$。"
		},
		{
			"heading": "文件树",
			"content": "<File name=\"source.config.ts\" />"
		},
		{
			"heading": "文件树",
			"content": "<File name=\"routes.ts\" />"
		},
		{
			"heading": "文件树",
			"content": "<File name=\"writing-demo.mdx\" />"
		},
		{
			"heading": "文件树",
			"content": "<File name=\"index.mdx\" />"
		},
		{
			"heading": "折叠",
			"content": "定义在构建期写成 Term 的属性，组件是纯展示的，客户端包里不用带词表。"
		},
		{
			"heading": "折叠",
			"content": "标注是为了解释，不是为了统计词频；满页虚线反而没法读。"
		},
		{
			"heading": "图片",
			"content": "点一下放大："
		},
		{
			"heading": "参数表",
			"content": "<TypeTable type=\"{ terms: { type: 'TermEntry[]', description: '术语表，构建期由 source.config.ts 读入', required: true }, skipF…\" />"
		}
	],
	"headings": [
		{
			"id": "表格",
			"content": "表格"
		},
		{
			"id": "代码块",
			"content": "代码块"
		},
		{
			"id": "公式",
			"content": "公式"
		},
		{
			"id": "标签页",
			"content": "标签页"
		},
		{
			"id": "文件树",
			"content": "文件树"
		},
		{
			"id": "折叠",
			"content": "折叠"
		},
		{
			"id": "图片",
			"content": "图片"
		},
		{
			"id": "参数表",
			"content": "参数表"
		}
	]
};
var toc = [
	{
		depth: 2,
		url: "#表格",
		title: jsx(Fragment, { children: "表格" })
	},
	{
		depth: 2,
		url: "#代码块",
		title: jsx(Fragment, { children: "代码块" })
	},
	{
		depth: 2,
		url: "#公式",
		title: jsx(Fragment, { children: "公式" })
	},
	{
		depth: 2,
		url: "#标签页",
		title: jsx(Fragment, { children: "标签页" })
	},
	{
		depth: 2,
		url: "#文件树",
		title: jsx(Fragment, { children: "文件树" })
	},
	{
		depth: 2,
		url: "#折叠",
		title: jsx(Fragment, { children: "折叠" })
	},
	{
		depth: 2,
		url: "#图片",
		title: jsx(Fragment, { children: "图片" })
	},
	{
		depth: 2,
		url: "#参数表",
		title: jsx(Fragment, { children: "参数表" })
	}
];
function _createMdxContent(props) {
	const _components = {
		annotation: "annotation",
		code: "code",
		h2: "h2",
		img: "img",
		math: "math",
		mfrac: "mfrac",
		mi: "mi",
		mn: "mn",
		mo: "mo",
		mrow: "mrow",
		msqrt: "msqrt",
		msubsup: "msubsup",
		msup: "msup",
		mtext: "mtext",
		p: "p",
		path: "path",
		pre: "pre",
		semantics: "semantics",
		span: "span",
		svg: "svg",
		table: "table",
		tbody: "tbody",
		td: "td",
		th: "th",
		thead: "thead",
		tr: "tr",
		...props.components
	}, { Accordion, Accordions, File, Files, Folder, Tab, Tabs, TypeTable } = _components;
	if (!Accordion) _missingMdxReference("Accordion", true);
	if (!Accordions) _missingMdxReference("Accordions", true);
	if (!File) _missingMdxReference("File", true);
	if (!Files) _missingMdxReference("Files", true);
	if (!Folder) _missingMdxReference("Folder", true);
	if (!Tab) _missingMdxReference("Tab", true);
	if (!Tabs) _missingMdxReference("Tabs", true);
	if (!TypeTable) _missingMdxReference("TypeTable", true);
	return jsxs(Fragment, { children: [
		jsxs(_components.p, { children: [
			"表格、代码块、公式这些都不用 import：组件表（",
			jsx(_components.code, { children: "app/mdx-components.ts" }),
			"）登记的是锁定版 Fumadocs 公开组件。"
		] }),
		"\n",
		jsx(_components.h2, {
			id: "表格",
			children: "表格"
		}),
		"\n",
		jsxs(_components.table, { children: [jsx(_components.thead, { children: jsxs(_components.tr, { children: [
			jsx(_components.th, { children: "组件" }),
			jsx(_components.th, { children: "来自" }),
			jsx(_components.th, { children: "备注" })
		] }) }), jsxs(_components.tbody, { children: [
			jsxs(_components.tr, { children: [
				jsx(_components.td, { children: "Tabs" }),
				jsx(_components.td, { children: jsx(_components.code, { children: "@fumadocs/base-ui/components/tabs" }) }),
				jsx(_components.td, { children: "一次只看一种写法" })
			] }),
			jsxs(_components.tr, { children: [
				jsx(_components.td, { children: "TypeTable" }),
				jsx(_components.td, { children: jsx(_components.code, { children: "@fumadocs/base-ui/components/type-table" }) }),
				jsx(_components.td, { children: "参数说明" })
			] }),
			jsxs(_components.tr, { children: [
				jsx(_components.td, { children: "img" }),
				jsx(_components.td, { children: jsx(_components.code, { children: "ImageZoom" }) }),
				jsx(_components.td, { children: "点了放大" })
			] })
		] })] }),
		"\n",
		jsx(_components.h2, {
			id: "代码块",
			children: "代码块"
		}),
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
			title: "collections.ts",
			icon: "<svg viewBox=\"0 0 24 24\"><path d=\"M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z\" fill=\"currentColor\" /></svg>",
			children: jsxs(_components.code, { children: [
				jsxs(_components.span, {
					className: "line",
					children: [
						jsx(_components.span, {
							style: {
								"--shiki-light": "#D73A49",
								"--shiki-dark": "#F97583"
							},
							children: "import"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#24292E",
								"--shiki-dark": "#E1E4E8"
							},
							children: " { defineDocs } "
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#D73A49",
								"--shiki-dark": "#F97583"
							},
							children: "from"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#032F62",
								"--shiki-dark": "#9ECBFF"
							},
							children: " 'fumadocs-mdx/macro'"
						})
					]
				}),
				"\n",
				jsx(_components.span, { className: "line" }),
				"\n",
				jsx(_components.span, {
					className: "line",
					children: jsx(_components.span, {
						style: {
							"--shiki-light": "#6A737D",
							"--shiki-dark": "#6A737D"
						},
						children: "// 集合 A：术语插件只对它生效"
					})
				}),
				"\n",
				jsxs(_components.span, {
					className: "line",
					children: [
						jsx(_components.span, {
							style: {
								"--shiki-light": "#D73A49",
								"--shiki-dark": "#F97583"
							},
							children: "export"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#D73A49",
								"--shiki-dark": "#F97583"
							},
							children: " const"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#005CC5",
								"--shiki-dark": "#79B8FF"
							},
							children: " docs"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#D73A49",
								"--shiki-dark": "#F97583"
							},
							children: " ="
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#6F42C1",
								"--shiki-dark": "#B392F0"
							},
							children: " defineDocs"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#24292E",
								"--shiki-dark": "#E1E4E8"
							},
							children: "({ dir: "
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#032F62",
								"--shiki-dark": "#9ECBFF"
							},
							children: "'content/docs'"
						}),
						jsx(_components.span, {
							style: {
								"--shiki-light": "#24292E",
								"--shiki-dark": "#E1E4E8"
							},
							children: " })"
						})
					]
				})
			] })
		}) }),
		"\n",
		jsxs(_components.p, { children: [
			"行内代码里的术语不标：",
			jsx(_components.code, { children: "命令总线" }),
			"。"
		] }),
		"\n",
		jsx(_components.h2, {
			id: "公式",
			children: "公式"
		}),
		"\n",
		jsxs(_components.p, { children: [
			"行内 ",
			jsxs(_components.span, {
				className: "katex",
				children: [jsx(_components.span, {
					className: "katex-mathml",
					children: jsx(_components.math, {
						xmlns: "http://www.w3.org/1998/Math/MathML",
						children: jsxs(_components.semantics, { children: [jsxs(_components.mrow, { children: [
							jsxs(_components.msup, { children: [jsx(_components.mi, { children: "e" }), jsxs(_components.mrow, { children: [jsx(_components.mi, { children: "i" }), jsx(_components.mi, { children: "π" })] })] }),
							jsx(_components.mo, { children: "+" }),
							jsx(_components.mn, { children: "1" }),
							jsx(_components.mo, { children: "=" }),
							jsx(_components.mn, { children: "0" })
						] }), jsx(_components.annotation, {
							encoding: "application/x-tex",
							children: "e^{i\\pi} + 1 = 0"
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
										height: "0.908em",
										verticalAlign: "-0.0833em"
									}
								}),
								jsxs(_components.span, {
									className: "mord",
									children: [jsx(_components.span, {
										className: "mord mathnormal",
										children: "e"
									}), jsx(_components.span, {
										className: "msupsub",
										children: jsx(_components.span, {
											className: "vlist-t",
											children: jsx(_components.span, {
												className: "vlist-r",
												children: jsx(_components.span, {
													className: "vlist",
													style: { height: "0.8247em" },
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
																children: jsx(_components.span, {
																	className: "mord mathnormal mtight",
																	style: { marginRight: "0.0359em" },
																	children: "iπ"
																})
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
									style: { height: "0.6444em" }
								}),
								jsx(_components.span, {
									className: "mord",
									children: "1"
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
								style: { height: "0.6444em" }
							}), jsx(_components.span, {
								className: "mord",
								children: "0"
							})]
						})
					]
				})]
			}),
			" 与块级："
		] }),
		"\n",
		jsx(_components.span, {
			className: "katex-display",
			children: jsxs(_components.span, {
				className: "katex",
				children: [jsx(_components.span, {
					className: "katex-mathml",
					children: jsx(_components.math, {
						xmlns: "http://www.w3.org/1998/Math/MathML",
						display: "block",
						children: jsxs(_components.semantics, { children: [jsxs(_components.mrow, { children: [
							jsxs(_components.msubsup, { children: [
								jsx(_components.mo, { children: "∫" }),
								jsx(_components.mn, { children: "0" }),
								jsx(_components.mi, {
									mathvariant: "normal",
									children: "∞"
								})
							] }),
							jsxs(_components.msup, { children: [jsx(_components.mi, { children: "e" }), jsxs(_components.mrow, { children: [jsx(_components.mo, { children: "−" }), jsxs(_components.msup, { children: [jsx(_components.mi, { children: "x" }), jsx(_components.mn, { children: "2" })] })] })] }),
							jsx(_components.mtext, { children: " " }),
							jsx(_components.mi, { children: "d" }),
							jsx(_components.mi, { children: "x" }),
							jsx(_components.mo, { children: "=" }),
							jsxs(_components.mfrac, { children: [jsx(_components.msqrt, { children: jsx(_components.mi, { children: "π" }) }), jsx(_components.mn, { children: "2" })] })
						] }), jsx(_components.annotation, {
							encoding: "application/x-tex",
							children: "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}"
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
									height: "2.3262em",
									verticalAlign: "-0.9119em"
								}
							}),
							jsxs(_components.span, {
								className: "mop",
								children: [jsx(_components.span, {
									className: "mop op-symbol large-op",
									style: {
										marginRight: "0.4445em",
										position: "relative",
										top: "-0.0011em"
									},
									children: "∫"
								}), jsx(_components.span, {
									className: "msupsub",
									children: jsxs(_components.span, {
										className: "vlist-t vlist-t2",
										children: [jsxs(_components.span, {
											className: "vlist-r",
											children: [jsxs(_components.span, {
												className: "vlist",
												style: { height: "1.4143em" },
												children: [jsxs(_components.span, {
													style: {
														top: "-1.7881em",
														marginLeft: "-0.4445em",
														marginRight: "0.05em"
													},
													children: [jsx(_components.span, {
														className: "pstrut",
														style: { height: "2.7em" }
													}), jsx(_components.span, {
														className: "sizing reset-size6 size3 mtight",
														children: jsx(_components.span, {
															className: "mord mtight",
															children: "0"
														})
													})]
												}), jsxs(_components.span, {
													style: {
														top: "-3.8129em",
														marginRight: "0.05em"
													},
													children: [jsx(_components.span, {
														className: "pstrut",
														style: { height: "2.7em" }
													}), jsx(_components.span, {
														className: "sizing reset-size6 size3 mtight",
														children: jsx(_components.span, {
															className: "mord mtight",
															children: "∞"
														})
													})]
												})]
											}), jsx(_components.span, {
												className: "vlist-s",
												children: "​"
											})]
										}), jsx(_components.span, {
											className: "vlist-r",
											children: jsx(_components.span, {
												className: "vlist",
												style: { height: "0.9119em" },
												children: jsx(_components.span, {})
											})
										})]
									})
								})]
							}),
							jsx(_components.span, {
								className: "mspace",
								style: { marginRight: "0.1667em" }
							}),
							jsxs(_components.span, {
								className: "mord",
								children: [jsx(_components.span, {
									className: "mord mathnormal",
									children: "e"
								}), jsx(_components.span, {
									className: "msupsub",
									children: jsx(_components.span, {
										className: "vlist-t",
										children: jsx(_components.span, {
											className: "vlist-r",
											children: jsx(_components.span, {
												className: "vlist",
												style: { height: "1.0369em" },
												children: jsxs(_components.span, {
													style: {
														top: "-3.113em",
														marginRight: "0.05em"
													},
													children: [jsx(_components.span, {
														className: "pstrut",
														style: { height: "2.7em" }
													}), jsx(_components.span, {
														className: "sizing reset-size6 size3 mtight",
														children: jsxs(_components.span, {
															className: "mord mtight",
															children: [jsx(_components.span, {
																className: "mord mtight",
																children: "−"
															}), jsxs(_components.span, {
																className: "mord mtight",
																children: [jsx(_components.span, {
																	className: "mord mathnormal mtight",
																	children: "x"
																}), jsx(_components.span, {
																	className: "msupsub",
																	children: jsx(_components.span, {
																		className: "vlist-t",
																		children: jsx(_components.span, {
																			className: "vlist-r",
																			children: jsx(_components.span, {
																				className: "vlist",
																				style: { height: "0.8913em" },
																				children: jsxs(_components.span, {
																					style: {
																						top: "-2.931em",
																						marginRight: "0.0714em"
																					},
																					children: [jsx(_components.span, {
																						className: "pstrut",
																						style: { height: "2.5em" }
																					}), jsx(_components.span, {
																						className: "sizing reset-size3 size1 mtight",
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
													})]
												})
											})
										})
									})
								})]
							}),
							jsx(_components.span, {
								className: "mspace",
								style: { marginRight: "0.1667em" }
							}),
							jsx(_components.span, {
								className: "mord mathnormal",
								children: "d"
							}),
							jsx(_components.span, {
								className: "mord mathnormal",
								children: "x"
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
					}), jsxs(_components.span, {
						className: "base",
						children: [jsx(_components.span, {
							className: "strut",
							style: {
								height: "2.1633em",
								verticalAlign: "-0.686em"
							}
						}), jsxs(_components.span, {
							className: "mord",
							children: [
								jsx(_components.span, { className: "mopen nulldelimiter" }),
								jsx(_components.span, {
									className: "mfrac",
									children: jsxs(_components.span, {
										className: "vlist-t vlist-t2",
										children: [jsxs(_components.span, {
											className: "vlist-r",
											children: [jsxs(_components.span, {
												className: "vlist",
												style: { height: "1.4773em" },
												children: [
													jsxs(_components.span, {
														style: { top: "-2.314em" },
														children: [jsx(_components.span, {
															className: "pstrut",
															style: { height: "3em" }
														}), jsx(_components.span, {
															className: "mord",
															children: jsx(_components.span, {
																className: "mord",
																children: "2"
															})
														})]
													}),
													jsxs(_components.span, {
														style: { top: "-3.23em" },
														children: [jsx(_components.span, {
															className: "pstrut",
															style: { height: "3em" }
														}), jsx(_components.span, {
															className: "frac-line",
															style: { borderBottomWidth: "0.04em" }
														})]
													}),
													jsxs(_components.span, {
														style: { top: "-3.677em" },
														children: [jsx(_components.span, {
															className: "pstrut",
															style: { height: "3em" }
														}), jsx(_components.span, {
															className: "mord",
															children: jsx(_components.span, {
																className: "mord sqrt",
																children: jsxs(_components.span, {
																	className: "vlist-t vlist-t2",
																	children: [jsxs(_components.span, {
																		className: "vlist-r",
																		children: [jsxs(_components.span, {
																			className: "vlist",
																			style: { height: "0.8003em" },
																			children: [jsxs(_components.span, {
																				className: "svg-align",
																				style: { top: "-3em" },
																				children: [jsx(_components.span, {
																					className: "pstrut",
																					style: { height: "3em" }
																				}), jsx(_components.span, {
																					className: "mord",
																					style: { paddingLeft: "0.833em" },
																					children: jsx(_components.span, {
																						className: "mord mathnormal",
																						style: { marginRight: "0.0359em" },
																						children: "π"
																					})
																				})]
																			}), jsxs(_components.span, {
																				style: { top: "-2.7603em" },
																				children: [jsx(_components.span, {
																					className: "pstrut",
																					style: { height: "3em" }
																				}), jsx(_components.span, {
																					className: "hide-tail",
																					style: {
																						minWidth: "0.853em",
																						height: "1.08em"
																					},
																					children: jsx(_components.svg, {
																						xmlns: "http://www.w3.org/2000/svg",
																						width: "400em",
																						height: "1.08em",
																						viewBox: "0 0 400000 1080",
																						preserveAspectRatio: "xMinYMin slice",
																						children: jsx(_components.path, { d: "M95,702\nc-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14\nc0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54\nc44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10\ns173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429\nc69,-144,104.5,-217.7,106.5,-221\nl0 -0\nc5.3,-9.3,12,-14,20,-14\nH400000v40H845.2724\ns-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7\nc-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z\nM834 80h400000v40h-400000z" })
																					})
																				})]
																			})]
																		}), jsx(_components.span, {
																			className: "vlist-s",
																			children: "​"
																		})]
																	}), jsx(_components.span, {
																		className: "vlist-r",
																		children: jsx(_components.span, {
																			className: "vlist",
																			style: { height: "0.2397em" },
																			children: jsx(_components.span, {})
																		})
																	})]
																})
															})
														})]
													})
												]
											}), jsx(_components.span, {
												className: "vlist-s",
												children: "​"
											})]
										}), jsx(_components.span, {
											className: "vlist-r",
											children: jsx(_components.span, {
												className: "vlist",
												style: { height: "0.686em" },
												children: jsx(_components.span, {})
											})
										})]
									})
								}),
								jsx(_components.span, { className: "mclose nulldelimiter" })
							]
						})]
					})]
				})]
			})
		}),
		"\n",
		jsxs(_components.p, { children: [
			"公式里的词不标：",
			jsxs(_components.span, {
				className: "katex",
				children: [jsx(_components.span, {
					className: "katex-mathml",
					children: jsx(_components.math, {
						xmlns: "http://www.w3.org/1998/Math/MathML",
						children: jsxs(_components.semantics, { children: [jsxs(_components.mrow, { children: [
							jsx(_components.mtext, { children: "命令总线" }),
							jsx(_components.mo, { children: "+" }),
							jsx(_components.mi, { children: "x" })
						] }), jsx(_components.annotation, {
							encoding: "application/x-tex",
							children: "命令总线 + x"
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
								children: "+"
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
							style: { height: "0.4306em" }
						}), jsx(_components.span, {
							className: "mord mathnormal",
							children: "x"
						})]
					})]
				})]
			}),
			"。"
		] }),
		"\n",
		jsx(_components.h2, {
			id: "标签页",
			children: "标签页"
		}),
		"\n",
		jsxs(Tabs, {
			items: ["pnpm", "npm"],
			children: [jsx(Tab, {
				value: "pnpm",
				children: jsx(Fragment, { children: jsx(_components.pre, {
					className: "shiki shiki-themes github-light github-dark",
					style: {
						"--shiki-light": "#24292e",
						"--shiki-dark": "#e1e4e8",
						"--shiki-light-bg": "#fff",
						"--shiki-dark-bg": "#24292e"
					},
					tabIndex: "0",
					icon: "<svg viewBox=\"0 0 24 24\"><path d=\"m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z\" fill=\"currentColor\" /></svg>",
					children: jsx(_components.code, { children: jsxs(_components.span, {
						className: "line",
						children: [jsx(_components.span, {
							style: {
								"--shiki-light": "#6F42C1",
								"--shiki-dark": "#B392F0"
							},
							children: "pnpm"
						}), jsx(_components.span, {
							style: {
								"--shiki-light": "#032F62",
								"--shiki-dark": "#9ECBFF"
							},
							children: " install"
						})]
					}) })
				}) })
			}), jsx(Tab, {
				value: "npm",
				children: jsx(Fragment, { children: jsx(_components.pre, {
					className: "shiki shiki-themes github-light github-dark",
					style: {
						"--shiki-light": "#24292e",
						"--shiki-dark": "#e1e4e8",
						"--shiki-light-bg": "#fff",
						"--shiki-dark-bg": "#24292e"
					},
					tabIndex: "0",
					icon: "<svg viewBox=\"0 0 24 24\"><path d=\"m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z\" fill=\"currentColor\" /></svg>",
					children: jsx(_components.code, { children: jsxs(_components.span, {
						className: "line",
						children: [jsx(_components.span, {
							style: {
								"--shiki-light": "#6F42C1",
								"--shiki-dark": "#B392F0"
							},
							children: "npm"
						}), jsx(_components.span, {
							style: {
								"--shiki-light": "#032F62",
								"--shiki-dark": "#9ECBFF"
							},
							children: " install"
						})]
					}) })
				}) })
			})]
		}),
		"\n",
		jsx(_components.h2, {
			id: "文件树",
			children: "文件树"
		}),
		"\n",
		jsx(Files, { children: jsxs(Folder, {
			name: "fixture-site",
			defaultOpen: true,
			children: [jsxs(Folder, {
				name: "app",
				defaultOpen: true,
				children: [jsx(File, { name: "source.config.ts" }), jsx(File, { name: "routes.ts" })]
			}), jsxs(Folder, {
				name: "content",
				defaultOpen: true,
				children: [jsx(Folder, {
					name: "docs",
					defaultOpen: true,
					children: jsx(File, { name: "writing-demo.mdx" })
				}), jsx(Folder, {
					name: "notes",
					children: jsx(File, { name: "index.mdx" })
				})]
			})]
		}) }),
		"\n",
		jsx(_components.h2, {
			id: "折叠",
			children: "折叠"
		}),
		"\n",
		jsxs(Accordions, { children: [jsx(Accordion, {
			title: "术语为什么不在浏览器里查表",
			children: jsx(_components.p, { children: "定义在构建期写成 Term 的属性，组件是纯展示的，客户端包里不用带词表。" })
		}), jsx(Accordion, {
			title: "为什么一篇只标第一次",
			children: jsx(_components.p, { children: "标注是为了解释，不是为了统计词频；满页虚线反而没法读。" })
		})] }),
		"\n",
		jsx(_components.h2, {
			id: "图片",
			children: "图片"
		}),
		"\n",
		jsx(_components.p, { children: "点一下放大：" }),
		"\n",
		jsx(_components.p, { children: jsx(_components.img, {
			alt: "三个叠加的圆表示集合 A 与集合 B",
			src: figure_default
		}) }),
		"\n",
		jsx(_components.h2, {
			id: "参数表",
			children: "参数表"
		}),
		"\n",
		jsx(TypeTable, { type: {
			terms: {
				type: "TermEntry[]",
				description: "术语表，构建期由 source.config.ts 读入",
				required: true
			},
			skipFile: {
				type: "(path: string) => boolean",
				description: "哪些文件不标：术语页自己要跳过（集合分发由集合配置负责）"
			}
		} })
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

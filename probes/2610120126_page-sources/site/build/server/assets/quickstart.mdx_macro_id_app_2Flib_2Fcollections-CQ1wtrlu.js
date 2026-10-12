import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region content/guide/mdx-demo.svg
var mdx_demo_default = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAyNDAgODAiPgogIDxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSIyMjQiIGhlaWdodD0iNjQiIHJ4PSI4IiBmaWxsPSIjZWVmMmZmIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiIvPgogIDx0ZXh0IHg9IjEyMCIgeT0iNDUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM0MzM4Y2EiPk1EWCDlkIznm67lvZXlm77niYc8L3RleHQ+Cjwvc3ZnPgo=";
//#endregion
//#region content/guide/quickstart.mdx?macro_id=app%2Flib%2Fcollections.ts%23docs
var frontmatter = {
	"title": "快速开始",
	"description": "用 MDX 写文档页：frontmatter、标题结构、同目录图片。"
};
var _markdown = "MDX 页面的正文走 Vite 与 fumadocs-mdx 的编译链，图片这样引用同目录文件：\n\n![方框示意图](./mdx-demo.svg)\n\n## 约定 [#约定]\n\n- 标题写在 frontmatter 的 `title`，页面树与搜索都用它\n- 二级标题切出搜索分段，锚点自动生成\n- 本地图片交给打包器，地址规则与组件一致\n\n### 搜索中文 [#搜索中文]\n\n这一段用来验证中文检索：波形、模块、页面树、滑块。\n";
var structuredData = {
	"contents": [
		{
			"heading": void 0,
			"content": "MDX 页面的正文走 Vite 与 fumadocs-mdx 的编译链，图片这样引用同目录文件："
		},
		{
			"heading": "约定",
			"content": "标题写在 frontmatter 的 `title`，页面树与搜索都用它"
		},
		{
			"heading": "约定",
			"content": "二级标题切出搜索分段，锚点自动生成"
		},
		{
			"heading": "约定",
			"content": "本地图片交给打包器，地址规则与组件一致"
		},
		{
			"heading": "搜索中文",
			"content": "这一段用来验证中文检索：波形、模块、页面树、滑块。"
		}
	],
	"headings": [{
		"id": "约定",
		"content": "约定"
	}, {
		"id": "搜索中文",
		"content": "搜索中文"
	}]
};
var toc = [{
	depth: 2,
	url: "#约定",
	title: jsx(Fragment, { children: "约定" })
}, {
	depth: 3,
	url: "#搜索中文",
	title: jsx(Fragment, { children: "搜索中文" })
}];
function _createMdxContent(props) {
	const _components = {
		code: "code",
		h2: "h2",
		h3: "h3",
		img: "img",
		li: "li",
		p: "p",
		ul: "ul",
		...props.components
	};
	return jsxs(Fragment, { children: [
		jsx(_components.p, { children: "MDX 页面的正文走 Vite 与 fumadocs-mdx 的编译链，图片这样引用同目录文件：" }),
		"\n",
		jsx(_components.p, { children: jsx(_components.img, {
			alt: "方框示意图",
			src: mdx_demo_default
		}) }),
		"\n",
		jsx(_components.h2, {
			id: "约定",
			children: "约定"
		}),
		"\n",
		jsxs(_components.ul, { children: [
			"\n",
			jsxs(_components.li, { children: [
				"标题写在 frontmatter 的 ",
				jsx(_components.code, { children: "title" }),
				"，页面树与搜索都用它"
			] }),
			"\n",
			jsx(_components.li, { children: "二级标题切出搜索分段，锚点自动生成" }),
			"\n",
			jsx(_components.li, { children: "本地图片交给打包器，地址规则与组件一致" }),
			"\n"
		] }),
		"\n",
		jsx(_components.h3, {
			id: "搜索中文",
			children: "搜索中文"
		}),
		"\n",
		jsx(_components.p, { children: "这一段用来验证中文检索：波形、模块、页面树、滑块。" })
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

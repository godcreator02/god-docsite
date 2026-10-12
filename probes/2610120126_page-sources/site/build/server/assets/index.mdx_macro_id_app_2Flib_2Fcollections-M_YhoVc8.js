import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region content/index.mdx?macro_id=app%2Flib%2Fcollections.ts%23docs
var frontmatter = {
	"title": "三种页面来源",
	"description": "MDX、TSX、HTML 三种格式的页面进同一棵页面树与同一个搜索索引。"
};
var _markdown = "这一页是 MDX 写的。同一目录下还有 [TSX 页面](/guide/counter)与 [HTML 页面](/guide/waveform)，\n三种格式在导航树里并列，搜索也一起收。\n\n## MDX 走集合编译 [#mdx-走集合编译]\n\nMDX 由 fumadocs-mdx 的集合编译：标题、描述来自 frontmatter，搜索分段由 remark 的 structure 插件切出，\nMarkdown 形式由官方 `getText('processed')` 通道给出。\n\n### 标题层级 [#标题层级]\n\n三级的标题也会进目录与搜索，锚点由编译链生成。\n";
var structuredData = {
	"contents": [
		{
			"heading": void 0,
			"content": "这一页是 MDX 写的。同一目录下还有 TSX 页面与 HTML 页面，\n三种格式在导航树里并列，搜索也一起收。"
		},
		{
			"heading": "mdx-走集合编译",
			"content": "MDX 由 fumadocs-mdx 的集合编译：标题、描述来自 frontmatter，搜索分段由 remark 的 structure 插件切出，\nMarkdown 形式由官方 `getText('processed')` 通道给出。"
		},
		{
			"heading": "标题层级",
			"content": "三级的标题也会进目录与搜索，锚点由编译链生成。"
		}
	],
	"headings": [{
		"id": "mdx-走集合编译",
		"content": "MDX 走集合编译"
	}, {
		"id": "标题层级",
		"content": "标题层级"
	}]
};
var toc = [{
	depth: 2,
	url: "#mdx-走集合编译",
	title: jsx(Fragment, { children: "MDX 走集合编译" })
}, {
	depth: 3,
	url: "#标题层级",
	title: jsx(Fragment, { children: "标题层级" })
}];
function _createMdxContent(props) {
	const _components = {
		a: "a",
		code: "code",
		h2: "h2",
		h3: "h3",
		p: "p",
		...props.components
	};
	return jsxs(Fragment, { children: [
		jsxs(_components.p, { children: [
			"这一页是 MDX 写的。同一目录下还有 ",
			jsx(_components.a, {
				href: "/guide/counter",
				children: "TSX 页面"
			}),
			"与 ",
			jsx(_components.a, {
				href: "/guide/waveform",
				children: "HTML 页面"
			}),
			"，\n三种格式在导航树里并列，搜索也一起收。"
		] }),
		"\n",
		jsx(_components.h2, {
			id: "mdx-走集合编译",
			children: "MDX 走集合编译"
		}),
		"\n",
		jsxs(_components.p, { children: [
			"MDX 由 fumadocs-mdx 的集合编译：标题、描述来自 frontmatter，搜索分段由 remark 的 structure 插件切出，\nMarkdown 形式由官方 ",
			jsx(_components.code, { children: "getText('processed')" }),
			" 通道给出。"
		] }),
		"\n",
		jsx(_components.h3, {
			id: "标题层级",
			children: "标题层级"
		}),
		"\n",
		jsx(_components.p, { children: "三级的标题也会进目录与搜索，锚点由编译链生成。" })
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

import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
//#region comments/20261012t080000-seed1/dot.png
var dot_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPQWxpAEmIY1TCqYfhqAACTIyMQQ1b7vwAAAABJRU5ErkJggg==";
//#endregion
//#region comments/20261012t080000-seed1/counter.tsx
/** 评论文件夹里的交互组件：点一下计数加一 */
function Counter() {
	const [count, setCount] = useState(0);
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		"data-comment-counter": true,
		onClick: () => setCount((c) => c + 1),
		className: "rounded-md border px-3 py-1",
		children: ["评论内组件点击次数：", count]
	});
}
//#endregion
//#region comments/20261012t080000-seed1/index.mdx?collection=comments
var frontmatter = {
	"page": "index.mdx",
	"author": "owner",
	"createdAt": "2026-10-12T08:00:00.000Z"
};
var structuredData = {
	"contents": [{
		"heading": void 0,
		"content": "样例评论串：这一条带同目录的交互组件和图片。"
	}],
	"headings": []
};
var toc = [];
function _createMdxContent(props) {
	const _components = {
		img: "img",
		p: "p",
		...props.components
	};
	return jsxs(Fragment, { children: [
		jsx(_components.p, { children: "样例评论串：这一条带同目录的交互组件和图片。" }),
		"\n",
		"\n",
		jsx(Counter, {}),
		"\n",
		jsx(_components.p, { children: jsx(_components.img, {
			alt: "绿点",
			src: dot_default
		}) })
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
export { MDXContent as default, frontmatter, structuredData, toc };

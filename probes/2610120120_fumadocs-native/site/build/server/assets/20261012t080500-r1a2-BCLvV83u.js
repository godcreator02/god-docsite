import { jsx } from "react/jsx-runtime";
//#region comments/20261012t080000-seed1/20261012t080500-r1a2.mdx?collection=comments
var frontmatter = {
	"author": "zhou",
	"createdAt": "2026-10-12T08:05:00.000Z"
};
var structuredData = {
	"contents": [{
		"heading": void 0,
		"content": "回复：同目录图片与组件都能显示的话，这条链就算通了。"
	}],
	"headings": []
};
var toc = [];
function _createMdxContent(props) {
	const _components = {
		p: "p",
		...props.components
	};
	return jsx(_components.p, { children: "回复：同目录图片与组件都能显示的话，这条链就算通了。" });
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

import { useCallback, useEffect, useState } from "react";
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/highlight-SXtD3BKk.js
function buildRegexFromQuery(query) {
	const source = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "|");
	return source ? new RegExp(source, "gi") : null;
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/use-search-Dy8lBrbN.js
var idle = { query: "" };
/**
* The base of search hooks, for search engines without one.
*
* @param run - memoized search function, search again when changed
*/
function useSearch(run, { delayMs = 100, allowEmpty = false } = {}) {
	const [search, setSearch] = useState("");
	const [state, setState] = useState(idle);
	const empty = search.length === 0 && !allowEmpty;
	if (empty && state !== idle) setState(idle);
	useEffect(() => {
		if (empty) return;
		let active = true;
		const timer = setTimeout(async () => {
			try {
				const [results, { parseResults }] = await Promise.all([run(search), import("./parse-BU3fTLtO-D9fswoTM.js")]);
				if (active) setState({
					query: search,
					run,
					data: {
						query: search,
						items: parseResults(results)
					}
				});
			} catch (error) {
				if (active) setState((prev) => ({
					...prev,
					query: search,
					run,
					error
				}));
			}
		}, delayMs);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [
		search,
		empty,
		delayMs,
		run
	]);
	return {
		search,
		onSearchChange: setSearch,
		isLoading: !empty && (state.query !== search || state.run !== run),
		data: state.data,
		error: state.error
	};
}
/**
* Highlight matches of `query` in the text of an element with the CSS Custom Highlight API, style them with `::highlight(fd-search)`.
*
* Text in elements with `data-highlight-ignore` is skipped. The highlights stay when the element is moved, but not when its text changes, give it a new `key` in that case.
*
* @returns a ref callback for the element
*/
function useHighlightQuery(query) {
	return useCallback((element) => {
		const regex = buildRegexFromQuery(query);
		if (!element || !regex || typeof Highlight === "undefined") return () => {};
		let highlight = CSS.highlights.get("fd-search");
		if (!highlight) CSS.highlights.set("fd-search", highlight = new Highlight());
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, (node) => {
			if (!(node instanceof Element)) return NodeFilter.FILTER_ACCEPT;
			return node.hasAttribute("data-highlight-ignore") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
		});
		const ranges = [];
		while (walker.nextNode()) {
			const node = walker.currentNode;
			for (const match of node.data.matchAll(regex)) {
				const range = new StaticRange({
					startContainer: node,
					startOffset: match.index,
					endContainer: node,
					endOffset: match.index + match[0].length
				});
				highlight.add(range);
				ranges.push(range);
			}
		}
		return () => {
			for (const range of ranges) highlight.delete(range);
		};
	}, [query]);
}
//#endregion
export { useSearch as n, useHighlightQuery as t };

import { t as join } from "./url-BVHvi3_K-O95YmUkP.js";
import "react";
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/client/fetch.js
var globalCache = /* @__PURE__ */ new Map();
async function searchFetch({ api = join("/", "/api/search"), locale, tag, cache = globalCache }, query) {
	const url = new URL(api, window.location.origin);
	url.searchParams.set("query", query);
	if (locale) url.searchParams.set("locale", locale);
	if (tag) url.searchParams.set("tag", Array.isArray(tag) ? tag.join(",") : tag);
	const key = url.toString();
	const cached = cache.get(key);
	if (cached) return cached;
	const res = await fetch(url);
	if (!res.ok) throw new Error(await res.text());
	const result = await res.json();
	cache.set(key, result);
	return result;
}
function fetchClient(options = {}) {
	return {
		deps: [
			options.api,
			options.locale,
			String(options.tag)
		],
		search: (query) => searchFetch(options, query)
	};
}
//#endregion
export { fetchClient as t };

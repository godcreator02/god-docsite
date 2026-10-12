import { t as join } from "./url-BVHvi3_K-O95YmUkP.js";
import { a as create, n as searchSimple, r as load, t as searchAdvanced } from "./advanced-cJMxLDd5-XthnPkt3.js";
import { n as useSearch } from "./use-search-Dy8lBrbN-CG2zVcmy.js";
import { useCallback, useRef } from "react";
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/client/orama-static.js
var cache$1 = /* @__PURE__ */ new Map();
async function loadDB(from, initDB = () => create({ schema: { _: "string" } })) {
	const res = await fetch(from);
	if (!res.ok) throw new Error(`failed to fetch exported search indexes from ${from}, make sure the search database is exported and available for client.`);
	const data = await res.json();
	const map = /* @__PURE__ */ new Map();
	if (data.type === "i18n") {
		await Promise.all(Object.entries(data.data).map(async ([k, v]) => {
			const db = await initDB(k);
			load(db, v);
			map.set(k, {
				type: v.type,
				db
			});
		}));
		return {
			map,
			unified: false,
			i18n: true
		};
	}
	const db = await initDB();
	load(db, data);
	map.set("", {
		type: data.type,
		db
	});
	return {
		map,
		unified: true,
		i18n: data.i18n === true
	};
}
function getDBCached({ from = join("/", "/api/search"), initDB, initOrama }) {
	const cacheKey = from;
	const cached = cache$1.get(cacheKey);
	if (cached) return cached;
	const result = loadDB(from, initDB ?? initOrama);
	cache$1.set(cacheKey, result);
	return result;
}
async function searchStatic(options, query) {
	const { tag, locale, search } = options;
	const { map, unified, i18n } = await getDBCached(options);
	let db;
	let filterLocale;
	if (unified) {
		db = map.get("");
		if (i18n) filterLocale = locale;
	} else {
		db = map.get(locale ?? "");
		if (!db) {
			console.warn(`failed to find search data for "${locale}", available: ${Array.from(map.keys())}.`);
			db = map.values().next().value;
		}
	}
	if (!db) return [];
	if (db.type === "simple") return searchSimple(db.db, query, search, filterLocale);
	return searchAdvanced(db.db, query, tag, search, filterLocale);
}
function staticClient(options = {}) {
	return {
		deps: [String(options.tag), options.locale],
		search: (query) => searchStatic(options, query)
	};
}
/**
* Search the indexes exported by the search server, in the browser.
*/
function useStaticSearch({ from, locale, tag, ...rest } = {}) {
	const latest = useRef(rest);
	latest.current = rest;
	const tags = String(tag ?? "");
	const run = useCallback((query) => searchStatic({
		...latest.current,
		from,
		locale,
		tag: tags ? tags.split(",") : void 0
	}, query), [
		from,
		locale,
		tags
	]);
	return useSearch(run, rest);
}
/**
* @deprecated Renamed to `staticClient`, note that the search engine is now ZBSearch.
*/
var oramaStaticClient = staticClient;
//#endregion
export { oramaStaticClient, staticClient, useStaticSearch };

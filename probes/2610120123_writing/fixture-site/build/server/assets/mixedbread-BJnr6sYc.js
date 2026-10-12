//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/endpoint-MyoBU5IC.js
function createEndpoint(server, options = {}) {
	const { search } = server;
	const { readOptions = defaultReadOptions } = options;
	return {
		...server,
		async staticGET() {
			return Response.json(await server.export());
		},
		async GET(request) {
			const url = new URL(request.url);
			const query = url.searchParams.get("query");
			if (!query) return Response.json([]);
			return Response.json(await search(query, readOptions(url, request)));
		}
	};
}
function defaultReadOptions(url) {
	const params = url.searchParams;
	const limit = params.has("limit") ? Number(params.get("limit")) : void 0;
	return {
		tag: params.get("tag")?.split(","),
		locale: params.get("locale"),
		limit: Number.isInteger(limit) ? limit : void 0
	};
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/mixedbread.js
function defaultTransform(results) {
	const groups = /* @__PURE__ */ new Map();
	for (const item of results) {
		const page = item.metadata;
		let group = groups.get(item.file_id);
		if (!group) {
			group = [{
				id: item.file_id,
				type: "page",
				content: page.title,
				breadcrumbs: page.breadcrumbs,
				url: page.url
			}];
			groups.set(item.file_id, group);
		}
		const { kind, heading, table } = item.generated_metadata;
		if (kind === "page") continue;
		group.push({
			id: `${item.file_id}-${item.chunk_index}`,
			type: kind,
			content: item.text ?? "",
			url: heading ? `${page.url}#${heading}` : page.url,
			table
		});
	}
	return [...groups.values()].flat();
}
function createMixedbreadSearchAPI(options) {
	const { client, storeIdentifier, topK = 10, rerank, rewriteQuery, scoreThreshold, transform } = options;
	return createEndpoint({
		async search(query, searchOptions = {}) {
			if (!query.trim()) return [];
			const { tag, locale, limit } = searchOptions;
			const filters = [];
			if (locale) filters.push({
				key: "locale",
				operator: "eq",
				value: locale
			});
			for (const item of typeof tag === "string" ? [tag] : tag ?? []) filters.push({
				key: "tags",
				operator: "contains",
				value: item
			});
			const results = (await client.stores.search({
				query,
				store_identifiers: [storeIdentifier],
				top_k: Math.min(limit ?? topK, topK),
				filters: filters.length > 0 ? { all: filters } : void 0,
				search_options: {
					return_metadata: true,
					rerank,
					rewrite_query: rewriteQuery,
					score_threshold: scoreThreshold
				}
			})).data;
			if (transform) return transform(results, query);
			return defaultTransform(results);
		},
		async export() {
			throw new Error("Mixedbread search does not support exporting indexes. Use the Mixedbread dashboard to manage your store.");
		}
	});
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/client/mixedbread.js
/**
* @deprecated Use `createMixedbreadSearchAPI` from `fumadocs-core/search/mixedbread` instead.
* This client-side approach exposes your API key in the browser.
* The server-side approach keeps the key secure and uses `useFetchSearch()` on the client.
*/
function mixedbreadClient(options) {
	const { client, storeIdentifier, tag } = options;
	const api = createMixedbreadSearchAPI({
		client,
		storeIdentifier
	});
	return {
		deps: [
			client,
			storeIdentifier,
			tag
		],
		search: (query) => api.search(query, { tag })
	};
}
//#endregion
export { mixedbreadClient };

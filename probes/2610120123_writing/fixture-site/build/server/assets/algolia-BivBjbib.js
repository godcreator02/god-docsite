import "react";
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/client/algolia.js
function groupResults(hits) {
	const grouped = [];
	const scannedUrls = /* @__PURE__ */ new Set();
	for (const hit of hits) {
		if (!scannedUrls.has(hit.url)) {
			scannedUrls.add(hit.url);
			grouped.push({
				id: hit.url,
				type: "page",
				breadcrumbs: hit.breadcrumbs,
				url: hit.url,
				content: hit.title
			});
		}
		grouped.push({
			id: hit.objectID,
			type: hit.content === hit.section ? "heading" : "text",
			url: hit.section_id ? `${hit.url}#${hit.section_id}` : hit.url,
			content: hit.content,
			table: hit.table
		});
	}
	return grouped;
}
async function searchAlgolia(options, query) {
	const { indexName, onSearch, client, locale, tag } = options;
	if (query.trim().length === 0) return [];
	return groupResults((onSearch ? await onSearch(query, tag, locale) : await client.searchForHits({ requests: [{
		type: "default",
		indexName,
		query,
		distinct: 5,
		hitsPerPage: 10,
		filters: tag ? `tag:${tag}` : void 0
	}] })).results[0].hits);
}
function algoliaClient(options) {
	return {
		deps: [
			options.indexName,
			options.client,
			options.locale,
			options.tag
		],
		search: (query) => searchAlgolia(options, query)
	};
}
//#endregion
export { algoliaClient };

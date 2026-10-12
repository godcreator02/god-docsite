import { t as removeUndefined } from "./remove-undefined-CzMSKybq-DHMHsQDm.js";
import "react";
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/client/orama-cloud.js
async function searchOramaCloud(options, query) {
	const { index = "default", client, params: extraParams, tag } = options;
	const list = [];
	if (index === "crawler") {
		const result = await client.search({
			datasources: [],
			...extraParams,
			term: query,
			where: {
				category: tag ? { eq: tag.slice(0, 1).toUpperCase() + tag.slice(1) } : void 0,
				...extraParams?.where
			},
			limit: 10
		});
		if (!result) return list;
		for (const hit of result.hits) {
			const doc = hit.document;
			list.push({
				id: hit.id,
				type: "page",
				content: doc.title,
				url: doc.path
			}, {
				id: "page" + hit.id,
				type: "text",
				content: doc.content,
				url: doc.path
			});
		}
		return list;
	}
	const result = await client.search({
		datasources: [],
		properties: [
			"title",
			"section",
			"content"
		],
		...extraParams,
		term: query,
		limit: 20,
		where: removeUndefined({
			tag,
			...extraParams?.where
		}),
		groupBy: {
			properties: ["page_id"],
			max_results: 7,
			...extraParams?.groupBy
		}
	});
	if (!result || !result.groups) return list;
	for (const item of result.groups) {
		let addedHead = false;
		for (const hit of item.result) {
			const doc = hit.document;
			if (!addedHead) {
				list.push({
					id: doc.page_id,
					type: "page",
					content: doc.title,
					breadcrumbs: doc.breadcrumbs,
					url: doc.url
				});
				addedHead = true;
			}
			list.push({
				id: doc.id,
				content: doc.content,
				type: doc.content === doc.section ? "heading" : "text",
				url: doc.section_id ? `${doc.url}#${doc.section_id}` : doc.url,
				table: doc.table
			});
		}
	}
	return list.length > 80 ? list.slice(0, 80) : list;
}
function oramaCloudClient(options) {
	return {
		deps: [
			options.index,
			options.client,
			options.tag
		],
		search: (query) => searchOramaCloud(options, query)
	};
}
//#endregion
export { oramaCloudClient };

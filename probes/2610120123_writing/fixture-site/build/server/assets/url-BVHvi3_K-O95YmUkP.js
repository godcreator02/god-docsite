//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/url-BVHvi3_K.js
function join(...paths) {
	let out = "";
	for (let p of paths) {
		if (out.length > 0) {
			if (p.startsWith("/")) p = p.slice(1);
			if (!out.endsWith("/")) out += "/";
		}
		out += p;
	}
	return out;
}
/**
* normalize URL into the Fumadocs standard form (`/slug-1/slug-2`).
*
* This includes URLs with trailing slashes.
*/
function normalizeUrl(url) {
	if (url.startsWith("http://") || url.startsWith("https://")) return url;
	if (!url.startsWith("/")) url = "/" + url;
	if (url.length > 1 && url.endsWith("/")) url = url.slice(0, -1);
	return url;
}
//#endregion
export { normalizeUrl as n, join as t };

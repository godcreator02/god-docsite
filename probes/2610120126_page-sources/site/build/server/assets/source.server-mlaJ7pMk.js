import { n as meta } from "./counter.page-NB5EJhsN.js";
import { n as normalizeUrl } from "./url-BVHvi3_K-O95YmUkP.js";
import { _ as yieldToEventLoop, a as create$1, c as runMultipleHook, d as isArrayType, f as isGeoPointType, g as isAsyncFunction, h as getNested, i as save, l as runSingleHook, m as createError, n as searchSimple, o as addSortablePropertyToSorter, p as isVectorType, s as addSearchablePropertyToIndex, t as searchAdvanced, u as getInternalDocumentId } from "./advanced-cJMxLDd5-XthnPkt3.js";
import { n as defaultReadOptions, t as createEndpoint } from "./endpoint-MyoBU5IC-DKLf6zag.js";
import { createElement, use } from "react";
//#region content/guide/waveform.html?raw
var waveform_default = "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"utf-8\" />\n  <title>波形图说明</title>\n  <meta name=\"description\" content=\"HTML 展示页面：原样渲染文件本身，样式与脚本照常工作。\" />\n  <style>\n    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; color: #1f2937; }\n    .wave-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; }\n    .wave-card:hover { border-color: #6366f1; }\n    button { cursor: pointer; }\n  </style>\n</head>\n<body>\n  <div class=\"wave-card\" id=\"wave-card\">\n    <h2 id=\"how-to-read\">波形图怎么看</h2>\n    <p>这一页是 HTML 文件原样渲染的：上面的圆角卡片样式来自页面自己的 style 标签，图片按相对地址引用同目录文件。</p>\n    <p><img src=\"demo.svg\" alt=\"波形示意\" width=\"240\" /></p>\n    <h3 id=\"scripts-run\">脚本也在跑</h3>\n    <p>下面的按钮是页面里的脚本，点了会换卡片颜色：<button type=\"button\" id=\"recolor\">换个颜色</button></p>\n    <p>HTML 页面是展示边界：内容不进站点的组件树，样式与脚本独立于站点运行。</p>\n  </div>\n  <script>\n    document.getElementById('recolor').addEventListener('click', function () {\n      var card = document.getElementById('wave-card');\n      card.style.borderColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');\n    });\n  <\/script>\n</body>\n</html>\n";
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/rolldown-runtime-EAsCxrDo.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/path-m9Srg2Jq.js
var path_exports = /* @__PURE__ */ __exportAll({
	basename: () => basename,
	dirname: () => dirname,
	extname: () => extname,
	joinPath: () => joinPath,
	normalize: () => normalize$1,
	slash: () => slash,
	splitPath: () => splitPath
});
function basename(path, ext) {
	const idx = path.lastIndexOf("/");
	return path.substring(idx === -1 ? 0 : idx + 1, ext ? path.length - ext.length : path.length);
}
function extname(path) {
	for (let i = path.length - 1; i >= 0; i--) {
		const c = path[i];
		if (c === ".") return path.substring(i);
		if (c === "/") return "";
	}
	return "";
}
function dirname(path) {
	const idx = path.lastIndexOf("/");
	if (idx === -1) return "";
	return path.substring(0, idx);
}
/**
* Split path into segments, trailing/leading slashes are removed
*/
function splitPath(path) {
	return path.split("/").filter((p) => p.length > 0);
}
/**
* Resolve paths, slashes within the path will be ignored
* @param paths - Paths to join
* @example
* ```
* ['a','b'] // 'a/b'
* ['/a'] // 'a'
* ['a', '/b'] // 'a/b'
* ['a', '../b/c'] // 'b/c'
* ```
*/
function joinPath(...paths) {
	const out = [];
	for (const path of paths) for (const seg of path.split("/")) switch (seg) {
		case "..":
			out.pop();
			break;
		case "":
		case ".": break;
		default: out.push(seg);
	}
	return out.join("/");
}
function slash(path) {
	if (path.startsWith("\\\\?\\")) return path;
	return path.replaceAll("\\", "/");
}
/**
* Convert (relative) file path to virtual file path.
*
* @param path - Relative path
* @returns Normalized path, with no trailing/leading slashes
* @throws Throws error if path starts with `./` or `../`
*/
function normalize$1(path) {
	const segments = path.split(/\/|\\/).filter((v) => v.length > 0);
	if (segments[0] === "." || segments[0] === "..") throw new Error("It must not start with './' or '../'");
	return segments.join("/");
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/utils-DEVq3cEC.js
/**
* Search the path of a node in the tree matched by the matcher.
*
* @returns The path to the target node (from starting root), or null if the page doesn't exist
*/
function findPath(nodes, matcher, options = {}) {
	const { includeSeparator = true } = options;
	function run(nodes) {
		let separator;
		for (const node of nodes) {
			if (matcher(node)) {
				const items = [];
				if (separator) items.push(separator);
				items.push(node);
				return items;
			}
			if (node.type === "separator" && includeSeparator) {
				separator = node;
				continue;
			}
			if (node.type === "folder") {
				const items = node.index && matcher(node.index) ? [node.index] : run(node.children);
				if (items) {
					items.unshift(node);
					if (separator) items.unshift(separator);
					return items;
				}
			}
		}
	}
	return run(nodes) ?? null;
}
/**
* Find the structural projection of `page` (under the root folder `from`) in `to`:
* the page at the same file path relative to the root folder.
*/
function findProjection(from, to, page) {
	const prefix = from.$ref && `${from.$ref.folder}/`;
	if (!prefix || !to.$ref || !page.$ref?.startsWith(prefix)) return;
	const target = `${to.$ref.folder}/${page.$ref.slice(prefix.length)}`;
	let result;
	visit(to, (node) => {
		if (node.type === "page" && node.$ref === target) {
			result = node;
			return "break";
		}
	});
	return result;
}
var VisitBreak = Symbol("VisitBreak");
/**
* Perform a depth-first search on page tree visiting every node.
*
* @param root - the root of page tree to visit.
* @param visitor - function to receive nodes, return `skip` to skip the children of current node, `break` to stop the search entirely.
*/
function visit(root, visitor) {
	function onNode(node, parent) {
		const result = visitor(node, parent);
		switch (result) {
			case "skip": return node;
			case "break": throw VisitBreak;
			default: if (result) node = result;
		}
		if ("index" in node && node.index) node.index = onNode(node.index, node);
		if ("fallback" in node && node.fallback) node.fallback = onNode(node.fallback, node);
		if ("children" in node) for (let i = 0; i < node.children.length; i++) node.children[i] = onNode(node.children[i], node);
		return node;
	}
	try {
		return onNode(root);
	} catch (e) {
		if (e === VisitBreak) return root;
		throw e;
	}
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/source/plugins/slugs.js
/**
* Generate slugs for pages if missing.
*/
function slugsPlugin(optsOrFn = {}) {
	const prepended = /* @__PURE__ */ new WeakSet();
	const { baseSlugs = [], slugs: slugFn } = typeof optsOrFn === "function" ? { slugs: optsOrFn } : optsOrFn;
	function generateSlugs(path, file) {
		const out = slugFn?.(file, () => getSlugs(path)) ?? getSlugs(path);
		prepended.add(file);
		return baseSlugs.length > 0 ? [...baseSlugs, ...out] : out;
	}
	return {
		name: "fumadocs:slugs",
		transformStorage({ storage }) {
			const indexFiles = [];
			const taken = /* @__PURE__ */ new Set();
			for (const path of storage.getFiles()) {
				const file = storage.read(path);
				if (!file || file.format !== "page") continue;
				if (file.slugs) {
					if (baseSlugs.length > 0 && !prepended.has(file)) {
						file.slugs = [...baseSlugs, ...file.slugs];
						prepended.add(file);
					}
					continue;
				}
				if (basename(path, extname(path)) === "index") {
					indexFiles.push(path);
					continue;
				}
				file.slugs = generateSlugs(path, file);
				const key = file.slugs.join("/");
				if (taken.has(key)) throw new Error(`Duplicated slugs: ${key}`);
				taken.add(key);
			}
			for (const path of indexFiles) {
				const file = storage.read(path);
				if (file?.format !== "page") continue;
				file.slugs = generateSlugs(path, file);
				if (taken.has(file.slugs.join("/"))) file.slugs = [...file.slugs, "index"];
				const key = file.slugs.join("/");
				if (taken.has(key)) throw new Error(`Duplicated slugs: ${key}`);
				taken.add(key);
			}
		}
	};
}
var GroupRegex = /^\(.+\)$/;
/**
* Convert file path into slugs, also encode non-ASCII characters, so they can work in pathname
*/
function getSlugs(file) {
	const dir = dirname(file);
	const name = basename(file, extname(file));
	const slugs = [];
	for (const seg of dir.split("/")) if (seg.length > 0 && !GroupRegex.test(seg)) slugs.push(encodeURI(seg));
	if (GroupRegex.test(name)) throw new Error(`Cannot use folder group in file names: ${file}`);
	if (name !== "index") slugs.push(encodeURI(name));
	return slugs;
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/icon-BILaoXeg.js
function iconPlugin(resolveIcon) {
	function replaceIcon(node) {
		if (node.icon === void 0 || typeof node.icon === "string") node.icon = resolveIcon(node.icon);
		return node;
	}
	return {
		name: "fumadocs:icon",
		transformPageTree: {
			file: replaceIcon,
			folder: replaceIcon,
			separator: replaceIcon
		}
	};
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/dynamic-Ce3F5rPi.js
/**
* In memory file system.
*/
var FileSystem = class {
	constructor(inherit) {
		this.files = /* @__PURE__ */ new Map();
		this.folders = /* @__PURE__ */ new Map();
		if (inherit) {
			for (const [k, v] of inherit.folders) this.folders.set(k, [...v]);
			for (const [k, v] of inherit.files) this.files.set(k, v);
		} else this.folders.set("", []);
	}
	read(path) {
		return this.files.get(path);
	}
	/**
	* get the direct children of folder (in virtual file path)
	*/
	readDir(path) {
		return this.folders.get(path);
	}
	write(path, file) {
		if (!this.files.has(path)) {
			const dir = dirname(path);
			this.makeDir(dir);
			this.readDir(dir)?.push(path);
		}
		this.files.set(path, file);
	}
	/**
	* Delete files at specified path.
	*
	* @param path - the target path.
	* @param [recursive=false] - if set to `true`, it will also delete directories.
	*/
	delete(path, recursive = false) {
		if (this.files.delete(path)) return true;
		if (recursive) {
			const folder = this.folders.get(path);
			if (!folder) return false;
			this.folders.delete(path);
			for (const child of folder) this.delete(child);
			return true;
		}
		return false;
	}
	getFiles() {
		return Array.from(this.files.keys());
	}
	makeDir(path) {
		const cur = [];
		let parentPath = "";
		for (const seg of path.split("/")) {
			cur.push(seg);
			const curPath = cur.join("/");
			if (!this.folders.has(curPath)) {
				this.folders.set(curPath, []);
				this.folders.get(parentPath).push(curPath);
			}
			parentPath = curPath;
		}
	}
};
function isStaticSource(s) {
	return "files" in s && Array.isArray(s.files);
}
var EmptyLang = Symbol();
/**
* convert input files into virtual file system.
*
* in the storage, locale codes are removed from file paths, hence the same file will have same file paths in every storage.
*/
function createContentStorageBuilder(loaderConfig) {
	const { input, plugins, i18n } = loaderConfig;
	let parser;
	if (!i18n) parser = (path) => [path];
	else if (i18n.parser === "dir") {
		const langSet = new Set(i18n.languages);
		parser = (path) => {
			const [locale, ...segs] = path.split("/");
			if (!locale || segs.length === 0) return [path];
			if (langSet.has(locale)) return [segs.join("/"), locale];
			if (locale === "$") return [segs.join("/"), i18n.languages];
			return [path];
		};
	} else {
		const langSet = new Set(i18n.languages);
		parser = (path) => {
			const segs = path.split("/");
			const base = segs.pop();
			if (!base) return [path];
			const parts = base.split(".");
			if (parts.length < 3) return [path];
			const [locale] = parts.splice(parts.length - 2, 1);
			segs.push(parts.join("."));
			if (langSet.has(locale)) return [segs.join("/"), locale];
			if (locale === "$") return [segs.join("/"), i18n.languages];
			return [path];
		};
	}
	const fileMap = /* @__PURE__ */ new Map();
	function scan(type, source) {
		for (const inputFile of source.files) {
			let file;
			const path = normalize$1(source.baseDir ? `${source.baseDir}/${inputFile.path}` : inputFile.path);
			if (inputFile.type === "page") file = {
				format: "page",
				type,
				path,
				slugs: inputFile.slugs,
				data: inputFile.data,
				absolutePath: inputFile.absolutePath
			};
			else file = {
				format: "meta",
				type,
				path,
				absolutePath: inputFile.absolutePath,
				data: inputFile.data
			};
			const [storageKey, locale = i18n ? i18n.defaultLanguage : EmptyLang] = parser(path);
			const entry = [storageKey, file];
			if (Array.isArray(locale)) for (const item of locale) pushMapList(fileMap, item, entry);
			else pushMapList(fileMap, locale, entry);
		}
	}
	if (isStaticSource(input)) scan(void 0, input);
	else for (const k in input) scan(k, input[k]);
	function makeStorage(locale, inherit) {
		const storage = new FileSystem(inherit);
		for (const [storageKey, file] of fileMap.get(locale) ?? []) storage.write(storageKey, file);
		const context = { storage };
		for (const plugin of plugins) plugin.transformStorage?.(context);
		return storage;
	}
	return {
		i18n() {
			const storages = {};
			if (!i18n) return storages;
			const fallbackLang = i18n.fallbackLanguage !== null ? i18n.fallbackLanguage ?? i18n.defaultLanguage : null;
			function scan(lang) {
				if (storages[lang]) return storages[lang];
				return storages[lang] = makeStorage(lang, fallbackLang && fallbackLang !== lang ? scan(fallbackLang) : void 0);
			}
			for (const lang of i18n.languages) scan(lang);
			return storages;
		},
		single() {
			return makeStorage(EmptyLang);
		}
	};
}
function pushMapList(map, k, v) {
	let list = map.get(k);
	if (!list) {
		list = [];
		map.set(k, list);
	}
	list.push(v);
}
function transformerFallback() {
	const addedFiles = /* @__PURE__ */ new Set();
	function shouldIgnore(context) {
		return context.custom?._fallback === true;
	}
	return {
		root(root) {
			if (shouldIgnore(this)) return root;
			const isolatedStorage = new FileSystem();
			if (addedFiles.size === this.storage.files.size) return root;
			for (const file of this.storage.getFiles()) {
				if (addedFiles.has(file)) continue;
				isolatedStorage.write(file, this.storage.read(file));
			}
			root.fallback = createPageTreeBuilder(isolatedStorage, {
				...this.options,
				idPrefix: this.options.idPrefix ? `fallback:${this.options.idPrefix}` : "fallback",
				generateFallback: false,
				context: {
					...this.custom,
					_fallback: true
				}
			}).root();
			addedFiles.clear();
			return root;
		},
		file(node, file) {
			if (shouldIgnore(this)) return node;
			if (file) addedFiles.add(file);
			return node;
		},
		folder(node, _dir, metaPath) {
			if (shouldIgnore(this)) return node;
			if (metaPath) addedFiles.add(metaPath);
			return node;
		}
	};
}
var group = /^\((?<name>.+)\)$/;
var link = /^(?<external>external:)?(?:\[(?<icon>[^\]]+)])?\[(?<name>[^\]]+)]\((?<url>[^)]+)\)$/;
var separator = /^---(?:\[(?<icon>[^\]]+)])?(?<name>.+)---|^---$/;
var rest = "...";
var restReversed = "z...a";
var extractPrefix = "...";
var excludePrefix = "!";
var SymbolUnfinished = Symbol("unfinished");
var SymbolName = Symbol("name");
var SymbolOwner = Symbol("owner");
function createPageTreeBuilder(input, options) {
	const flattenPathToFullPath = /* @__PURE__ */ new Map();
	const transformers = [];
	/** virtual file path -> output page tree node (if cached) */
	const pathToNode = /* @__PURE__ */ new Map();
	let _nextId = 0;
	const { noRef = false, idPrefix, url: getUrl, generateFallback = true, sort: { by: sortBy = "path", locales: sortLocales, options: sortOptions } = {} } = options;
	/** passed as additional information to transformers */
	let ctx;
	if (options.transformers) transformers.push(...options.transformers);
	if (generateFallback) transformers.push(transformerFallback());
	if (Array.isArray(input)) {
		const [locale, storages] = input;
		ctx = {
			get builder() {
				return builder;
			},
			storage: storages[locale],
			storages,
			locale,
			transformers,
			custom: options.context,
			options
		};
	} else ctx = {
		get builder() {
			return builder;
		},
		storage: input,
		transformers,
		custom: options.context,
		options
	};
	const { storage, locale } = ctx;
	for (const file of storage.getFiles()) {
		const content = storage.read(file);
		const flattenPath = file.substring(0, file.length - extname(file).length);
		flattenPathToFullPath.set(flattenPath + "." + content.format, file);
	}
	function resolveFlattenPath(name, format) {
		return flattenPathToFullPath.get(name + "." + format) ?? name;
	}
	/**
	* try to register as the owner of `node`.
	*
	* when a node is referenced by multiple folders, this determines which folder they should belong to.
	*
	* @returns whether the owner owns the node.
	*/
	function own(ownerPath, node, priority) {
		if (node[SymbolUnfinished]) return false;
		const existing = node[SymbolOwner];
		if (!existing) {
			node[SymbolOwner] = {
				owner: ownerPath,
				priority
			};
			return true;
		}
		if (existing.owner === ownerPath) {
			existing.priority = Math.max(existing.priority, priority);
			return true;
		}
		if (existing.priority >= priority) return false;
		const folder = pathToNode.get(existing.owner);
		if (folder && folder.type === "folder") {
			if (folder.index === node) delete folder.index;
			else {
				const idx = folder.children.indexOf(node);
				if (idx !== -1) folder.children.splice(idx, 1);
			}
		}
		existing.owner = ownerPath;
		existing.priority = priority;
		return true;
	}
	function transferOwner(ownerPath, node) {
		const existing = node[SymbolOwner];
		if (existing) existing.owner = ownerPath;
	}
	function generateId(localId = `_${_nextId++}`) {
		let id = localId;
		if (locale) id = `${locale}:${id}`;
		if (idPrefix) id = `${idPrefix}:${id}`;
		return id;
	}
	function buildPaths(paths, filter, reversed = false) {
		const nodes = [];
		let indexNode;
		for (const path of paths) {
			if (filter && !filter(path)) continue;
			const fileNode = buildFile(path);
			if (fileNode) {
				nodes.push(fileNode);
				if (!indexNode && basename(path, extname(path)) === "index") indexNode = fileNode;
				continue;
			}
			const dirNode = buildFolder(path);
			if (dirNode) nodes.push(dirNode);
		}
		const factor = reversed ? -1 : 1;
		const useName = sortBy === "name";
		return nodes.sort((a, b) => {
			if (a === indexNode) return -100;
			if (b === indexNode) return 100;
			const aT = useName && a[SymbolName] || (a.type === "folder" ? a.$ref.folder : a.$ref);
			const bT = useName && b[SymbolName] || (b.type === "folder" ? b.$ref.folder : b.$ref);
			const aK = a.type === "folder" ? 10 : 0;
			const bK = b.type === "folder" ? 10 : 0;
			return factor * (aT.localeCompare(bT, sortLocales, sortOptions) + (aK - bK));
		});
	}
	function resolveLink(item) {
		const match = link.exec(item);
		if (!match?.groups) return;
		const { icon, url, name, external } = match.groups;
		let node = {
			$id: generateId(),
			type: "page",
			icon,
			name,
			url,
			external: external ? true : void 0
		};
		for (const transformer of transformers) {
			if (!transformer.file) continue;
			node = transformer.file.call(ctx, node);
		}
		return node;
	}
	function resolveSeparator(item) {
		const match = separator.exec(item);
		if (!match?.groups) return;
		let node = {
			$id: generateId(),
			type: "separator",
			icon: match.groups.icon,
			name: match.groups.name
		};
		for (const transformer of transformers) {
			if (!transformer.separator) continue;
			node = transformer.separator.call(ctx, node);
		}
		return node;
	}
	function resolveFolderItem(folderPath, item, outputArray, excludedPaths) {
		if (item === rest || item === restReversed) {
			outputArray.push(item);
			return;
		}
		const separator = resolveSeparator(item);
		if (separator) {
			outputArray.push(separator);
			return;
		}
		const link = resolveLink(item);
		if (link) {
			outputArray.push(link);
			return;
		}
		if (item.startsWith(excludePrefix)) {
			const path = joinPath(folderPath, item.slice(1));
			excludedPaths.add(path);
			excludedPaths.add(resolveFlattenPath(path, "page"));
			return;
		}
		if (item.startsWith(extractPrefix)) {
			const path = joinPath(folderPath, item.slice(3));
			const node = buildFolder(path);
			if (!node) return;
			const children = node.index ? [node.index, ...node.children] : node.children;
			if (own(folderPath, node, 2)) {
				for (const child of children) {
					transferOwner(folderPath, child);
					outputArray.push(child);
				}
				excludedPaths.add(path);
			} else for (const child of children) if (own(folderPath, child, 2)) outputArray.push(child);
			return;
		}
		let path = joinPath(folderPath, item);
		let node = buildFolder(path);
		if (!node) {
			path = resolveFlattenPath(path, "page");
			node = buildFile(path);
		}
		if (!node || !own(folderPath, node, 2)) return;
		outputArray.push(node);
		excludedPaths.add(path);
	}
	function buildFolder(folderPath, isGlobalRoot = false) {
		const cached = pathToNode.get(folderPath);
		if (cached) return cached;
		const files = storage.readDir(folderPath);
		if (!files) return;
		let metaPath = resolveFlattenPath(joinPath(folderPath, "meta"), "meta");
		let meta = storage.read(metaPath);
		if (!meta || meta.format !== "meta") {
			meta = void 0;
			metaPath = void 0;
		}
		const metadata = meta?.data ?? {};
		const isRoot = metadata.root ?? isGlobalRoot;
		let node = {
			type: "folder",
			name: null,
			root: metadata.root,
			defaultOpen: metadata.defaultOpen,
			description: metadata.description,
			collapsible: metadata.collapsible,
			children: [],
			$id: generateId(folderPath),
			$ref: {
				folder: folderPath,
				meta: metaPath
			},
			[SymbolUnfinished]: true
		};
		pathToNode.set(folderPath, node);
		let indexPath;
		if (metadata.pagesIndex) {
			const resolvedPath = resolveFlattenPath(joinPath(folderPath, metadata.pagesIndex), "page");
			const page = buildFile(resolvedPath);
			if (page && own(folderPath, page, 3)) {
				indexPath = resolvedPath;
				node.index = page;
			} else node.index = resolveLink(metadata.pagesIndex);
		} else if (!isRoot) {
			const defaultPath = resolveFlattenPath(joinPath(folderPath, "index"), "page");
			const page = buildFile(defaultPath);
			if (page && own(folderPath, page, 0)) {
				indexPath = defaultPath;
				node.index = page;
			}
		}
		if (metadata.pages) {
			const outputArray = [];
			const excludedPaths = /* @__PURE__ */ new Set();
			for (const item of metadata.pages) resolveFolderItem(folderPath, item, outputArray, excludedPaths);
			if (indexPath) {
				if (excludedPaths.has(indexPath)) delete node.index;
				else excludedPaths.add(indexPath);
			}
			for (const item of outputArray) {
				if (item !== rest && item !== restReversed) {
					node.children.push(item);
					continue;
				}
				const resolvedItem = buildPaths(files, (file) => !excludedPaths.has(file), item === restReversed);
				for (const child of resolvedItem) if (own(folderPath, child, 0)) node.children.push(child);
			}
		} else for (const item of buildPaths(files, indexPath ? (file) => file !== indexPath : void 0)) if (own(folderPath, item, 0)) node.children.push(item);
		node.icon = metadata.icon ?? node.index?.icon;
		node.name = metadata.title ?? node.index?.name;
		node[SymbolName] = metadata.title ?? node.index?.[SymbolName];
		if (!node.name) {
			const folderName = basename(folderPath);
			node.name = pathToName(group.exec(folderName)?.[1] ?? folderName);
		}
		for (const transformer of transformers) {
			if (!transformer.folder) continue;
			node = transformer.folder.call(ctx, node, folderPath, metaPath);
		}
		pathToNode.set(folderPath, node);
		delete node[SymbolUnfinished];
		return node;
	}
	function buildFile(path) {
		const cached = pathToNode.get(path);
		if (cached) return cached;
		const page = storage.read(path);
		if (!page || page.format !== "page") return;
		const { title, description, icon } = page.data;
		let item = {
			$id: generateId(path),
			type: "page",
			name: title ?? pathToName(basename(path, extname(path))),
			description,
			icon,
			url: getUrl(page.slugs, ctx.locale),
			$ref: path,
			[SymbolName]: title
		};
		for (const transformer of transformers) {
			if (!transformer.file) continue;
			item = transformer.file.call(ctx, item, path);
		}
		pathToNode.set(path, item);
		return item;
	}
	const builder = {
		resolveFlattenPath,
		root(id = "root", path = "") {
			const folder = buildFolder(path, true);
			for (const node of pathToNode.values()) {
				delete node[SymbolName];
				delete node[SymbolOwner];
				if (noRef && "$ref" in node) delete node.$ref;
			}
			let root = {
				type: "root",
				$ref: folder?.$ref,
				$id: generateId(id),
				name: folder?.name || "Docs",
				description: folder?.description,
				children: folder ? folder.children : []
			};
			for (const transformer of transformers) {
				if (!transformer.root) continue;
				root = transformer.root.call(ctx, root);
			}
			return root;
		}
	};
	return builder;
}
/**
* Get item name from file name
*
* @param name - file name
*/
function pathToName(name) {
	const result = [];
	for (const c of name) if (result.length === 0) result.push(c.toLocaleUpperCase());
	else if (c === "-") result.push(" ");
	else result.push(c);
	return result.join("");
}
/** decoded, generated slugs are URI encoded but some routers pass them decoded */
function slugsKey(slugs) {
	const key = slugs.join("/");
	try {
		return decodeURI(key);
	} catch {
		return key;
	}
}
function createPageIndexer({ url }) {
	const pages = /* @__PURE__ */ new Map();
	const pathToMeta = /* @__PURE__ */ new Map();
	const pathToPage = /* @__PURE__ */ new Map();
	const urlToPage = /* @__PURE__ */ new Map();
	return {
		scan(storage, lang) {
			for (const filePath of storage.getFiles()) {
				const item = storage.read(filePath);
				const prefix = lang ? `${lang}.` : ".";
				const path = prefix + filePath;
				if (item.format === "meta") {
					pathToMeta.set(path, {
						type: item.type,
						path: item.path,
						absolutePath: item.absolutePath,
						data: item.data
					});
					continue;
				}
				const page = {
					type: item.type,
					path: item.path,
					absolutePath: item.absolutePath,
					url: url(item.slugs, lang),
					slugs: item.slugs,
					data: item.data,
					locale: lang
				};
				pathToPage.set(path, page);
				pages.set(prefix + slugsKey(page.slugs), page);
				urlToPage.set(prefix + page.url, page);
			}
		},
		getPage(path, lang = "") {
			return pathToPage.get(`${lang}.${path}`);
		},
		getPageByUrl(url, lang = "") {
			return urlToPage.get(`${lang}.${url}`);
		},
		getMeta(path, lang = "") {
			return pathToMeta.get(`${lang}.${path}`);
		},
		getPageBySlugs(slugs, lang = "") {
			return pages.get(`${lang}.${slugsKey(slugs)}`);
		},
		/** do not filter by language if `lang` is not specified */
		getPages(lang) {
			const out = [];
			for (const [key, value] of pages.entries()) if (lang === void 0 || key.startsWith(`${lang}.`)) out.push(value);
			return out;
		}
	};
}
function createGetUrl(baseUrl, i18n) {
	const baseSlugs = baseUrl.split("/");
	return (slugs, locale) => {
		const hideLocale = i18n?.hideLocale ?? "never";
		let urlLocale;
		if (hideLocale === "never") urlLocale = locale;
		else if (hideLocale === "default-locale" && locale !== i18n?.defaultLanguage) urlLocale = locale;
		const paths = [...baseSlugs, ...slugs];
		if (urlLocale) paths.unshift(urlLocale);
		return `/${paths.filter((v) => v.length > 0).join("/")}`;
	};
}
function loader(...args) {
	const loaderConfig = args.length === 2 ? resolveConfig(args[0], args[1]) : resolveConfig(args[0].source, args[0]);
	const { i18n } = loaderConfig;
	const storage = i18n ? createContentStorageBuilder(loaderConfig).i18n() : createContentStorageBuilder(loaderConfig).single();
	const indexer = createPageIndexer(loaderConfig);
	if (storage instanceof FileSystem) indexer.scan(storage);
	else for (const locale in storage) indexer.scan(storage[locale], locale);
	let pageTrees;
	function getPageTrees() {
		if (pageTrees) return pageTrees;
		const { plugins, url, pageTree: pageTreeConfig } = loaderConfig;
		const transformers = [];
		if (pageTreeConfig?.transformers) transformers.push(...pageTreeConfig.transformers);
		for (const plugin of plugins) if (plugin.transformPageTree) transformers.push(plugin.transformPageTree);
		const options = {
			url,
			...pageTreeConfig,
			transformers
		};
		if (storage instanceof FileSystem) return pageTrees = createPageTreeBuilder(storage, options).root();
		else {
			const out = {};
			for (const locale in storage) out[locale] = createPageTreeBuilder([locale, storage], options).root();
			return pageTrees = out;
		}
	}
	const out = {
		_i18n: i18n,
		get pageTree() {
			return getPageTrees();
		},
		set pageTree(v) {
			pageTrees = v;
		},
		getPageByHref(href, { dir = "", language = i18n?.defaultLanguage } = {}) {
			const [value, hash] = href.split("#", 2);
			let target;
			if (value.startsWith("./") || value.startsWith("../")) {
				let decoded = value;
				try {
					decoded = decodeURI(value);
				} catch {}
				const path = joinPath(dir, decoded);
				target = indexer.getPage(path, language);
			} else target = indexer.getPageByUrl(value, language);
			if (target) return {
				page: target,
				hash
			};
		},
		resolveHref(href, parent) {
			if (href.startsWith("./") || href.startsWith("../")) {
				const target = this.getPageByHref(href, {
					dir: dirname(parent.path),
					language: parent.locale
				});
				if (target) return target.hash ? `${target.page.url}#${target.hash}` : target.page.url;
			}
			return href;
		},
		getPages(language) {
			return indexer.getPages(language);
		},
		getLanguages() {
			const list = [];
			if (!i18n) return list;
			for (const language of i18n.languages) list.push({
				language,
				pages: this.getPages(language)
			});
			return list;
		},
		getPage(slugs = [], language = i18n?.defaultLanguage) {
			return indexer.getPageBySlugs(slugs, language);
		},
		getPageByUrl(url, language) {
			if (language !== void 0 || !i18n) return indexer.getPageByUrl(url, language);
			for (const lang of i18n.languages) {
				const page = indexer.getPageByUrl(url, lang);
				if (page) return page;
			}
		},
		getNodeMeta(node, language = i18n?.defaultLanguage) {
			const ref = node.$ref;
			if (!ref?.meta) return;
			return indexer.getMeta(ref.meta, language);
		},
		getNodePage(node, language = i18n?.defaultLanguage) {
			const ref = node.$ref;
			if (!ref) return;
			return indexer.getPage(ref, language);
		},
		getPageTree(locale) {
			if (i18n) {
				const trees = getPageTrees();
				if (locale && trees[locale]) return trees[locale];
				return trees[i18n.defaultLanguage];
			}
			return getPageTrees();
		},
		generateParams(slug, lang) {
			if (i18n) return this.getLanguages().flatMap((entry) => entry.pages.map((page) => ({
				[slug ?? "slug"]: page.slugs,
				[lang ?? "lang"]: entry.language
			})));
			return this.getPages().map((page) => ({ [slug ?? "slug"]: page.slugs }));
		},
		async serializePageTree(tree) {
			const { renderToString } = await import("react-dom/server.edge");
			return {
				$fumadocs_loader: "page-tree",
				data: visit(tree, (node) => {
					node = { ...node };
					if ("icon" in node && node.icon) node.icon = renderToString(node.icon);
					if (node.name) node.name = renderToString(node.name);
					if ("children" in node) node.children = [...node.children];
					return node;
				})
			};
		}
	};
	if (isStaticSource(loaderConfig.input)) loaderConfig.input.configureStatic?.({ loader: out });
	else for (const [k, v] of Object.entries(loaderConfig.input)) v.configureStatic?.({
		loader: out,
		source: k
	});
	return out;
}
function resolveConfig(input, { slugs, baseSlugs, icon, plugins = [], baseUrl, url, ...base }) {
	let config = {
		...base,
		url: url ? (...args) => normalizeUrl(url(...args)) : createGetUrl(baseUrl, base.i18n),
		input,
		plugins: buildPlugins([
			icon && iconPlugin(icon),
			...typeof plugins === "function" ? plugins({ typedPlugin: (plugin) => plugin }) : plugins,
			slugsPlugin({
				slugs,
				baseSlugs
			})
		])
	};
	for (const plugin of config.plugins) {
		const result = plugin.config?.(config);
		if (result) config = result;
	}
	return config;
}
var priorityMap = {
	pre: 1,
	default: 0,
	post: -1
};
function buildPlugins(plugins, sort = true) {
	const flatten = [];
	for (const plugin of plugins) if (Array.isArray(plugin)) flatten.push(...buildPlugins(plugin, false));
	else if (plugin) flatten.push(plugin);
	if (sort) return flatten.sort((a, b) => priorityMap[b.enforce ?? "default"] - priorityMap[a.enforce ?? "default"]);
	return flatten;
}
//#endregion
//#region ../lib/src/html-text.ts
var blockTagPattern = /<\/?(?:p|div|section|article|header|footer|main|aside|li|ul|ol|table|tr|td|th|thead|tbody|h[1-6]|br|pre|blockquote|figure|figcaption|dt|dd|dl|hr)\b[^>]*>/gi;
var namedEntities = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: " ",
	copy: "©",
	reg: "®",
	trade: "™",
	hellip: "…",
	mdash: "—",
	ndash: "–",
	lsquo: "‘",
	rsquo: "’",
	ldquo: "“",
	rdquo: "”",
	middot: "·",
	bull: "•"
};
function codePointOf(whole, value) {
	return Number.isInteger(value) && value >= 0 && value <= 1114111 ? String.fromCodePoint(value) : whole;
}
function decodeHtmlEntities(text) {
	return text.replace(/&#x([0-9a-f]+);/gi, (whole, hex) => codePointOf(whole, Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (whole, dec) => codePointOf(whole, Number(dec))).replace(/&([a-z]+);/gi, (whole, name) => namedEntities[name.toLowerCase()] ?? whole);
}
/** 剥掉内联标签并把实体解码成纯文本 */
function textOfHtmlFragment(fragment) {
	return decodeHtmlEntities(fragment.replace(/<[^>]+>/g, ""));
}
/** 标题哨兵：把 <h1>-<h6> 换成一行不可见的标记，携带它在全部标题里的序号 */
var headingSentinelOf = (index) => `\u0000h${index}\u0000`;
function titleFromHead(file, html) {
	const overridden = /<meta\s+name=["']fumadocs:title["']\s+content=["']([^"']*)["']/i.exec(html)?.[1];
	const fromTitleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
	const raw = overridden ?? fromTitleTag;
	const title = raw === void 0 ? void 0 : decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
	if (!title) throw new Error(`${file} 没有 <title>：HTML 页面的标题写在 <head> 的 <title> 里，要显示不同的名字再用 <meta name="fumadocs:title" content="…"> 覆盖`);
	return title;
}
function descriptionFromHead(html) {
	const raw = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1];
	return raw === void 0 ? void 0 : decodeHtmlEntities(raw).trim();
}
/** 行内元素换成 Markdown 形式，段落文本里链接与图片的地址在 Markdown 输出里保留 */
function inlineToMarkdown(fragment) {
	return decodeHtmlEntities(fragment.replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${text.replace(/<[^>]+>/g, "")}](${href})`).replace(/<img\s[^>]*src=["']([^"']*)["'][^>]*>/gi, (whole, src) => {
		return `![${/alt=["']([^"']*)["']/i.exec(whole)?.[1] ?? ""}](${src})`;
	}).replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, text) => "`" + text.replace(/<[^>]+>/g, "") + "`"));
}
/**
* 提取一页 HTML。body 里的 script、style、template、注释不进任何输出；
* 段落按块级标签切分，归属到它前面最近的标题。
*/
function extractHtmlPage(file, html) {
	const title = titleFromHead(file, html);
	const description = descriptionFromHead(html);
	const cleaned = (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html.replace(/<head\b[\s\S]*?<\/head>/gi, "").replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "").replace(/<meta\b[^>]*>/gi, "")).replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
	/** 全部标题（含无 id 的）：id 为空串表示这页内容定义处没给锚点，不进 headings，段落归属落到上一个有 id 的标题 */
	const allHeadings = [];
	const blocks = inlineToMarkdown(cleaned.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (whole, levelText, attrs, inner) => {
		const text = textOfHtmlFragment(inner).replace(/\s+/g, " ").trim();
		if (text === "") return "";
		const id = /(?:^|\s)id=["']([^"']+)["']/i.exec(attrs)?.[1];
		allHeadings.push({
			id: id ?? "",
			text,
			level: Number(levelText),
			hasAnchor: id !== void 0
		});
		return headingSentinelOf(allHeadings.length - 1);
	})).replace(blockTagPattern, "\n").replace(/<[^>]+>/g, "").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line !== "");
	const contents = [];
	const markdownLines = [`# ${title}`, ""];
	if (description) markdownLines.push(description, "");
	let currentHeading;
	for (const line of blocks) {
		const sentinel = /^\u0000h(\d+)\u0000$/.exec(line);
		if (sentinel) {
			const heading = allHeadings[Number(sentinel[1])];
			if (heading.hasAnchor) currentHeading = heading.id;
			markdownLines.push(`${"#".repeat(heading.level)} ${heading.text}`, "");
			continue;
		}
		contents.push({
			heading: currentHeading,
			content: line
		});
		markdownLines.push(line, "");
	}
	return {
		title,
		description,
		headings: allHeadings.filter(({ hasAnchor }) => hasAnchor).map(({ id, text, level }) => ({
			id,
			text,
			level
		})),
		contents,
		markdown: markdownLines.join("\n").trimEnd() + "\n"
	};
}
//#endregion
//#region ../lib/src/sources.ts
var tsxPageSuffix = ".page.tsx";
var htmlPageSuffix = ".html";
/** /content/guide/demo.page.tsx → guide/demo.tsx；.page 去掉后，slug 与 meta.json 里写的名字一致 */
function virtualPathOf(file, contentDir, suffix, extension) {
	const prefix = `${contentDir}/`;
	if (!file.startsWith(prefix) || !file.endsWith(suffix)) throw new Error(`${file} 不在 ${contentDir} 下，或者不以 ${suffix} 结尾`);
	return `${file.slice(prefix.length, -suffix.length)}${extension}`;
}
function checkedTsxMeta(file, meta) {
	const howToFix = `TSX 页面要导出 meta，如 export const meta = { title: '波形', description: '……' }`;
	if (typeof meta !== "object" || meta === null) throw new Error(`${file} 没有导出 meta：${howToFix}`);
	const { title, description, searchText, markdown } = meta;
	if (typeof title !== "string" || title === "") throw new Error(`${file} 的 meta.title 要是非空字符串：${howToFix}`);
	if (description !== void 0 && typeof description !== "string") throw new Error(`${file} 的 meta.description 要是字符串`);
	if (searchText !== void 0 && typeof searchText !== "string") throw new Error(`${file} 的 meta.searchText 要是字符串`);
	if (markdown !== void 0 && typeof markdown !== "string") throw new Error(`${file} 的 meta.markdown 要是字符串`);
	return {
		title,
		description,
		searchText,
		markdown
	};
}
function markdownOfTsxMeta(meta) {
	return meta.markdown ?? `# ${meta.title}${meta.description ? `\n\n${meta.description}` : ""}\n`;
}
/**
* TSX 页面的来源。metaOf 是站点服务端模块里
* import.meta.glob('/content/**\/*.page.tsx', { eager: true, import: 'meta' }) 的结果。
* TSX 是打包器编译的互动组件：页面正文由路由按需加载页面模块的默认导出渲染，
* 搜索只收 meta 里明确给出的文字
*/
function tsxPageSource(metaOf, contentDir = "/content") {
	return { files: Object.entries(metaOf).map(([file, meta]) => {
		const checked = checkedTsxMeta(file, meta);
		const searchTexts = [checked.description, checked.searchText].filter((text) => text !== void 0);
		return {
			type: "page",
			path: virtualPathOf(file, contentDir, tsxPageSuffix, ".tsx"),
			data: {
				title: checked.title,
				description: checked.description,
				file,
				structuredData: {
					headings: [],
					contents: searchTexts.map((content) => ({
						heading: void 0,
						content
					}))
				},
				markdown: markdownOfTsxMeta(checked),
				headings: []
			}
		};
	}) };
}
/**
* HTML 页面的来源。sourceOf 是站点服务端模块里
* import.meta.glob('/content/**\/*.html', { eager: true, query: '?raw', import: 'default' }) 的结果。
* 标题、描述、搜索分段与 Markdown 形式都从 HTML 文本派生（extractHtmlPage）；
* 正文展示由浏览器原样渲染 HTML 文件（如经 /api/content/ 送出），这里不做任何编译
*/
function htmlPageSource(sourceOf, contentDir = "/content") {
	return { files: Object.entries(sourceOf).map(([file, html]) => {
		const extracted = extractHtmlPage(file, html);
		return {
			type: "page",
			path: virtualPathOf(file, contentDir, htmlPageSuffix, ".html"),
			data: {
				title: extracted.title,
				description: extracted.description,
				file,
				structuredData: {
					headings: extracted.headings.map(({ id, text }) => ({
						id,
						content: text
					})),
					contents: extracted.contents
				},
				markdown: extracted.markdown,
				headings: extracted.headings
			}
		};
	}) };
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/build-index-BD-VRKOW.js
async function buildIndexDefault(page) {
	let structuredData;
	if (page.data.structuredData) structuredData = typeof page.data.structuredData === "function" ? await page.data.structuredData() : page.data.structuredData;
	else if ("load" in page.data && typeof page.data.load === "function") structuredData = (await page.data.load()).structuredData;
	if (!structuredData) throw new Error("Cannot find structured data from page, please define the page to index function.");
	return {
		title: page.data.title ?? basename(page.path, extname(page.path)),
		description: page.data.description,
		url: page.url,
		id: page.url,
		structuredData
	};
}
function isBreadcrumbItem(item) {
	return typeof item === "string" && item.length > 0;
}
function buildBreadcrumbs(source, page) {
	const pageTree = source.getPageTree(page.locale);
	const path = findPath(pageTree.children, (node) => node.type === "page" && node.url === page.url);
	if (path) {
		const breadcrumbs = [];
		path.pop();
		if (isBreadcrumbItem(pageTree.name)) breadcrumbs.push(pageTree.name);
		for (const segment of path) {
			if (!isBreadcrumbItem(segment.name)) continue;
			breadcrumbs.push(segment.name);
		}
		return breadcrumbs;
	}
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/inference.js
function inferTypeFromValue(value) {
	switch (typeof value) {
		case "string": return "string";
		case "number": return "number";
		case "boolean": return "boolean";
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return;
		const innerType = inferTypeFromValue(value[0]);
		if (innerType === "string" || innerType === "number" || innerType === "boolean") return `${innerType}[]`;
		return;
	}
	if (typeof value === "object" && value !== null) {
		const point = value;
		if (typeof point.lat === "number" && typeof point.lon === "number") return "geopoint";
	}
}
function flattenDocument(doc, prefix, leaves) {
	for (const [key, value] of Object.entries(doc)) {
		if (key === "id" || key === "__vector") continue;
		if (value === null || typeof value === "undefined") continue;
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && !Array.isArray(value)) {
			if (typeof value.lat === "number" && typeof value.lon === "number") {
				leaves.push([path, value]);
				continue;
			}
			flattenDocument(value, path, leaves);
			continue;
		}
		leaves.push([path, value]);
	}
}
function hasPathConflict(knownProperties, path) {
	for (const known of Object.keys(knownProperties)) if (path.startsWith(`${known}.`) || known.startsWith(`${path}.`)) return true;
	return false;
}
function setNestedSchemaProperty(schema, path, type) {
	const tokens = path.split(".");
	const lastToken = tokens[tokens.length - 1];
	let current = schema;
	for (let i = 0; i < tokens.length - 1; i++) {
		const token = tokens[i];
		const next = current[token];
		if (typeof next !== "object" || next === null || Array.isArray(next)) current[token] = {};
		current = current[token];
	}
	current[lastToken] = type;
}
function inferSchemaFromDocument(zbsearch, doc) {
	if (!zbsearch.inferSchema) return false;
	const leaves = [];
	flattenDocument(doc, "", leaves);
	const index = zbsearch.data.index;
	const sorter = zbsearch.data.sorting;
	const knownProperties = zbsearch.index.getSearchablePropertiesWithTypes(index);
	let changed = false;
	for (const [path, value] of leaves) {
		const knownType = knownProperties[path];
		if (knownType) {
			if (getNested(zbsearch.schema, path) !== knownType) setNestedSchemaProperty(zbsearch.schema, path, knownType);
			continue;
		}
		const type = inferTypeFromValue(value);
		if (!type) continue;
		if (hasPathConflict(knownProperties, path)) continue;
		addSearchablePropertyToIndex(zbsearch, index, path, type);
		addSortablePropertyToSorter(sorter, path, type);
		setNestedSchemaProperty(zbsearch.schema, path, type);
		knownProperties[path] = type;
		changed = true;
	}
	if (changed) zbsearch.caches = {};
	return changed;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/insert.js
function insert(zbsearch, doc, language, skipHooks, options) {
	inferSchemaFromDocument(zbsearch, doc);
	const errorProperty = zbsearch.validateSchema(doc, zbsearch.schema);
	if (errorProperty) throw createError("SCHEMA_VALIDATION_FAILURE", errorProperty);
	if (isAsyncFunction(zbsearch.beforeInsert) || isAsyncFunction(zbsearch.afterInsert) || isAsyncFunction(zbsearch.index.beforeInsert) || isAsyncFunction(zbsearch.index.insert) || isAsyncFunction(zbsearch.index.afterInsert)) return innerInsertAsync(zbsearch, doc, language, skipHooks, options);
	return innerInsertSync(zbsearch, doc, language, skipHooks, options);
}
var ENUM_TYPE = /* @__PURE__ */ new Set(["enum", "enum[]"]);
var STRING_NUMBER_TYPE = /* @__PURE__ */ new Set(["string", "number"]);
async function innerInsertAsync(zbsearch, doc, language, skipHooks, options) {
	const { index, docs } = zbsearch.data;
	const id = zbsearch.getDocumentIndexId(doc);
	if (typeof id !== "string") throw createError("DOCUMENT_ID_MUST_BE_STRING", typeof id);
	const internalId = getInternalDocumentId(zbsearch.internalDocumentIDStore, id);
	if (!skipHooks) await runSingleHook(zbsearch.beforeInsert, zbsearch, id, doc);
	if (!zbsearch.documentsStore.store(docs, id, internalId, doc)) throw createError("DOCUMENT_ALREADY_EXISTS", id);
	const docsCount = zbsearch.documentsStore.count(docs);
	const indexableProperties = zbsearch.index.getSearchableProperties(index);
	const indexablePropertiesWithTypes = zbsearch.index.getSearchablePropertiesWithTypes(index);
	const indexableValues = zbsearch.getDocumentProperties(doc, indexableProperties);
	for (const [key, value] of Object.entries(indexableValues)) {
		if (typeof value === "undefined") continue;
		const actualType = typeof value;
		const expectedType = indexablePropertiesWithTypes[key];
		validateDocumentProperty(actualType, expectedType, key, value);
	}
	await indexAndSortDocument(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options);
	if (!skipHooks) await runSingleHook(zbsearch.afterInsert, zbsearch, id, doc);
	return id;
}
function getInsertMetadata(zbsearch) {
	let indexableProperties = zbsearch.caches["indexableProperties"];
	let indexablePropertiesWithTypes = zbsearch.caches["indexablePropertiesWithTypes"];
	let sortableProperties = zbsearch.caches["sortableProperties"];
	let sortablePropertiesWithTypes = zbsearch.caches["sortablePropertiesWithTypes"];
	if (!indexableProperties) {
		indexableProperties = zbsearch.index.getSearchableProperties(zbsearch.data.index);
		indexablePropertiesWithTypes = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
		sortableProperties = zbsearch.sorter.getSortableProperties(zbsearch.data.sorting);
		sortablePropertiesWithTypes = zbsearch.sorter.getSortablePropertiesWithTypes(zbsearch.data.sorting);
		zbsearch.caches["indexableProperties"] = indexableProperties;
		zbsearch.caches["indexablePropertiesWithTypes"] = indexablePropertiesWithTypes;
		zbsearch.caches["sortableProperties"] = sortableProperties;
		zbsearch.caches["sortablePropertiesWithTypes"] = sortablePropertiesWithTypes;
	}
	return {
		indexableProperties,
		indexablePropertiesWithTypes,
		sortableProperties,
		sortablePropertiesWithTypes
	};
}
function innerInsertSync(zbsearch, doc, language, skipHooks, options) {
	const { index: _index, docs } = zbsearch.data;
	const id = zbsearch.getDocumentIndexId(doc);
	if (typeof id !== "string") throw createError("DOCUMENT_ID_MUST_BE_STRING", typeof id);
	const internalId = getInternalDocumentId(zbsearch.internalDocumentIDStore, id);
	if (!skipHooks && zbsearch.beforeInsert?.length) runSingleHook(zbsearch.beforeInsert, zbsearch, id, doc);
	if (!zbsearch.documentsStore.store(docs, id, internalId, doc)) throw createError("DOCUMENT_ALREADY_EXISTS", id);
	const docsCount = zbsearch.documentsStore.count(docs);
	const { indexableProperties, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes } = getInsertMetadata(zbsearch);
	const indexableValues = zbsearch.getDocumentProperties(doc, indexableProperties);
	for (const [key, value] of Object.entries(indexableValues)) {
		if (typeof value === "undefined") continue;
		const actualType = typeof value;
		const expectedType = indexablePropertiesWithTypes[key];
		validateDocumentProperty(actualType, expectedType, key, value);
	}
	indexAndSortDocumentSync(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes);
	if (!skipHooks && zbsearch.afterInsert?.length) runSingleHook(zbsearch.afterInsert, zbsearch, id, doc);
	return id;
}
function validateDocumentProperty(actualType, expectedType, key, value) {
	if (isGeoPointType(expectedType) && typeof value === "object" && typeof value.lon === "number" && typeof value.lat === "number") return;
	if (isVectorType(expectedType) && Array.isArray(value)) return;
	if (isArrayType(expectedType) && Array.isArray(value)) return;
	if (ENUM_TYPE.has(expectedType) && STRING_NUMBER_TYPE.has(actualType)) return;
	if (actualType !== expectedType) throw createError("INVALID_DOCUMENT_PROPERTY", key, expectedType, actualType);
}
async function indexAndSortDocument(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options) {
	for (const prop of indexableProperties) {
		const value = indexableValues[prop];
		if (typeof value === "undefined") continue;
		const expectedType = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index)[prop];
		await zbsearch.index.beforeInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
		const internalId = zbsearch.internalDocumentIDStore.idToInternalId.get(id);
		await zbsearch.index.insert(zbsearch.index, zbsearch.data.index, prop, id, internalId, value, expectedType, language, zbsearch.tokenizer, docsCount, options);
		await zbsearch.index.afterInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
	}
	const sortableProperties = zbsearch.sorter.getSortableProperties(zbsearch.data.sorting);
	const sortableValues = zbsearch.getDocumentProperties(doc, sortableProperties);
	for (const prop of sortableProperties) {
		const value = sortableValues[prop];
		if (typeof value === "undefined") continue;
		const expectedType = zbsearch.sorter.getSortablePropertiesWithTypes(zbsearch.data.sorting)[prop];
		zbsearch.sorter.insert(zbsearch.data.sorting, prop, id, value, expectedType, language);
	}
}
function indexAndSortDocumentSync(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options, cachedIndexTypes, cachedSortableProperties, cachedSortableTypes) {
	const indexTypes = cachedIndexTypes ?? zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
	const internalDocumentId = getInternalDocumentId(zbsearch.internalDocumentIDStore, id);
	for (const prop of indexableProperties) {
		const value = indexableValues[prop];
		if (typeof value === "undefined") continue;
		const expectedType = indexTypes[prop];
		zbsearch.index.beforeInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
		zbsearch.index.insert(zbsearch.index, zbsearch.data.index, prop, id, internalDocumentId, value, expectedType, language, zbsearch.tokenizer, docsCount, options);
		zbsearch.index.afterInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
	}
	const sortableProperties = cachedSortableProperties ?? zbsearch.sorter.getSortableProperties(zbsearch.data.sorting);
	const sortableTypes = cachedSortableTypes ?? zbsearch.sorter.getSortablePropertiesWithTypes(zbsearch.data.sorting);
	const sortableValues = zbsearch.getDocumentProperties(doc, sortableProperties);
	for (const prop of sortableProperties) {
		const value = sortableValues[prop];
		if (typeof value === "undefined") continue;
		const expectedType = sortableTypes[prop];
		zbsearch.sorter.insert(zbsearch.data.sorting, prop, id, value, expectedType, language);
	}
}
function insertBatchSync(zbsearch, batch, ids, language, skipHooks) {
	let { indexableProperties, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes } = getInsertMetadata(zbsearch);
	const batchOptions = { avlRebalanceThreshold: batch.length };
	const { docs: docsStore } = zbsearch.data;
	for (const doc of batch) {
		if (inferSchemaFromDocument(zbsearch, doc)) ({indexableProperties, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes} = getInsertMetadata(zbsearch));
		const errorProperty = zbsearch.validateSchema(doc, zbsearch.schema);
		if (errorProperty) throw createError("SCHEMA_VALIDATION_FAILURE", errorProperty);
		const id = zbsearch.getDocumentIndexId(doc);
		if (typeof id !== "string") throw createError("DOCUMENT_ID_MUST_BE_STRING", typeof id);
		const internalId = getInternalDocumentId(zbsearch.internalDocumentIDStore, id);
		if (!skipHooks && zbsearch.beforeInsert?.length) runSingleHook(zbsearch.beforeInsert, zbsearch, id, doc);
		if (!zbsearch.documentsStore.store(docsStore, id, internalId, doc)) throw createError("DOCUMENT_ALREADY_EXISTS", id);
		const docsCount = zbsearch.documentsStore.count(docsStore);
		const indexableValues = zbsearch.getDocumentProperties(doc, indexableProperties);
		indexAndSortDocumentSync(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, batchOptions, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes);
		if (!skipHooks && zbsearch.afterInsert?.length) runSingleHook(zbsearch.afterInsert, zbsearch, id, doc);
		ids.push(id);
	}
}
function needsAsyncInsert(zbsearch) {
	return isAsyncFunction(zbsearch.beforeInsert) || isAsyncFunction(zbsearch.afterInsert) || isAsyncFunction(zbsearch.index.beforeInsert) || isAsyncFunction(zbsearch.index.insert) || isAsyncFunction(zbsearch.index.afterInsert);
}
async function insertMultipleAsync(zbsearch, docs, options = {}) {
	const { batchSize = 100, language, skipHooks, onProgress } = options;
	if (!Number.isInteger(batchSize) || batchSize < 1) throw createError("INVALID_BATCH_SIZE", batchSize);
	const asyncNeeded = needsAsyncInsert(zbsearch);
	const total = docs.length;
	const ids = [];
	for (let start = 0; start < total; start += batchSize) {
		const batch = docs.slice(start, start + batchSize);
		if (asyncNeeded) {
			const insertOptions = { avlRebalanceThreshold: batch.length };
			for (const doc of batch) ids.push(await insert(zbsearch, doc, language, skipHooks, insertOptions));
		} else insertBatchSync(zbsearch, batch, ids, language, skipHooks);
		onProgress?.({
			processed: ids.length,
			total
		});
		if (start + batchSize < total) await yieldToEventLoop();
	}
	if (!skipHooks && zbsearch.afterInsertMultiple?.length) await runMultipleHook(zbsearch.afterInsertMultiple, zbsearch, docs);
	return ids;
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/build-doc-C7HYXyRK.js
function buildDocuments(indexes) {
	const docs = [];
	for (const page of indexes) {
		const pageTag = page.tag ?? [];
		const tags = Array.isArray(pageTag) ? pageTag : [pageTag];
		const data = page.structuredData;
		let id = 0;
		docs.push({
			id: page.id,
			page_id: page.id,
			type: "page",
			content: page.title,
			breadcrumbs: page.breadcrumbs,
			tags,
			url: page.url,
			locale: page.locale
		});
		const nextId = () => `${page.id}-${id++}`;
		if (page.description && !data.contents.some((item) => item.content === page.description)) docs.push({
			id: nextId(),
			page_id: page.id,
			tags,
			type: "text",
			url: page.url,
			content: page.description,
			locale: page.locale
		});
		for (const heading of data.headings) docs.push({
			id: nextId(),
			page_id: page.id,
			type: "heading",
			tags,
			url: `${page.url}#${heading.id}`,
			content: heading.content,
			locale: page.locale
		});
		for (const content of data.contents) docs.push({
			id: nextId(),
			page_id: page.id,
			tags,
			type: "text",
			url: content.heading ? `${page.url}#${content.heading}` : page.url,
			content: content.content,
			locale: page.locale,
			table: content.table
		});
	}
	return docs;
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/search/server.js
var simpleSchema = {
	url: "string",
	title: "string",
	breadcrumbs: "string[]",
	description: "string",
	content: "string",
	keywords: "string",
	locale: "enum"
};
var advancedSchema = {
	content: "string",
	page_id: "string",
	type: "string",
	breadcrumbs: "string[]",
	tags: "enum[]",
	url: "string",
	locale: "enum",
	embeddings: "vector[512]"
};
var DefaultLanguage = "multilingual";
async function createDB({ indexes, tokenizer, language = DefaultLanguage, search: _, localeFilter: __, ...rest }) {
	const items = typeof indexes === "function" ? await indexes() : indexes;
	const resolvedTokenizer = tokenizer ?? rest.components?.tokenizer;
	const db = create$1({
		schema: advancedSchema,
		language: resolvedTokenizer ? void 0 : language,
		...rest,
		components: {
			...rest.components,
			tokenizer: resolvedTokenizer
		}
	});
	await insertMultipleAsync(db, buildDocuments(items));
	return db;
}
async function createDBSimple({ indexes, tokenizer, language = DefaultLanguage, search: _, localeFilter: __, ...rest }) {
	const items = typeof indexes === "function" ? await indexes() : indexes;
	const resolvedTokenizer = tokenizer ?? rest.components?.tokenizer;
	const db = create$1({
		schema: simpleSchema,
		language: resolvedTokenizer ? void 0 : language,
		...rest,
		components: {
			...rest.components,
			tokenizer: resolvedTokenizer
		}
	});
	await insertMultipleAsync(db, items.map((page) => ({
		title: page.title,
		description: page.description,
		breadcrumbs: page.breadcrumbs,
		url: page.url,
		content: page.content,
		keywords: page.keywords,
		locale: page.locale
	})));
	return db;
}
function initSimpleSearch(options) {
	const doc = createDBSimple(options);
	return {
		async export() {
			return {
				type: "simple",
				...options.localeFilter ? { i18n: true } : null,
				...save(await doc)
			};
		},
		async search(query, searchOptions = {}) {
			const db = await doc;
			const { limit, locale } = searchOptions;
			return searchSimple(db, query, {
				limit,
				...options.search
			}, options.localeFilter && locale ? locale : void 0);
		}
	};
}
function initAdvancedSearch(options) {
	const get = createDB(options);
	return {
		async export() {
			return {
				type: "advanced",
				...options.localeFilter ? { i18n: true } : null,
				...save(await get)
			};
		},
		async search(query, searchOptions = {}) {
			const db = await get;
			const { limit, tag, mode, locale } = searchOptions;
			return searchAdvanced(db, query, tag, {
				...options.search,
				limit: limit ?? options.search?.limit,
				mode: mode === "vector" ? "vector" : "fulltext"
			}, options.localeFilter && locale ? locale : void 0).catch((err) => {
				if (mode === "vector") throw new Error("failed to search, make sure your indexes include `embeddings` and a plugin/proxy is configured to vectorize search terms.", { cause: err });
				throw err;
			});
		}
	};
}
function createI18nSearchAPI(...[type, options]) {
	if (options.localeMap) return createI18nSearchAPILegacy(type, options);
	const server = type === "simple" ? initSimpleSearch({
		...options,
		localeFilter: true
	}) : initAdvancedSearch({
		...options,
		localeFilter: true
	});
	return toAPI({
		export: server.export,
		async search(query, searchOptions) {
			return server.search(query, {
				...searchOptions,
				locale: searchOptions?.locale ?? options.i18n.defaultLanguage
			});
		}
	});
}
function createI18nSearchAPILegacy(type, options) {
	async function initSearchServers() {
		const map = /* @__PURE__ */ new Map();
		if (options.i18n.languages.length === 0) return map;
		const indexes = typeof options.indexes === "function" ? await options.indexes() : options.indexes;
		for (const locale of options.i18n.languages) {
			const localeIndexes = indexes.filter((index) => index.locale === locale);
			const mapped = options.localeMap?.[locale] ?? "multilingual";
			if (type === "simple") map.set(locale, typeof mapped === "object" ? initSimpleSearch({
				...options,
				...mapped,
				indexes: localeIndexes
			}) : initSimpleSearch({
				...options,
				language: mapped,
				indexes: localeIndexes
			}));
			else map.set(locale, typeof mapped === "object" ? initAdvancedSearch({
				...options,
				indexes: localeIndexes,
				...mapped
			}) : initAdvancedSearch({
				...options,
				language: mapped,
				indexes: localeIndexes
			}));
		}
		return map;
	}
	const get = initSearchServers();
	return toAPI({
		async export() {
			const map = await get;
			const entries = Array.from(map.entries()).map(async ([k, v]) => [k, await v.export()]);
			return {
				type: "i18n",
				data: Object.fromEntries(await Promise.all(entries))
			};
		},
		async search(query, searchOptions) {
			const map = await get;
			const locale = searchOptions?.locale ?? options.i18n.defaultLanguage;
			const handler = map.get(locale);
			if (handler) return handler.search(query, searchOptions);
			return [];
		}
	});
}
/**
* create server from loader, if passed as function, the server will re-index all records once a different instance of loader is returned.
*/
function createFromSource(loader, options = {}) {
	const { buildIndex = buildIndexDefault } = options;
	const cache = /* @__PURE__ */ new WeakMap();
	async function initServer(loader) {
		const indexes = await Promise.all(loader.getPages().map(async (page) => {
			const index = await buildIndex(page);
			return {
				...index,
				breadcrumbs: index.breadcrumbs ?? buildBreadcrumbs(loader, page),
				locale: page.locale
			};
		}));
		if (loader._i18n) return createI18nSearchAPI("advanced", {
			...options,
			indexes,
			i18n: loader._i18n
		});
		return initAdvancedSearch({
			indexes,
			...options
		});
	}
	async function getCurrentServer() {
		const l = typeof loader === "function" ? await loader() : loader;
		let server = cache.get(l);
		if (!server) {
			const promise = initServer(l);
			promise.catch(() => {
				if (cache.get(l) === promise) cache.delete(l);
			});
			cache.set(l, promise);
			server = promise;
		}
		return await server;
	}
	return toAPI({
		async export() {
			return (await getCurrentServer()).export();
		},
		async search(query, options) {
			return (await getCurrentServer()).search(query, options);
		}
	});
}
function toAPI(server) {
	return createEndpoint(server, { readOptions(url) {
		return {
			...defaultReadOptions(url),
			mode: url.searchParams.get("mode") === "vector" ? "vector" : "full"
		};
	} });
}
//#endregion
//#region ../lib/src/search.ts
/**
* 中文站点的搜索服务：站点路由用它包装自己的 loader，代替直接调 fumadocs 的 createFromSource。
* zbsearch 默认 multilingual 分词（中文能切开），但另两项默认值不适合中文：
* tolerance 1 允许一个字的出入，搜「滑块」会命中「模块」；threshold 1 只要切出的词有一个出现就算命中，
* 搜「页面树」时含「页面」的页全都返回。这里两项都设为 0：每个词都要原样出现。
*
* 传函数而不是 loader 实例：createFromSource 的公开约定是 loader 实例变化时重建全部索引，
* 开发模式下内容增删让来源模块重新执行、得到新 loader 时，搜索跟着重建
*/
function searchServerOf(getSource) {
	return createFromSource(getSource, { search: {
		tolerance: 0,
		threshold: 0
	} });
}
//#endregion
//#region content/guide/quickstart.mdx?macro_id=app%2Flib%2Fcollections.ts%23docs&only=frontmatter
var frontmatter$1 = {
	"title": "快速开始",
	"description": "用 MDX 写文档页：frontmatter、标题结构、同目录图片。"
};
//#endregion
//#region content/index.mdx?macro_id=app%2Flib%2Fcollections.ts%23docs&only=frontmatter
var frontmatter = {
	"title": "三种页面来源",
	"description": "MDX、TSX、HTML 三种格式的页面进同一棵页面树与同一个搜索索引。"
};
var meta_json_macro_id_app_2Flib_2Fcollections_default$1 = {
	title: "指南",
	pages: [
		"quickstart",
		"counter",
		"waveform"
	]
};
var meta_json_macro_id_app_2Flib_2Fcollections_default = {
	title: "页面来源示例",
	pages: ["index", "guide"]
};
//#endregion
//#region ../node_modules/.pnpm/fumadocs-mdx@15.4.7_@types+_4cbb2e517fc4b66733860c06f2550baa/node_modules/fumadocs-mdx/dist/runtime/server.js
function server() {
	function fileInfo(file, base) {
		if (file.startsWith("./")) file = file.slice(2);
		return {
			path: file,
			fullPath: !base || base.endsWith("/") ? base + file : `${base}/${file}`
		};
	}
	function mapDocData(entry) {
		const data = {
			body: entry.default,
			toc: entry.toc,
			structuredData: entry.structuredData,
			_exports: entry
		};
		for (const key of ["lastModified", "extractedReferences"]) data[key] = entry[key];
		return data;
	}
	return {
		async doc(_name, base, glob) {
			return await Promise.all(Object.entries(glob).map(async ([k, v]) => {
				const data = typeof v === "function" ? await v() : v;
				return {
					...mapDocData(data),
					...data.frontmatter,
					...createDocMethods(fileInfo(k, base), () => data)
				};
			}));
		},
		async docLazy(_name, base, head, body) {
			return await Promise.all(Object.entries(head).map(async ([k, v]) => {
				const data = typeof v === "function" ? await v() : v;
				const content = body[k];
				return {
					...data,
					...createDocMethods(fileInfo(k, base), content),
					async load() {
						return mapDocData(await content());
					},
					async structuredData() {
						return (await content()).structuredData;
					}
				};
			}));
		},
		async meta(_name, base, glob) {
			return await Promise.all(Object.entries(glob).map(async ([k, v]) => {
				const data = typeof v === "function" ? await v() : v;
				return {
					info: fileInfo(k, base),
					...data
				};
			}));
		},
		async docs(name, base, metaGlob, docGlob) {
			return {
				docs: await this.doc(name, base, docGlob),
				meta: await this.meta(name, base, metaGlob),
				toFumadocsSource(options) {
					return toFumadocsSource(this.docs, this.meta, options);
				}
			};
		},
		async docsLazy(name, base, metaGlob, docHeadGlob, docBodyGlob) {
			return {
				docs: await this.docLazy(name, base, docHeadGlob, docBodyGlob),
				meta: await this.meta(name, base, metaGlob),
				toFumadocsSource(options) {
					return toFumadocsSource(this.docs, this.meta, options);
				}
			};
		}
	};
}
function toFumadocsSource(pages, metas, options) {
	const baseDir = options?.baseDir;
	const files = [];
	for (const entry of pages) files.push({
		type: "page",
		path: baseDir ? path_exports.joinPath(baseDir, entry.info.path) : entry.info.path,
		absolutePath: entry.info.fullPath,
		data: entry
	});
	for (const entry of metas) files.push({
		type: "meta",
		path: baseDir ? path_exports.joinPath(baseDir, entry.info.path) : entry.info.path,
		absolutePath: entry.info.fullPath,
		data: entry
	});
	return { files };
}
function createDocMethods(info, load) {
	return {
		info,
		async getText(type, options) {
			if (type === "raw") return await (await import("node:fs/promises")).readFile(info.fullPath, "utf-8");
			const data = await load();
			const markdown = data._markdown ?? data._exports?._markdown;
			if (typeof markdown === "string") return markdown;
			if (markdown) {
				const { renderToMarkdown } = await import("./server-B_vrqvU3.js");
				return renderToMarkdown(createElement(markdown, { components: options?.components }));
			}
			throw new Error("getText('processed') requires `includeProcessedMarkdown` to be enabled in your collection config.");
		},
		async getMDAST() {
			const data = await load();
			if (!data._mdast) throw new Error("getMDAST() requires `includeMDAST` to be enabled in your collection config.");
			return JSON.parse(data._mdast);
		}
	};
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-mdx@15.4.7_@types+_4cbb2e517fc4b66733860c06f2550baa/node_modules/fumadocs-mdx/dist/runtime/macro.js
function create() {
	return server();
}
function normalize(file) {
	file = file.replaceAll("\\", "/");
	return file.startsWith("./") ? file.slice(2) : file;
}
function accessor(entries) {
	return {
		entries,
		get(path) {
			path = normalize(path);
			return entries.find((entry) => entry.info.path === path);
		}
	};
}
/**
* annotate promise state in the convention understood by React `use()`, so settled promises are unwrapped without suspending.
*/
function track(promise) {
	const tracked = promise;
	tracked.status = "pending";
	promise.then((value) => {
		tracked.status = "fulfilled";
		tracked.value = value;
	}, (reason) => {
		tracked.status = "rejected";
		tracked.reason = reason;
	});
	return tracked;
}
function asyncEntries(raw) {
	return raw.map((entry) => {
		let promise;
		const load = () => promise ??= track(entry.load());
		function Body(props) {
			const loaded = load();
			const data = loaded.status === "fulfilled" ? loaded.value : use(loaded);
			return createElement(data.body, props);
		}
		return {
			...entry,
			load,
			async preload() {
				await load();
			},
			body: Body
		};
	});
}
async function docsAsync(args) {
	const instance = create();
	const [rawDocEntries, metaEntries] = await Promise.all([instance.docLazy("doc", args.base, args.head, args.body), instance.meta("meta", args.base, args.meta)]);
	const docEntries = asyncEntries(rawDocEntries);
	const getDoc = accessor(docEntries);
	const getMeta = accessor(metaEntries);
	return {
		docs: docEntries,
		meta: metaEntries,
		getPage: getDoc.get,
		getMeta: getMeta.get,
		toFumadocsSource(options) {
			return toFumadocsSource(docEntries, metaEntries, options);
		}
	};
}
//#endregion
//#region app/lib/collections.ts
/**
* 集合与页面模块清单，服务端和浏览器都用。defineDocs 与 import.meta.glob 的参数要能静态分析，
* 只能写在站点模块里，不能挪进来源包。
* MDX 集合是宏式 async（官方 React Router 示例的现行形态）：frontmatter（标题、描述、搜索数据）
* 两端同步可用，正文按需加载——这就是集合的 server/browser 分离
*/
var docs = await docsAsync({
	base: "content",
	head: /* #__PURE__ */ Object.assign({
		"./guide/quickstart.mdx": frontmatter$1,
		"./index.mdx": frontmatter
	}),
	body: /* #__PURE__ */ Object.assign({
		"./guide/quickstart.mdx": () => import("./quickstart.mdx_macro_id_app_2Flib_2Fcollections-CQ1wtrlu.js"),
		"./index.mdx": () => import("./index.mdx_macro_id_app_2Flib_2Fcollections-M_YhoVc8.js")
	}),
	meta: /* #__PURE__ */ Object.assign({
		"./guide/meta.json": meta_json_macro_id_app_2Flib_2Fcollections_default$1,
		"./meta.json": meta_json_macro_id_app_2Flib_2Fcollections_default
	})
});
/** TSX 页面模块：非 eager 的整模块 glob，路由按需加载页面组件（默认导出） */
var tsxPageModules = /* #__PURE__ */ Object.assign({ "/content/guide/counter.page.tsx": () => import("./counter.page-ACcUe1Jq.js") });
//#endregion
//#region app/lib/source.server.ts
/**
* 三种格式的页面进同一棵页面树、同一个搜索索引；page.type 是来源的名字（mdx / tsx / html）。
* 只在服务端用（.server 文件不进浏览器包）：HTML 原文与 TSX meta 的 eager glob 都在这里，
* 路由的 loader 从这里查页，浏览器端渲染走各格式自己的按需入口（宏集合、懒 glob、iframe）
*
* 两个 glob 都用根路径模式（以 / 开头、不带 base）：Vite 按项目根解析，
* 避开 Windows 上相对 base 的 toAbsoluteGlob 缺陷（见 ../README.md 与 result.md）
*/
var tsxPageMeta = /* #__PURE__ */ Object.assign({ "/content/guide/counter.page.tsx": meta });
var htmlPageText = /* #__PURE__ */ Object.assign({ "/content/guide/waveform.html": waveform_default });
var source = loader({
	source: {
		mdx: docs.toFumadocsSource(),
		tsx: tsxPageSource(tsxPageMeta),
		html: htmlPageSource(htmlPageText)
	},
	baseUrl: "/"
});
/** 搜索服务：loader 实例变化（开发时内容增删让本模块重新执行）时按公开约定重建索引 */
var searchServer = searchServerOf(() => source);
//#endregion
export { findPath as a, tsxPageModules as i, source as n, findProjection as o, docs as r, visit as s, searchServer as t };

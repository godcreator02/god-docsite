import { t as join } from "./url-BVHvi3_K-O95YmUkP.js";
import { n as useSearch } from "./use-search-Dy8lBrbN-Cxr6OgVl.js";
import { t as removeUndefined } from "./remove-undefined-CzMSKybq-DHMHsQDm.js";
import { useCallback, useRef } from "react";
var RESERVED_VECTOR_INDEX_KEY = "__vector";
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/tokenizer/languages.js
var SUPPORTED_LANGUAGE_LOCALES = {
	arabic: "ar",
	armenian: "hy",
	bulgarian: "bg",
	czech: "cs",
	danish: "da",
	dutch: "nl",
	english: "en",
	finnish: "fi",
	french: "fr",
	german: "de",
	greek: "el",
	hungarian: "hu",
	indian: "hi",
	indonesian: "id",
	irish: "ga",
	italian: "it",
	lithuanian: "lt",
	nepali: "ne",
	norwegian: "no",
	portuguese: "pt",
	romanian: "ro",
	russian: "ru",
	serbian: "sr",
	slovak: "sk",
	slovenian: "sl",
	spanish: "es",
	swedish: "sv",
	tamil: "ta",
	turkish: "tr",
	ukrainian: "uk",
	vietnamese: "vi",
	sanskrit: "sa"
};
var MULTILINGUAL_LANGUAGE = "multilingual";
var FOLDABLE_LETTERS = "\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u017F";
var SPLITTERS = Object.fromEntries(Object.entries({
	dutch: "A-Za-zàèéìòóù0-9_'-",
	english: "A-Za-zàèéìòóù0-9_'-",
	french: "a-z0-9äâàéèëêïîöôùüûœç-",
	italian: "A-Za-zàèéìòóù0-9_'-",
	norwegian: "a-z0-9_æøåÆØÅäÄöÖüÜ",
	portuguese: "a-z0-9à-úÀ-Ú",
	russian: "a-z0-9а-яА-ЯёЁ",
	spanish: "a-z0-9A-Zá-úÁ-ÚñÑüÜ",
	swedish: "a-z0-9_åÅäÄöÖüÜ-",
	german: "a-z0-9A-ZäöüÄÖÜß",
	finnish: "a-z0-9äöÄÖ",
	danish: "a-z0-9æøåÆØÅ",
	hungarian: "a-z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ",
	romanian: "a-z0-9ăâîșțĂÂÎȘȚ",
	serbian: "a-z0-9čćžšđČĆŽŠĐ",
	turkish: "a-z0-9çÇğĞıİöÖşŞüÜ",
	lithuanian: "a-z0-9ąčęėįšųūžĄČĘĖĮŠŲŪŽ",
	arabic: "a-z0-9ء-ي\\u0671",
	nepali: "a-z0-9अ-ह",
	irish: "a-z0-9áéíóúÁÉÍÓÚ",
	indian: "a-z0-9अ-ह",
	armenian: "a-z0-9ա-ֆ",
	greek: "a-z0-9α-ωά-ώ",
	indonesian: "a-z0-9",
	ukrainian: "a-z0-9а-яА-ЯіїєІЇЄ",
	slovenian: "a-z0-9čžšČŽŠ",
	bulgarian: "a-z0-9а-яА-Я",
	tamil: "a-z0-9அ-ஹ",
	sanskrit: "a-z0-9A-Zāīūṛḷṃṁḥśṣṭḍṇṅñḻḹṝ",
	vietnamese: "a-z0-9A-ZáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ_",
	czech: "A-Z0-9a-zěščřžýáíéúůóťďĚŠČŘŽÝÁÍÉÓÚŮŤĎ-",
	slovak: "A-Z0-9a-záäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ-"
}).map(([language, alphabet]) => [language, new RegExp(`[^\\p{L}\\p{M}${FOLDABLE_LETTERS}${alphabet}]+`, "gimu")]));
var SUPPORTED_LANGUAGES = Object.keys(SUPPORTED_LANGUAGE_LOCALES);
function getLocale(language) {
	return language !== void 0 && SUPPORTED_LANGUAGES.includes(language) ? SUPPORTED_LANGUAGE_LOCALES[language] : void 0;
}
var LANGUAGES_WITH_SIGNIFICANT_DIACRITICS = /* @__PURE__ */ new Set(["vietnamese"]);
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/utils.js
var baseId = Date.now().toString().slice(5);
var lastId = 0;
var nano = BigInt(1e3);
var milli = BigInt(1e6);
var second = BigInt(1e9);
function getNodeProcess() {
	return globalThis.process;
}
/**
* This value can be increased up to 100_000
* But i don't know if this value change from nodejs to nodejs
* So I will keep a safer value here.
*/
var MAX_ARGUMENT_FOR_STACK = 65535;
/**
* This method is needed to used because of issues like: https://github.com/oramasearch/orama/issues/301
* that issue is caused because the array that is pushed is huge (>100k)
*
* @example
* ```ts
* safeArrayPush(myArray, [1, 2])
* ```
*/
function safeArrayPush(arr, newArr) {
	if (newArr.length < 65535) Array.prototype.push.apply(arr, newArr);
	else {
		const newArrLength = newArr.length;
		for (let i = 0; i < newArrLength; i += MAX_ARGUMENT_FOR_STACK) Array.prototype.push.apply(arr, newArr.slice(i, i + MAX_ARGUMENT_FOR_STACK));
	}
}
function sprintf(template, ...args) {
	return template.replace(/%(?:(?<position>\d+)\$)?(?<width>-?\d*\.?\d*)(?<type>[dfs])/g, function(...replaceArgs) {
		const { width: rawWidth, type, position } = replaceArgs[replaceArgs.length - 1];
		const replacement = position ? args[Number.parseInt(position) - 1] : args.shift();
		const width = rawWidth === "" ? 0 : Number.parseInt(rawWidth);
		switch (type) {
			case "d": return replacement.toString().padStart(width, "0");
			case "f": {
				let value = replacement;
				const [padding, precision] = rawWidth.split(".").map((w) => Number.parseFloat(w));
				if (typeof precision === "number" && precision >= 0) value = value.toFixed(precision);
				return typeof padding === "number" && padding >= 0 ? value.toString().padStart(width, "0") : value.toString();
			}
			case "s": return width < 0 ? replacement.toString().padEnd(-width, " ") : replacement.toString().padStart(width, " ");
			default: return replacement;
		}
	});
}
function isInsideWebWorker() {
	return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
}
function isInsideNode() {
	return getNodeProcess()?.release?.name === "node";
}
function getNanosecondTimeViaPerformance() {
	return BigInt(Math.floor(performance.now() * 1e6));
}
function formatNanoseconds(value) {
	if (typeof value === "number") value = BigInt(value);
	if (value < nano) return `${value}ns`;
	else if (value < milli) return `${value / nano}μs`;
	else if (value < second) return `${value / milli}ms`;
	return `${value / second}s`;
}
function getNanosecondsTime() {
	if (isInsideWebWorker()) return getNanosecondTimeViaPerformance();
	if (isInsideNode()) {
		const nodeProcess = getNodeProcess();
		if (nodeProcess?.hrtime?.bigint) return nodeProcess.hrtime.bigint();
	}
	const nodeProcess = getNodeProcess();
	if (typeof nodeProcess?.hrtime?.bigint === "function") return nodeProcess.hrtime.bigint();
	if (typeof performance !== "undefined") return getNanosecondTimeViaPerformance();
	return BigInt(0);
}
function uniqueId() {
	return `${baseId}-${lastId++}`;
}
function sortTokenScorePredicate(a, b) {
	if (b[1] === a[1]) return a[0] - b[0];
	return b[1] - a[1];
}
function intersect(arrays) {
	if (arrays.length === 0) return [];
	else if (arrays.length === 1) return arrays[0];
	for (let i = 1; i < arrays.length; i++) if (arrays[i].length < arrays[0].length) {
		const tmp = arrays[0];
		arrays[0] = arrays[i];
		arrays[i] = tmp;
	}
	const set = /* @__PURE__ */ new Map();
	for (const elem of arrays[0]) set.set(elem, 1);
	for (let i = 1; i < arrays.length; i++) {
		let found = 0;
		for (const elem of arrays[i]) {
			const count = set.get(elem);
			if (count === i) {
				set.set(elem, count + 1);
				found++;
			}
		}
		if (found === 0) return [];
	}
	return arrays[0].filter((e) => {
		const count = set.get(e);
		if (count !== void 0) set.set(e, 0);
		return count === arrays.length;
	});
}
function getDocumentProperties(doc, paths) {
	const properties = {};
	const pathsLength = paths.length;
	for (let i = 0; i < pathsLength; i++) {
		const path = paths[i];
		const pathTokens = path.split(".");
		let current = doc;
		const pathTokensLength = pathTokens.length;
		for (let j = 0; j < pathTokensLength; j++) {
			current = current[pathTokens[j]];
			if (typeof current === "object") {
				if (current !== null && "lat" in current && "lon" in current && typeof current.lat === "number" && typeof current.lon === "number") {
					current = properties[path] = current;
					break;
				} else if (!Array.isArray(current) && current !== null && j === pathTokensLength - 1) {
					current = void 0;
					break;
				}
			} else if ((current === null || typeof current !== "object") && j < pathTokensLength - 1) {
				current = void 0;
				break;
			}
		}
		if (typeof current !== "undefined") properties[path] = current;
	}
	return properties;
}
function getNested(obj, path) {
	return getDocumentProperties(obj, [path])[path];
}
var mapDistanceToMeters = {
	cm: .01,
	m: 1,
	km: 1e3,
	ft: .3048,
	yd: .9144,
	mi: 1609.344
};
function convertDistanceToMeters(distance, unit) {
	const ratio = mapDistanceToMeters[unit];
	if (ratio === void 0) throw new Error(createError("INVALID_DISTANCE_SUFFIX", distance).message);
	return distance * ratio;
}
function removeVectorsFromHits(searchResult, vectorProperties) {
	for (const result of searchResult.hits) {
		const document = result.document;
		for (const prop of vectorProperties) {
			const path = prop.split(".");
			const lastKey = path.pop();
			let obj = document;
			for (const key of path) {
				if (obj == null) break;
				obj[key] = obj[key] ?? {};
				obj = obj[key];
			}
			if (obj != null) obj[lastKey] = null;
		}
	}
}
/**
* Checks if the provided input is an async function or if the input is an array
* containing at least one async function.
*
* @param func - A single function or an array of functions to check.
*               Non-function values are ignored.
* @returns `true` if the input is an async function or an array containing at least
*          one async function, otherwise `false`.
*/
function isAsyncFunction(func) {
	if (Array.isArray(func)) return func.some((item) => isAsyncFunction(item));
	return func?.constructor?.name === "AsyncFunction";
}
var withIntersection = "intersection" in /* @__PURE__ */ new Set();
function setIntersection(...sets) {
	if (sets.length === 0) return /* @__PURE__ */ new Set();
	if (sets.length === 1) return sets[0];
	if (sets.length === 2) {
		const set1 = sets[0];
		const set2 = sets[1];
		if (withIntersection) return set1.intersection(set2);
		const result = /* @__PURE__ */ new Set();
		const base = set1.size < set2.size ? set1 : set2;
		const other = base === set1 ? set2 : set1;
		for (const value of base) if (other.has(value)) result.add(value);
		return result;
	}
	const min = {
		index: 0,
		size: sets[0].size
	};
	for (let i = 1; i < sets.length; i++) if (sets[i].size < min.size) {
		min.index = i;
		min.size = sets[i].size;
	}
	if (withIntersection) {
		let base = sets[min.index];
		for (let i = 0; i < sets.length; i++) {
			if (i === min.index) continue;
			base = base.intersection(sets[i]);
		}
		return base;
	}
	const base = sets[min.index];
	for (let i = 0; i < sets.length; i++) {
		if (i === min.index) continue;
		const other = sets[i];
		for (const value of base) if (!other.has(value)) base.delete(value);
	}
	return base;
}
var withUnion = "union" in /* @__PURE__ */ new Set();
function setUnion(set1, set2) {
	if (withUnion) {
		if (set1) return set1.union(set2);
		return set2;
	}
	if (!set1) return new Set(set2);
	return /* @__PURE__ */ new Set([...set1, ...set2]);
}
function setDifference(set1, set2) {
	const result = /* @__PURE__ */ new Set();
	for (const value of set1) if (!set2.has(value)) result.add(value);
	return result;
}
var pendingYields = [];
var yieldChannel;
function drainPendingYields() {
	pendingYields.shift()?.();
}
function yieldToEventLoop() {
	const scheduler = globalThis.scheduler;
	if (typeof scheduler?.yield === "function") return scheduler.yield();
	const setImmediateFn = globalThis.setImmediate;
	if (typeof setImmediateFn === "function") return new Promise((resolve) => {
		setImmediateFn(resolve);
	});
	if (typeof MessageChannel !== "undefined") {
		if (!yieldChannel) {
			yieldChannel = new MessageChannel();
			yieldChannel.port1.onmessage = drainPendingYields;
		}
		return new Promise((resolve) => {
			pendingYields.push(resolve);
			yieldChannel.port2.postMessage(null);
		});
	}
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}
function uniqueTokens(tokens) {
	return tokens.length > 1 ? Array.from(new Set(tokens)) : tokens;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/errors.js
var errors = {
	NO_LANGUAGE_WITH_CUSTOM_TOKENIZER: "Do not pass the language option to create when using a custom tokenizer.",
	LANGUAGE_NOT_SUPPORTED: `Language "%s" is not supported.\nSupported languages are:\n - ${[...SUPPORTED_LANGUAGES, MULTILINGUAL_LANGUAGE].join("\n - ")}`,
	INVALID_STEMMER_FUNCTION_TYPE: `config.stemmer property must be a function.`,
	MISSING_STEMMER: `As of version 1.0.0 zbsearch does not ship non English stemmers by default. To solve this, please explicitly import and specify the "%s" stemmer from the package @zbsearch/stemmers. See https://docs.zbsearch.com/docs/zbsearch-js/text-analysis/stemming for more information.`,
	CUSTOM_STOP_WORDS_MUST_BE_FUNCTION_OR_ARRAY: "Custom stop words array must only contain strings.",
	INVALID_NORMALIZATION_CACHE_SIZE: "config.normalizationCacheSize must be a non-negative integer, received %s.",
	UNSUPPORTED_COMPONENT: `Unsupported component "%s".`,
	COMPONENT_MUST_BE_FUNCTION: `The component "%s" must be a function.`,
	COMPONENT_MUST_BE_FUNCTION_OR_ARRAY_FUNCTIONS: `The component "%s" must be a function or an array of functions.`,
	INVALID_SCHEMA_TYPE: `Unsupported schema type "%s" at "%s". Expected "string", "boolean" or "number" or array of them.`,
	DOCUMENT_ID_MUST_BE_STRING: `Document id must be of type "string". Got "%s" instead.`,
	DOCUMENT_ALREADY_EXISTS: `A document with id "%s" already exists.`,
	DOCUMENT_DOES_NOT_EXIST: `A document with id "%s" does not exists.`,
	MISSING_DOCUMENT_PROPERTY: `Missing searchable property "%s".`,
	INVALID_DOCUMENT_PROPERTY: `Invalid document property "%s": expected "%s", got "%s"`,
	UNKNOWN_INDEX: `Invalid property name "%s". Expected a wildcard string ("*") or array containing one of the following properties: %s`,
	INVALID_BOOST_VALUE: `Boost value must be a number greater than, or less than 0.`,
	INVALID_FILTER_OPERATION: `You can only use one operation per filter, you requested %d.`,
	SCHEMA_VALIDATION_FAILURE: `Cannot insert document due schema validation failure on "%s" property.`,
	INVALID_BATCH_SIZE: `Batch size must be an integer greater than 0. Got "%s" instead.`,
	INVALID_SORT_SCHEMA_TYPE: `Unsupported sort schema type "%s" at "%s". Expected "string" or "number".`,
	CANNOT_SORT_BY_ARRAY: `Cannot configure sort for "%s" because it is an array (%s).`,
	UNABLE_TO_SORT_ON_UNKNOWN_FIELD: `Unable to sort on unknown field "%s". Allowed fields: %s`,
	SORT_DISABLED: `Sort is disabled. Please read the documentation at https://docs.zbsearch.com/docs/zbsearch-js for more information.`,
	UNKNOWN_GROUP_BY_PROPERTY: `Unknown groupBy property "%s".`,
	INVALID_GROUP_BY_PROPERTY: `Invalid groupBy property "%s". Allowed types: "%s", but given "%s".`,
	UNKNOWN_FILTER_PROPERTY: `Unknown filter property "%s".`,
	UNKNOWN_VECTOR_PROPERTY: `Unknown vector property "%s". Make sure the property exists in the schema and is configured as a vector.`,
	INVALID_VECTOR_SIZE: `Vector size must be a number greater than 0. Got "%s" instead.`,
	INVALID_VECTOR_VALUE: `Vector value must be a number greater than 0. Got "%s" instead.`,
	INVALID_INPUT_VECTOR: `Property "%s" was declared as a %s-dimensional vector, but got a %s-dimensional vector instead.\nInput vectors must be of the size declared in the schema, as calculating similarity between vectors of different sizes can lead to unexpected results.`,
	WRONG_SEARCH_PROPERTY_TYPE: `Property "%s" is not searchable. Only "string" properties are searchable.`,
	FACET_NOT_SUPPORTED: `Facet doens't support the type "%s".`,
	INVALID_DISTANCE_SUFFIX: `Invalid distance suffix "%s". Valid suffixes are: cm, m, km, mi, yd, ft.`,
	INVALID_SEARCH_MODE: `Invalid search mode "%s". Valid modes are: "fulltext", "vector", "hybrid".`,
	MISSING_VECTOR_AND_SECURE_PROXY: `No vector was provided and no secure proxy was configured. Please provide a vector or configure an ZBSearch Secure Proxy to perform hybrid search.`,
	MISSING_TERM: `"term" is a required parameter when performing hybrid search. Please provide a search term.`,
	INVALID_VECTOR_INPUT: `Invalid "vector" property. Expected an object with "value" and "property" properties, but got "%s" instead.`,
	PLUGIN_CRASHED: `A plugin crashed during initialization. Please check the error message for more information:`,
	PLUGIN_SECURE_PROXY_NOT_FOUND: `Could not find '@zbsearch/secure-proxy-plugin' installed in your ZBSearch instance.\nPlease install it before proceeding with creating an answer session.\nRead more at https://docs.zbsearch.com/docs/zbsearch-js/plugins/plugin-secure-proxy#plugin-secure-proxy\n`,
	PLUGIN_SECURE_PROXY_MISSING_CHAT_MODEL: `Could not find a chat model defined in the secure proxy plugin configuration.\nPlease provide a chat model before proceeding with creating an answer session.\nRead more at https://docs.zbsearch.com/docs/zbsearch-js/plugins/plugin-secure-proxy#plugin-secure-proxy\n`,
	ANSWER_SESSION_LAST_MESSAGE_IS_NOT_ASSISTANT: `The last message in the session is not an assistant message. Cannot regenerate non-assistant messages.`,
	PLUGIN_COMPONENT_CONFLICT: `The component "%s" is already defined. The plugin "%s" is trying to redefine it.`,
	IVF_INDEX_REQUIRES_FACTORY: `Vector index "%s" was serialized as IVF. Import ivf from "zbsearch/trees/vector-ivf" and pass indexes.%s at create().`,
	RESERVED_SCHEMA_PROPERTY: `"%s" is a reserved property name and cannot be used in the schema.`,
	SUGGEST_NOT_SUPPORTED: `The configured index component does not support "suggest", as it cannot expand a query token into the indexed words it matches.`
};
function createError(code, ...args) {
	const error = new Error(sprintf(errors[code] ?? `Unsupported ZBSearch Error code: ${code}`, ...args));
	error.code = code;
	const errorCtor = Error;
	if (typeof errorCtor.captureStackTrace === "function") errorCtor.captureStackTrace(error);
	return error;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/defaults.js
function formatElapsedTime(n) {
	return {
		raw: Number(n),
		formatted: formatNanoseconds(n)
	};
}
function getDocumentIndexId(doc) {
	if (doc.id) {
		if (typeof doc.id !== "string") throw createError("DOCUMENT_ID_MUST_BE_STRING", typeof doc.id);
		return doc.id;
	}
	return uniqueId();
}
function assertSchemaHasNoReservedKeys(schema, prefix = "") {
	for (const [prop, type] of Object.entries(schema)) {
		if (prop === "__vector") throw createError("RESERVED_SCHEMA_PROPERTY", `${prefix}${prop}`);
		if (typeof type === "object" && type !== null && !Array.isArray(type)) assertSchemaHasNoReservedKeys(type, `${prefix}${prop}.`);
	}
}
function validateSchema(doc, schema) {
	for (const [prop, type] of Object.entries(schema)) {
		const value = doc[prop];
		if (typeof value === "undefined") continue;
		if (type === "geopoint" && typeof value === "object" && typeof value.lon === "number" && typeof value.lat === "number") continue;
		if (type === "enum" && (typeof value === "string" || typeof value === "number")) continue;
		if (type === "enum[]" && Array.isArray(value)) {
			const valueLength = value.length;
			for (let i = 0; i < valueLength; i++) if (typeof value[i] !== "string" && typeof value[i] !== "number") return prop + "." + i;
			continue;
		}
		if (isVectorType(type)) {
			const vectorSize = getVectorSize(type);
			if (!Array.isArray(value) || value.length !== vectorSize) throw createError("INVALID_INPUT_VECTOR", prop, vectorSize, value.length);
			continue;
		}
		if (isArrayType(type)) {
			if (!Array.isArray(value)) return prop;
			const expectedType = getInnerType(type);
			const valueLength = value.length;
			for (let i = 0; i < valueLength; i++) if (typeof value[i] !== expectedType) return prop + "." + i;
			continue;
		}
		if (typeof type === "object") {
			if (!value || typeof value !== "object") return prop;
			const subProp = validateSchema(value, type);
			if (subProp) return prop + "." + subProp;
			continue;
		}
		if (typeof value !== type) return prop;
	}
}
var IS_ARRAY_TYPE = {
	string: false,
	number: false,
	boolean: false,
	enum: false,
	geopoint: false,
	"string[]": true,
	"number[]": true,
	"boolean[]": true,
	"enum[]": true
};
var INNER_TYPE = {
	"string[]": "string",
	"number[]": "number",
	"boolean[]": "boolean",
	"enum[]": "enum"
};
function isVectorType(type) {
	return typeof type === "string" && /^vector\[\d+\]$/.test(type);
}
function isArrayType(type) {
	return typeof type === "string" && IS_ARRAY_TYPE[type];
}
function getInnerType(type) {
	return INNER_TYPE[type];
}
function getVectorSize(type) {
	const size = Number(type.slice(7, -1));
	switch (true) {
		case isNaN(size): throw createError("INVALID_VECTOR_VALUE", type);
		case size <= 0: throw createError("INVALID_VECTOR_SIZE", type);
		default: return size;
	}
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/internal-document-id-store.js
function createInternalDocumentIDStore() {
	return {
		idToInternalId: /* @__PURE__ */ new Map(),
		internalIdToId: [],
		save: save$4,
		load: load$5
	};
}
function save$4(store) {
	return { internalIdToId: store.internalIdToId };
}
function load$5(zbsearch, raw) {
	const { internalIdToId } = raw;
	zbsearch.internalDocumentIDStore.idToInternalId.clear();
	zbsearch.internalDocumentIDStore.internalIdToId = [];
	const internalIdToIdLength = internalIdToId.length;
	for (let i = 0; i < internalIdToIdLength; i++) {
		const internalIdItem = internalIdToId[i];
		zbsearch.internalDocumentIDStore.idToInternalId.set(internalIdItem, i + 1);
		zbsearch.internalDocumentIDStore.internalIdToId.push(internalIdItem);
	}
}
function getInternalDocumentId(store, id) {
	if (typeof id === "string") {
		const internalId = store.idToInternalId.get(id);
		if (internalId) return internalId;
		const currentId = store.idToInternalId.size + 1;
		store.idToInternalId.set(id, currentId);
		store.internalIdToId.push(id);
		return currentId;
	}
	if (id > store.internalIdToId.length) return getInternalDocumentId(store, id.toString());
	return id;
}
function getDocumentIdFromInternalId(store, internalId) {
	if (store.internalIdToId.length < internalId) throw new Error(`Invalid internalId ${internalId}`);
	return store.internalIdToId[internalId - 1];
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/documents-store.js
function create$4(_, sharedInternalDocumentStore) {
	return {
		sharedInternalDocumentStore,
		docs: {},
		count: 0
	};
}
function get(store, id) {
	const internalId = getInternalDocumentId(store.sharedInternalDocumentStore, id);
	return store.docs[internalId];
}
function getMultiple(store, ids) {
	const idsLength = ids.length;
	const found = Array.from({ length: idsLength });
	for (let i = 0; i < idsLength; i++) {
		const internalId = getInternalDocumentId(store.sharedInternalDocumentStore, ids[i]);
		found[i] = store.docs[internalId];
	}
	return found;
}
function getAll(store) {
	return store.docs;
}
function store(store, id, internalId, doc) {
	if (typeof store.docs[internalId] !== "undefined") return false;
	store.docs[internalId] = doc;
	store.count++;
	return true;
}
function remove$2(store, id) {
	const internalId = getInternalDocumentId(store.sharedInternalDocumentStore, id);
	if (typeof store.docs[internalId] === "undefined") return false;
	delete store.docs[internalId];
	store.count--;
	return true;
}
function count$1(store) {
	return store.count;
}
function load$4(sharedInternalDocumentStore, raw) {
	const rawDocument = raw;
	return {
		docs: rawDocument.docs,
		count: rawDocument.count,
		sharedInternalDocumentStore
	};
}
function save$3(store) {
	return {
		docs: store.docs,
		count: store.count
	};
}
function createDocumentsStore() {
	return {
		create: create$4,
		get,
		getMultiple,
		getAll,
		store,
		remove: remove$2,
		count: count$1,
		load: load$4,
		save: save$3
	};
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/hooks.js
var OBJECT_COMPONENTS = [
	"tokenizer",
	"index",
	"documentsStore",
	"sorter",
	"pinning"
];
var FUNCTION_COMPONENTS = [
	"validateSchema",
	"getDocumentIndexId",
	"getDocumentProperties",
	"formatElapsedTime"
];
function runAfterSearch(hooks, db, params, language, results) {
	if (hooks.some(isAsyncFunction)) return (async () => {
		for (const hook of hooks) await hook(db, params, language, results);
	})();
	else for (const hook of hooks) hook(db, params, language, results);
}
function runBeforeSearch(hooks, db, params, language) {
	if (hooks.some(isAsyncFunction)) return (async () => {
		for (const hook of hooks) await hook(db, params, language);
	})();
	else for (const hook of hooks) hook(db, params, language);
}
function runAfterCreate(hooks, db) {
	if (hooks.some(isAsyncFunction)) return (async () => {
		for (const hook of hooks) await hook(db);
	})();
	else for (const hook of hooks) hook(db);
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/avl.js
var AVLNode = class AVLNode {
	k;
	v;
	l = null;
	r = null;
	h = 1;
	constructor(key, value) {
		this.k = key;
		this.v = new Set(value);
	}
	updateHeight() {
		const leftHeight = this.l ? this.l.h : 0;
		const rightHeight = this.r ? this.r.h : 0;
		this.h = leftHeight >= rightHeight ? leftHeight + 1 : rightHeight + 1;
	}
	static getHeight(node) {
		return node ? node.h : 0;
	}
	getBalanceFactor() {
		return (this.l ? this.l.h : 0) - (this.r ? this.r.h : 0);
	}
	rotateLeft() {
		const newRoot = this.r;
		this.r = newRoot.l;
		newRoot.l = this;
		this.updateHeight();
		newRoot.updateHeight();
		return newRoot;
	}
	rotateRight() {
		const newRoot = this.l;
		this.l = newRoot.r;
		newRoot.r = this;
		this.updateHeight();
		newRoot.updateHeight();
		return newRoot;
	}
	toJSON() {
		return {
			k: this.k,
			v: Array.from(this.v),
			l: this.l ? this.l.toJSON() : null,
			r: this.r ? this.r.toJSON() : null,
			h: this.h
		};
	}
	static fromJSON(json) {
		const node = new AVLNode(json.k, json.v);
		node.l = json.l ? AVLNode.fromJSON(json.l) : null;
		node.r = json.r ? AVLNode.fromJSON(json.r) : null;
		node.h = json.h;
		return node;
	}
};
var AVLTree = class AVLTree {
	root = null;
	insertCount = 0;
	constructor(key, value) {
		if (key !== void 0 && value !== void 0) this.root = new AVLNode(key, value);
	}
	insert(key, value, rebalanceThreshold = 1e3) {
		this.root = this.insertNode(this.root, key, value, rebalanceThreshold);
	}
	insertMultiple(key, value, rebalanceThreshold = 1e3) {
		for (let i = 0; i < value.length; i++) this.insert(key, value[i], rebalanceThreshold);
	}
	rebalance() {
		if (this.root) this.root = this.rebalanceNode(this.root);
	}
	toJSON() {
		return {
			root: this.root ? this.root.toJSON() : null,
			insertCount: this.insertCount
		};
	}
	static fromJSON(json) {
		const tree = new AVLTree();
		tree.root = json.root ? AVLNode.fromJSON(json.root) : null;
		tree.insertCount = json.insertCount || 0;
		return tree;
	}
	insertNode(node, key, value, rebalanceThreshold) {
		if (node === null) return new AVLNode(key, [value]);
		const willRebalance = rebalanceThreshold === 1 || (this.insertCount + 1) % rebalanceThreshold === 0;
		const pathNodes = [];
		const pathParents = willRebalance ? [] : [];
		let current = node;
		let parent = null;
		while (current !== null) {
			pathNodes.push(current);
			if (willRebalance) pathParents.push(parent);
			const currentKey = current.k;
			if (key < currentKey) {
				const left = current.l;
				if (left === null) {
					const newNode = new AVLNode(key, [value]);
					current.l = newNode;
					pathNodes.push(newNode);
					if (willRebalance) pathParents.push(current);
					break;
				}
				parent = current;
				current = left;
			} else if (key > currentKey) {
				const right = current.r;
				if (right === null) {
					const newNode = new AVLNode(key, [value]);
					current.r = newNode;
					pathNodes.push(newNode);
					if (willRebalance) pathParents.push(current);
					break;
				}
				parent = current;
				current = right;
			} else {
				current.v.add(value);
				return node;
			}
		}
		this.insertCount++;
		if (willRebalance) for (let i = pathNodes.length - 1; i >= 0; i--) {
			const currentNode = pathNodes[i];
			const nodeParent = pathParents[i];
			currentNode.updateHeight();
			const balanceFactor = currentNode.getBalanceFactor();
			if (balanceFactor > 1 || balanceFactor < -1) {
				const rebalancedNode = this.rebalanceNode(currentNode);
				if (nodeParent) {
					if (nodeParent.l === currentNode) nodeParent.l = rebalancedNode;
					else nodeParent.r = rebalancedNode;
				} else node = rebalancedNode;
			}
		}
		else for (let i = pathNodes.length - 1; i >= 0; i--) pathNodes[i].updateHeight();
		return node;
	}
	rebalanceNode(node) {
		const balanceFactor = node.getBalanceFactor();
		if (balanceFactor > 1) {
			const left = node.l;
			if (left && left.getBalanceFactor() >= 0) return node.rotateRight();
			if (left) {
				node.l = left.rotateLeft();
				return node.rotateRight();
			}
		}
		if (balanceFactor < -1) {
			const right = node.r;
			if (right && right.getBalanceFactor() <= 0) return node.rotateLeft();
			if (right) {
				node.r = right.rotateRight();
				return node.rotateLeft();
			}
		}
		return node;
	}
	find(key) {
		const node = this.findNodeByKey(key);
		return node ? node.v : null;
	}
	contains(key) {
		let node = this.root;
		while (node !== null) {
			const nodeKey = node.k;
			if (key < nodeKey) node = node.l;
			else if (key > nodeKey) node = node.r;
			else return true;
		}
		return false;
	}
	getSize() {
		let count = 0;
		const stack = [];
		let current = this.root;
		while (current || stack.length > 0) {
			while (current) {
				stack.push(current);
				current = current.l;
			}
			current = stack.pop();
			count++;
			current = current.r;
		}
		return count;
	}
	isBalanced() {
		if (!this.root) return true;
		const stack = [this.root];
		while (stack.length > 0) {
			const node = stack.pop();
			const balanceFactor = node.getBalanceFactor();
			if (balanceFactor > 1 || balanceFactor < -1) return false;
			if (node.l) stack.push(node.l);
			if (node.r) stack.push(node.r);
		}
		return true;
	}
	remove(key) {
		this.root = this.removeNode(this.root, key);
	}
	removeDocument(key, id) {
		const node = this.findNodeByKey(key);
		if (!node) return;
		if (node.v.size === 1) this.root = this.removeNode(this.root, key);
		else node.v.delete(id);
	}
	findNodeByKey(key) {
		let node = this.root;
		while (node !== null) {
			const nodeKey = node.k;
			if (key < nodeKey) node = node.l;
			else if (key > nodeKey) node = node.r;
			else return node;
		}
		return null;
	}
	removeNode(node, key) {
		if (node === null) return null;
		const path = [];
		let current = node;
		while (current !== null && current.k !== key) {
			path.push(current);
			if (key < current.k) current = current.l;
			else current = current.r;
		}
		if (current === null) return node;
		if (current.l === null || current.r === null) {
			const child = current.l ?? current.r;
			if (path.length === 0) node = child;
			else {
				const parent = path[path.length - 1];
				if (parent.l === current) parent.l = child;
				else parent.r = child;
			}
		} else {
			let successorParent = current;
			let successor = current.r;
			while (successor.l !== null) {
				successorParent = successor;
				successor = successor.l;
			}
			current.k = successor.k;
			current.v = successor.v;
			if (successorParent.l === successor) successorParent.l = successor.r;
			else successorParent.r = successor.r;
			current = successorParent;
		}
		path.push(current);
		for (let i = path.length - 1; i >= 0; i--) {
			const currentNode = path[i];
			currentNode.updateHeight();
			const balanceFactor = currentNode.getBalanceFactor();
			if (balanceFactor > 1 || balanceFactor < -1) {
				const rebalancedNode = this.rebalanceNode(currentNode);
				if (i > 0) {
					const parent = path[i - 1];
					if (parent.l === currentNode) parent.l = rebalancedNode;
					else parent.r = rebalancedNode;
				} else node = rebalancedNode;
			}
		}
		return node;
	}
	rangeSearch(min, max) {
		const result = /* @__PURE__ */ new Set();
		const stack = [];
		let current = this.root;
		while (current || stack.length > 0) {
			while (current) if (current.k < min) current = current.r;
			else {
				stack.push(current);
				current = current.l;
			}
			current = stack.pop();
			if (current.k > max) break;
			for (const value of current.v) result.add(value);
			current = current.r;
		}
		return result;
	}
	greaterThan(key, inclusive = false) {
		const result = /* @__PURE__ */ new Set();
		const stack = [];
		let current = this.root;
		while (current || stack.length > 0) {
			while (current) if (inclusive ? current.k < key : current.k <= key) current = current.r;
			else {
				stack.push(current);
				current = current.r;
			}
			if (stack.length === 0) break;
			current = stack.pop();
			if (inclusive && current.k >= key || !inclusive && current.k > key) {
				for (const value of current.v) result.add(value);
				current = current.l;
			} else break;
		}
		return result;
	}
	lessThan(key, inclusive = false) {
		const result = /* @__PURE__ */ new Set();
		const stack = [];
		let current = this.root;
		while (current || stack.length > 0) {
			while (current) if (inclusive ? current.k > key : current.k >= key) current = current.l;
			else {
				stack.push(current);
				current = current.l;
			}
			if (stack.length === 0) break;
			current = stack.pop();
			if (inclusive && current.k <= key || !inclusive && current.k < key) {
				for (const value of current.v) result.add(value);
				current = current.r;
			} else break;
		}
		return result;
	}
};
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/bkd.js
var EARTH_RADIUS = 6371e3;
var BKDNode = class BKDNode {
	point;
	docIDs;
	left;
	right;
	parent;
	constructor(point, docIDs) {
		this.point = point;
		this.docIDs = new Set(docIDs);
		this.left = null;
		this.right = null;
		this.parent = null;
	}
	toJSON() {
		return {
			point: this.point,
			docIDs: Array.from(this.docIDs),
			left: this.left ? this.left.toJSON() : null,
			right: this.right ? this.right.toJSON() : null
		};
	}
	static fromJSON(json, parent = null) {
		const node = new BKDNode(json.point, json.docIDs);
		node.parent = parent;
		if (json.left) node.left = BKDNode.fromJSON(json.left, node);
		if (json.right) node.right = BKDNode.fromJSON(json.right, node);
		return node;
	}
};
var BKDTree = class BKDTree {
	root;
	nodeMap;
	constructor() {
		this.root = null;
		this.nodeMap = /* @__PURE__ */ new Map();
	}
	getPointKey(point) {
		return point.lon + "," + point.lat;
	}
	insert(point, docIDs) {
		const lon = point.lon;
		const lat = point.lat;
		const pointKey = lon + "," + lat;
		const existingNode = this.nodeMap.get(pointKey);
		if (existingNode) {
			for (let i = 0; i < docIDs.length; i++) existingNode.docIDs.add(docIDs[i]);
			return;
		}
		const newNode = new BKDNode(point, docIDs);
		this.nodeMap.set(pointKey, newNode);
		const root = this.root;
		if (root == null) {
			this.root = newNode;
			return;
		}
		let node = root;
		let depth = 0;
		while (true) {
			const axis = depth & 1;
			const nodePoint = node.point;
			if ((axis ? lat : lon) < (axis ? nodePoint.lat : nodePoint.lon)) {
				const left = node.left;
				if (left == null) {
					node.left = newNode;
					newNode.parent = node;
					return;
				}
				node = left;
			} else {
				const right = node.right;
				if (right == null) {
					node.right = newNode;
					newNode.parent = node;
					return;
				}
				node = right;
			}
			depth++;
		}
	}
	contains(point) {
		return this.nodeMap.has(point.lon + "," + point.lat);
	}
	getDocIDsByCoordinates(point) {
		const pointKey = this.getPointKey(point);
		const node = this.nodeMap.get(pointKey);
		if (node) return Array.from(node.docIDs);
		return null;
	}
	removeDocByID(point, docID) {
		const pointKey = this.getPointKey(point);
		const node = this.nodeMap.get(pointKey);
		if (node) {
			node.docIDs.delete(docID);
			if (node.docIDs.size === 0) {
				this.nodeMap.delete(pointKey);
				this.deleteNode(node);
			}
		}
	}
	deleteNode(node) {
		const parent = node.parent;
		const child = node.left ? node.left : node.right;
		if (child) child.parent = parent;
		if (parent) {
			if (parent.left === node) parent.left = child;
			else if (parent.right === node) parent.right = child;
		} else {
			this.root = child;
			if (this.root) this.root.parent = null;
		}
	}
	searchByRadius(center, radius, inclusive = true, sort = "asc", highPrecision = false) {
		const root = this.root;
		if (root == null) return [];
		const distanceFn = highPrecision ? BKDTree.vincentyDistance : BKDTree.haversineDistance;
		const axisDistanceFn = highPrecision ? BKDTree.vincentyAxisDistance : BKDTree.haversineAxisDistance;
		const result = [];
		const sortedEntries = [];
		const isAsc = sort == null || sort.toLowerCase() === "asc";
		if (inclusive) {
			const stack = [root];
			const depths = [0];
			while (stack.length > 0) {
				const node = stack.pop();
				const depth = depths.pop();
				const dist = distanceFn(center, node.point);
				if (dist <= radius) {
					const entry = {
						point: node.point,
						docIDs: Array.from(node.docIDs)
					};
					if (sort) sortedEntries.push([dist, entry]);
					else result.push(entry);
				}
				const axis = depth & 1;
				const searchLeft = (axis === 0 ? center.lon : center.lat) < (axis === 0 ? node.point.lon : node.point.lat);
				const near = searchLeft ? node.left : node.right;
				const far = searchLeft ? node.right : node.left;
				if (near != null) {
					stack.push(near);
					depths.push(depth + 1);
				}
				if (far != null && axisDistanceFn(center, node.point, axis) <= radius) {
					stack.push(far);
					depths.push(depth + 1);
				}
			}
		} else {
			const stack = [root];
			while (stack.length > 0) {
				const node = stack.pop();
				const dist = distanceFn(center, node.point);
				if (dist > radius) {
					const entry = {
						point: node.point,
						docIDs: Array.from(node.docIDs)
					};
					if (sort) sortedEntries.push([dist, entry]);
					else result.push(entry);
				}
				if (node.left != null) stack.push(node.left);
				if (node.right != null) stack.push(node.right);
			}
		}
		if (sort && sortedEntries.length > 0) {
			sortedEntries.sort((a, b) => isAsc ? a[0] - b[0] : b[0] - a[0]);
			return sortedEntries.map(([, entry]) => entry);
		}
		return result;
	}
	searchByPolygon(polygon, inclusive = true, sort = null, highPrecision = false) {
		const root = this.root;
		if (root == null) return [];
		const bounds = BKDTree.getPolygonBounds(polygon);
		const result = [];
		const sortedEntries = [];
		const isAsc = sort == null || sort.toLowerCase() === "asc";
		const centroid = sort ? BKDTree.calculatePolygonCentroid(polygon) : null;
		const distanceFn = sort != null ? highPrecision ? BKDTree.vincentyDistance : BKDTree.haversineDistance : null;
		if (inclusive) {
			const stack = [root];
			const depths = [0];
			while (stack.length > 0) {
				const node = stack.pop();
				const depth = depths.pop();
				const axis = depth & 1;
				if (axis === 0 ? bounds.minLon < node.point.lon : bounds.minLat < node.point.lat) {
					const left = node.left;
					if (left != null) {
						stack.push(left);
						depths.push(depth + 1);
					}
				}
				if (axis === 0 ? bounds.maxLon >= node.point.lon : bounds.maxLat >= node.point.lat) {
					const right = node.right;
					if (right != null) {
						stack.push(right);
						depths.push(depth + 1);
					}
				}
				const point = node.point;
				if (point.lon >= bounds.minLon && point.lon <= bounds.maxLon && point.lat >= bounds.minLat && point.lat <= bounds.maxLat && BKDTree.isPointInPolygon(polygon, point)) {
					const entry = {
						point,
						docIDs: Array.from(node.docIDs)
					};
					if (sort && distanceFn && centroid) sortedEntries.push([distanceFn(centroid, point), entry]);
					else result.push(entry);
				}
			}
		} else {
			const stack = [{
				node: root,
				depth: 0
			}];
			while (stack.length > 0) {
				const { node, depth } = stack.pop();
				if (node == null) continue;
				if (node.left != null) stack.push({
					node: node.left,
					depth: depth + 1
				});
				if (node.right != null) stack.push({
					node: node.right,
					depth: depth + 1
				});
				const point = node.point;
				if (!(point.lon >= bounds.minLon && point.lon <= bounds.maxLon && point.lat >= bounds.minLat && point.lat <= bounds.maxLat && BKDTree.isPointInPolygon(polygon, point))) {
					const entry = {
						point,
						docIDs: Array.from(node.docIDs)
					};
					if (sort && distanceFn && centroid) sortedEntries.push([distanceFn(centroid, point), entry]);
					else result.push(entry);
				}
			}
		}
		if (sort && sortedEntries.length > 0) {
			sortedEntries.sort((a, b) => isAsc ? a[0] - b[0] : b[0] - a[0]);
			return sortedEntries.map(([, entry]) => entry);
		}
		return result;
	}
	toJSON() {
		return { root: this.root ? this.root.toJSON() : null };
	}
	static fromJSON(json) {
		const tree = new BKDTree();
		if (json.root) {
			tree.root = BKDNode.fromJSON(json.root);
			tree.buildNodeMap(tree.root);
		}
		return tree;
	}
	buildNodeMap(node) {
		if (node == null) return;
		const pointKey = this.getPointKey(node.point);
		this.nodeMap.set(pointKey, node);
		if (node.left) this.buildNodeMap(node.left);
		if (node.right) this.buildNodeMap(node.right);
	}
	static getPolygonBounds(polygon) {
		let minLon = polygon[0].lon;
		let maxLon = polygon[0].lon;
		let minLat = polygon[0].lat;
		let maxLat = polygon[0].lat;
		for (let i = 1; i < polygon.length; i++) {
			const p = polygon[i];
			if (p.lon < minLon) minLon = p.lon;
			if (p.lon > maxLon) maxLon = p.lon;
			if (p.lat < minLat) minLat = p.lat;
			if (p.lat > maxLat) maxLat = p.lat;
		}
		return {
			minLon,
			maxLon,
			minLat,
			maxLat
		};
	}
	static calculatePolygonCentroid(polygon) {
		let totalArea = 0;
		let centroidX = 0;
		let centroidY = 0;
		const polygonLength = polygon.length;
		for (let i = 0, j = polygonLength - 1; i < polygonLength; j = i++) {
			const xi = polygon[i].lon;
			const yi = polygon[i].lat;
			const xj = polygon[j].lon;
			const yj = polygon[j].lat;
			const areaSegment = xi * yj - xj * yi;
			totalArea += areaSegment;
			centroidX += (xi + xj) * areaSegment;
			centroidY += (yi + yj) * areaSegment;
		}
		totalArea /= 2;
		const centroidCoordinate = 6 * totalArea;
		centroidX /= centroidCoordinate;
		centroidY /= centroidCoordinate;
		return {
			lon: centroidX,
			lat: centroidY
		};
	}
	static isPointInPolygon(polygon, point) {
		let isInside = false;
		const x = point.lon;
		const y = point.lat;
		const polygonLength = polygon.length;
		for (let i = 0, j = polygonLength - 1; i < polygonLength; j = i++) {
			const xi = polygon[i].lon;
			const yi = polygon[i].lat;
			const xj = polygon[j].lon;
			const yj = polygon[j].lat;
			if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) isInside = !isInside;
		}
		return isInside;
	}
	static haversineAxisDistance(center, planePoint, axis) {
		if (axis === 0) return BKDTree.haversineDistance(center, {
			lon: planePoint.lon,
			lat: center.lat
		});
		return BKDTree.haversineDistance(center, {
			lon: center.lon,
			lat: planePoint.lat
		});
	}
	static vincentyAxisDistance(center, planePoint, axis) {
		if (axis === 0) return BKDTree.vincentyDistance(center, {
			lon: planePoint.lon,
			lat: center.lat
		});
		return BKDTree.vincentyDistance(center, {
			lon: center.lon,
			lat: planePoint.lat
		});
	}
	static haversineDistance(coord1, coord2) {
		const P = Math.PI / 180;
		const lat1 = coord1.lat * P;
		const lat2 = coord2.lat * P;
		const deltaLat = (coord2.lat - coord1.lat) * P;
		const deltaLon = (coord2.lon - coord1.lon) * P;
		const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
		return EARTH_RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
	}
	static vincentyDistance(coord1, coord2) {
		const a = 6378137;
		const f = 1 / 298.257223563;
		const b = .9966471893352525 * a;
		const P = Math.PI / 180;
		const lat1 = coord1.lat * P;
		const lat2 = coord2.lat * P;
		const deltaLon = (coord2.lon - coord1.lon) * P;
		const U1 = Math.atan(.9966471893352525 * Math.tan(lat1));
		const U2 = Math.atan(.9966471893352525 * Math.tan(lat2));
		const sinU1 = Math.sin(U1);
		const cosU1 = Math.cos(U1);
		const sinU2 = Math.sin(U2);
		const cosU2 = Math.cos(U2);
		let lambda = deltaLon;
		let prevLambda;
		let iterationLimit = 1e3;
		let sinSigma;
		let cosSigma;
		let sigma;
		let sinAlpha;
		let cos2Alpha;
		let cos2SigmaM;
		do {
			const sinLambda = Math.sin(lambda);
			const cosLambda = Math.cos(lambda);
			sinSigma = Math.sqrt(cosU2 * sinLambda * (cosU2 * sinLambda) + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
			if (sinSigma === 0) return 0;
			cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
			sigma = Math.atan2(sinSigma, cosSigma);
			sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
			cos2Alpha = 1 - sinAlpha * sinAlpha;
			cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cos2Alpha;
			if (isNaN(cos2SigmaM)) cos2SigmaM = 0;
			const C = f / 16 * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha));
			prevLambda = lambda;
			lambda = deltaLon + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
		} while (Math.abs(lambda - prevLambda) > 1e-12 && --iterationLimit > 0);
		if (iterationLimit === 0) return NaN;
		const uSquared = cos2Alpha * (a * a - b * b) / (b * b);
		const A = 1 + uSquared / 16384 * (4096 + uSquared * (-768 + uSquared * (320 - 175 * uSquared)));
		const B = uSquared / 1024 * (256 + uSquared * (-128 + uSquared * (74 - 47 * uSquared)));
		const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
		return b * A * (sigma - deltaSigma);
	}
};
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/bool.js
var BoolNode = class BoolNode {
	true;
	false;
	constructor() {
		this.true = /* @__PURE__ */ new Set();
		this.false = /* @__PURE__ */ new Set();
	}
	insert(value, bool) {
		if (bool) this.true.add(value);
		else this.false.add(value);
	}
	delete(value, bool) {
		if (bool) this.true.delete(value);
		else this.false.delete(value);
	}
	getSize() {
		return this.true.size + this.false.size;
	}
	toJSON() {
		return {
			true: Array.from(this.true),
			false: Array.from(this.false)
		};
	}
	static fromJSON(json) {
		const node = new BoolNode();
		node.true = new Set(json.true);
		node.false = new Set(json.false);
		return node;
	}
};
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/flat.js
var FlatTree = class FlatTree {
	numberToDocumentId;
	constructor() {
		this.numberToDocumentId = /* @__PURE__ */ new Map();
	}
	insert(key, value) {
		if (this.numberToDocumentId.has(key)) this.numberToDocumentId.get(key).add(value);
		else this.numberToDocumentId.set(key, /* @__PURE__ */ new Set([value]));
	}
	find(key) {
		const idSet = this.numberToDocumentId.get(key);
		return idSet ? Array.from(idSet) : null;
	}
	remove(key) {
		this.numberToDocumentId.delete(key);
	}
	removeDocument(id, key) {
		const idSet = this.numberToDocumentId.get(key);
		if (idSet) {
			idSet.delete(id);
			if (idSet.size === 0) this.numberToDocumentId.delete(key);
		}
	}
	contains(key) {
		return this.numberToDocumentId.has(key);
	}
	getSize() {
		let size = 0;
		for (const idSet of this.numberToDocumentId.values()) size += idSet.size;
		return size;
	}
	filter(operation) {
		const operationKeys = Object.keys(operation);
		if (operationKeys.length !== 1) throw new Error("Invalid operation");
		const operationType = operationKeys[0];
		switch (operationType) {
			case "eq": {
				const value = operation[operationType];
				const idSet = this.numberToDocumentId.get(value);
				return idSet ? Array.from(idSet) : [];
			}
			case "in": {
				const values = operation[operationType];
				const resultSet = /* @__PURE__ */ new Set();
				for (const value of values) {
					const idSet = this.numberToDocumentId.get(value);
					if (idSet) for (const id of idSet) resultSet.add(id);
				}
				return Array.from(resultSet);
			}
			case "nin": {
				const excludeValues = new Set(operation[operationType]);
				const resultSet = /* @__PURE__ */ new Set();
				for (const [key, idSet] of this.numberToDocumentId.entries()) if (!excludeValues.has(key)) for (const id of idSet) resultSet.add(id);
				return Array.from(resultSet);
			}
			default: throw new Error("Invalid operation");
		}
	}
	filterArr(operation) {
		const operationKeys = Object.keys(operation);
		if (operationKeys.length !== 1) throw new Error("Invalid operation");
		const operationType = operationKeys[0];
		switch (operationType) {
			case "containsAll": {
				const idSets = operation[operationType].map((value) => this.numberToDocumentId.get(value) ?? /* @__PURE__ */ new Set());
				if (idSets.length === 0) return [];
				const intersection = idSets.reduce((prev, curr) => {
					return new Set([...prev].filter((id) => curr.has(id)));
				});
				return Array.from(intersection);
			}
			case "containsAny": {
				const idSets = operation[operationType].map((value) => this.numberToDocumentId.get(value) ?? /* @__PURE__ */ new Set());
				if (idSets.length === 0) return [];
				const union = idSets.reduce((prev, curr) => {
					return /* @__PURE__ */ new Set([...prev, ...curr]);
				});
				return Array.from(union);
			}
			default: throw new Error("Invalid operation");
		}
	}
	static fromJSON(json) {
		if (!json.numberToDocumentId) throw new Error("Invalid Flat Tree JSON");
		const tree = new FlatTree();
		for (const [key, ids] of json.numberToDocumentId) tree.numberToDocumentId.set(key, new Set(ids));
		return tree;
	}
	toJSON() {
		return { numberToDocumentId: Array.from(this.numberToDocumentId.entries()).map(([key, idSet]) => [key, Array.from(idSet)]) };
	}
};
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/levenshtein.js
/**
* Inspired by:
* https://github.com/Yomguithereal/talisman/blob/86ae55cbd040ff021d05e282e0e6c71f2dde21f8/src/metrics/levenshtein.js#L218-L340
*/
function _boundedLevenshtein(term, word, tolerance) {
	if (tolerance < 0) return -1;
	if (term === word) return 0;
	const m = term.length;
	const n = word.length;
	if (m === 0) return n <= tolerance ? n : -1;
	if (n === 0) return m <= tolerance ? m : -1;
	const diff = Math.abs(m - n);
	if (term.startsWith(word)) return diff <= tolerance ? diff : -1;
	if (word.startsWith(term)) return 0;
	if (diff > tolerance) return -1;
	const matrix = [];
	for (let i = 0; i <= m; i++) {
		matrix[i] = [i];
		for (let j = 1; j <= n; j++) matrix[i][j] = i === 0 ? j : 0;
	}
	for (let i = 1; i <= m; i++) {
		let rowMin = Infinity;
		for (let j = 1; j <= n; j++) {
			if (term[i - 1] === word[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
			else matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1);
			rowMin = Math.min(rowMin, matrix[i][j]);
		}
		if (rowMin > tolerance) return -1;
	}
	return matrix[m][n] <= tolerance ? matrix[m][n] : -1;
}
function syncBoundedLevenshtein(term, w, tolerance) {
	const distance = _boundedLevenshtein(term, w, tolerance);
	return {
		distance,
		isBounded: distance >= 0
	};
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/postings.js
function createPostingsMap() {
	return /* @__PURE__ */ new Map();
}
function clearPostings(postings, word) {
	postings.delete(word);
}
function getDocumentFrequency(postings, word) {
	return postings.get(word)?.length ?? 0;
}
/** Delta-encode sorted doc IDs for compact storage. */
function encodePostings(ids) {
	if (ids.length === 0) return [];
	const sorted = [...ids].sort((a, b) => a - b);
	const out = [sorted[0]];
	for (let i = 1; i < sorted.length; i++) out.push(sorted[i] - sorted[i - 1]);
	return out;
}
function decodePostings(encoded) {
	if (encoded.length === 0) return [];
	const out = [encoded[0]];
	for (let i = 1; i < encoded.length; i++) out.push(out[i - 1] + encoded[i]);
	return out;
}
function serializePostingsMap(postings) {
	const out = {};
	for (const [word, ids] of postings) if (ids.length > 0) out[word] = encodePostings(ids);
	return out;
}
function deserializePostingsMap(data) {
	const postings = createPostingsMap();
	if (!data) return postings;
	for (const word of Object.keys(data)) {
		const ids = decodePostings(data[word]);
		if (ids.length > 0) postings.set(word, ids);
	}
	return postings;
}
/** Collect doc IDs stored on legacy radix nodes (`d` arrays). */
function collectLegacyNodePostings(nodeJson, postings) {
	if (nodeJson.e && nodeJson.w !== void 0) {
		const ids = nodeJson.d ?? [];
		if (ids.length > 0) postings.set(nodeJson.w, [...ids]);
	}
	const children = nodeJson.c ?? [];
	for (let i = 0; i < children.length; i++) collectLegacyNodePostings(children[i][1], postings);
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/radix.js
var EMPTY_POSTINGS = [];
var RadixNode = class RadixNode {
	k;
	s;
	c = /* @__PURE__ */ new Map();
	e;
	w = "";
	d;
	constructor(key, subWord, end) {
		this.k = key;
		this.s = subWord;
		this.e = end;
	}
	updateParent(parent) {
		this.w = parent.w + this.s;
	}
	addDocumentToPostings(postings, docID) {
		let list = this.d;
		if (list) {
			list.push(docID);
			return;
		}
		list = postings.get(this.w);
		if (!list) {
			list = [docID];
			postings.set(this.w, list);
			this.d = list;
			return;
		}
		list.push(docID);
		this.d = list;
	}
	removeDocumentFromPostings(postings, docID) {
		const list = this.d ?? postings.get(this.w);
		if (!list) return false;
		let index = list.indexOf(docID);
		if (index === -1) return false;
		do {
			list.splice(index, 1);
			index = list.indexOf(docID, index);
		} while (index !== -1);
		if (list.length === 0) {
			postings.delete(this.w);
			this.d = void 0;
		} else this.d = list;
		return true;
	}
	getDocumentsFromPostings(postings) {
		if (this.d) return this.d;
		const list = postings.get(this.w);
		if (!list) return EMPTY_POSTINGS;
		this.d = list;
		return list;
	}
	hasDocumentsInPostings(postings) {
		if (this.d) return this.d.length > 0;
		const list = postings.get(this.w);
		return list !== void 0 && list.length > 0;
	}
	findAllWords(output, term, postings, exact, tolerance) {
		const stack = [this];
		while (stack.length > 0) {
			const node = stack.pop();
			if (node.e) {
				const { w } = node;
				if (exact && w !== term) continue;
				if (tolerance) {
					if (Math.abs(term.length - w.length) > tolerance || !syncBoundedLevenshtein(term, w, tolerance).isBounded) continue;
				}
				const docIDs = node.getDocumentsFromPostings(postings);
				if (docIDs.length > 0) output[w] = [...docIDs];
				else output[w] = [];
			}
			const children = node.c;
			if (children.size > 0) for (const child of children.values()) stack.push(child);
		}
		return output;
	}
	insertWithPostings(word, docId, postings) {
		let node = this;
		let i = 0;
		const wordLength = word.length;
		while (i < wordLength) {
			const currentCharacter = word[i];
			const childNode = node.c.get(currentCharacter);
			if (childNode) {
				const edgeLabel = childNode.s;
				const edgeLabelLength = edgeLabel.length;
				let j = 0;
				while (j < edgeLabelLength && i + j < wordLength && edgeLabel.charCodeAt(j) === word.charCodeAt(i + j)) j++;
				if (j === edgeLabelLength) {
					node = childNode;
					i += j;
					if (i === wordLength) {
						if (!childNode.e) childNode.e = true;
						childNode.addDocumentToPostings(postings, docId);
						return;
					}
					continue;
				}
				const commonPrefix = edgeLabel.slice(0, j);
				const newEdgeLabel = edgeLabel.slice(j);
				const newWordLabel = word.slice(i + j);
				const inbetweenNode = new RadixNode(commonPrefix[0], commonPrefix, false);
				inbetweenNode.w = node.w + commonPrefix;
				node.c.set(commonPrefix[0], inbetweenNode);
				childNode.s = newEdgeLabel;
				childNode.k = newEdgeLabel[0];
				inbetweenNode.c.set(newEdgeLabel[0], childNode);
				childNode.w = inbetweenNode.w + newEdgeLabel;
				if (newWordLabel) {
					const newNode = new RadixNode(newWordLabel[0], newWordLabel, true);
					newNode.w = inbetweenNode.w + newWordLabel;
					inbetweenNode.c.set(newWordLabel[0], newNode);
					newNode.addDocumentToPostings(postings, docId);
				} else {
					inbetweenNode.e = true;
					inbetweenNode.addDocumentToPostings(postings, docId);
				}
				return;
			} else {
				const suffix = word.slice(i);
				const newNode = new RadixNode(currentCharacter, suffix, true);
				newNode.w = node.w + suffix;
				node.c.set(currentCharacter, newNode);
				newNode.addDocumentToPostings(postings, docId);
				return;
			}
		}
		if (!node.e) node.e = true;
		node.addDocumentToPostings(postings, docId);
	}
	_findLevenshtein(term, tolerance, output, postings) {
		const termLength = term.length;
		if (!termLength) {
			this.findAllWords(output, term, postings, false, 0);
			return;
		}
		const initialRow = new Array(termLength + 1);
		for (let i = 0; i <= termLength; i++) initialRow[i] = i;
		const stack = [{
			node: this,
			row: initialRow
		}];
		while (stack.length > 0) {
			const { node, row } = stack.pop();
			if (node.e && row[termLength] <= tolerance) {
				const docIDs = node.getDocumentsFromPostings(postings);
				output[node.w] = docIDs.length > 0 ? [...docIDs] : [];
			}
			for (const child of node.c.values()) {
				const label = child.s;
				let currentRow = row;
				let pruned = false;
				let prefixMatched = false;
				for (let charIndex = 0; charIndex < label.length; charIndex++) {
					const charCode = label.charCodeAt(charIndex);
					const nextRow = new Array(termLength + 1);
					nextRow[0] = currentRow[0] + 1;
					let rowMin = nextRow[0];
					for (let i = 1; i <= termLength; i++) {
						const value = term.charCodeAt(i - 1) === charCode ? currentRow[i - 1] : Math.min(currentRow[i] + 1, nextRow[i - 1] + 1, currentRow[i - 1] + 1);
						nextRow[i] = value;
						if (value < rowMin) rowMin = value;
					}
					currentRow = nextRow;
					if (!nextRow[termLength]) {
						prefixMatched = true;
						break;
					}
					if (rowMin > tolerance) {
						pruned = true;
						break;
					}
				}
				if (prefixMatched) child.findAllWords(output, term, postings, false, 0);
				else if (!pruned) stack.push({
					node: child,
					row: currentRow
				});
			}
		}
	}
	findWithPostings(params, postings) {
		const { term, exact, tolerance } = params;
		if (tolerance && !exact) {
			const output = {};
			this._findLevenshtein(term, tolerance, output, postings);
			return output;
		}
		let node = this;
		let i = 0;
		const termLength = term.length;
		while (i < termLength) {
			const character = term[i];
			const childNode = node.c.get(character);
			if (childNode) {
				const edgeLabel = childNode.s;
				const edgeLabelLength = edgeLabel.length;
				let j = 0;
				while (j < edgeLabelLength && i + j < termLength && edgeLabel.charCodeAt(j) === term.charCodeAt(i + j)) j++;
				if (j === edgeLabelLength) {
					node = childNode;
					i += j;
				} else if (i + j === termLength) {
					if (j === termLength - i) {
						if (exact) return {};
						const output = {};
						childNode.findAllWords(output, term, postings, exact, tolerance);
						return output;
					}
					return {};
				} else return {};
			} else return {};
		}
		const output = {};
		node.findAllWords(output, term, postings, exact, tolerance);
		return output;
	}
	contains(term) {
		let node = this;
		let i = 0;
		const termLength = term.length;
		while (i < termLength) {
			const character = term[i];
			const childNode = node.c.get(character);
			if (childNode) {
				const edgeLabel = childNode.s;
				const edgeLabelLength = edgeLabel.length;
				let j = 0;
				while (j < edgeLabelLength && i + j < termLength && edgeLabel.charCodeAt(j) === term.charCodeAt(i + j)) j++;
				if (j < edgeLabelLength) return false;
				i += edgeLabelLength;
				node = childNode;
			} else return false;
		}
		return true;
	}
	removeWordWithPostings(term, postings) {
		if (!term) return false;
		let node = this;
		const termLength = term.length;
		const stack = [];
		for (let i = 0; i < termLength; i++) {
			const character = term[i];
			if (node.c.has(character)) {
				const childNode = node.c.get(character);
				stack.push({
					parent: node,
					character
				});
				i += childNode.s.length - 1;
				node = childNode;
			} else return false;
		}
		clearPostings(postings, node.w);
		node.d = void 0;
		node.e = false;
		while (stack.length > 0 && node.c.size === 0 && !node.e && !node.hasDocumentsInPostings(postings)) {
			const { parent, character } = stack.pop();
			parent.c.delete(character);
			node = parent;
		}
		return true;
	}
	removeDocumentByWordWithPostings(term, docID, postings, exact = true) {
		if (!term) return true;
		let node = this;
		const termLength = term.length;
		for (let i = 0; i < termLength; i++) {
			const character = term[i];
			if (node.c.has(character)) {
				const childNode = node.c.get(character);
				i += childNode.s.length - 1;
				node = childNode;
				if (exact && node.w !== term) {} else node.removeDocumentFromPostings(postings, docID);
			} else return false;
		}
		return true;
	}
	toNodeJSON() {
		return {
			w: this.w,
			s: this.s,
			e: this.e,
			k: this.k,
			c: Array.from(this.c.entries()).map(([key, node]) => [key, node.toNodeJSON()])
		};
	}
	static fromNodeJSON(json) {
		const node = new RadixNode(json.k, json.s, json.e);
		node.w = json.w;
		node.c = new Map(json.c?.map(([key, nodeJson]) => [key, RadixNode.fromNodeJSON(nodeJson)]) || []);
		return node;
	}
};
var RadixTree = class RadixTree extends RadixNode {
	postings = createPostingsMap();
	constructor() {
		super("", "", false);
	}
	insert(word, docId) {
		this.insertWithPostings(word, docId, this.postings);
	}
	find(params) {
		return this.findWithPostings(params, this.postings);
	}
	removeWord(term) {
		return this.removeWordWithPostings(term, this.postings);
	}
	removeDocumentByWord(term, docID, exact = true) {
		return this.removeDocumentByWordWithPostings(term, docID, this.postings, exact);
	}
	getDocumentFrequency(term) {
		return getDocumentFrequency(this.postings, term);
	}
	toJSON() {
		return {
			...this.toNodeJSON(),
			postings: serializePostingsMap(this.postings)
		};
	}
	static fromJSON(json) {
		const tree = new RadixTree();
		tree.w = json.w;
		tree.s = json.s;
		tree.e = json.e;
		tree.k = json.k;
		tree.c = new Map(json.c?.map(([key, nodeJson]) => [key, RadixNode.fromNodeJSON(nodeJson)]) || []);
		if (json.postings) tree.postings = deserializePostingsMap(json.postings);
		else collectLegacyNodePostings(json, tree.postings);
		hydrateNodePostings(tree, tree.postings);
		return tree;
	}
};
function hydrateNodePostings(node, postings) {
	if (node.e) {
		const list = postings.get(node.w);
		if (list) node.d = list;
	}
	for (const child of node.c.values()) hydrateNodePostings(child, postings);
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/vector-math.js
function normalizeVector(vector, vectorLength) {
	let magnitudeSq = 0;
	for (let i = 0; i < vectorLength; i++) magnitudeSq += vector[i] * vector[i];
	const magnitude = Math.sqrt(magnitudeSq);
	if (magnitude === 0) return 0;
	const invMagnitude = 1 / magnitude;
	for (let i = 0; i < vectorLength; i++) vector[i] *= invMagnitude;
	return magnitude;
}
function dotProduct(targetVector, vector, length) {
	let sum = 0;
	let i = 0;
	const limit = length - 3;
	for (; i < limit; i += 4) sum += targetVector[i] * vector[i] + targetVector[i + 1] * vector[i + 1] + targetVector[i + 2] * vector[i + 2] + targetVector[i + 3] * vector[i + 3];
	for (; i < length; i++) sum += targetVector[i] * vector[i];
	return sum > 1 ? 1 : sum < -1 ? -1 : sum;
}
var VectorIndex = class VectorIndex {
	size;
	vectors = /* @__PURE__ */ new Map();
	constructor(size) {
		this.size = size;
	}
	add(internalDocumentId, value) {
		const stored = new Float32Array(value);
		normalizeVector(stored, this.size);
		this.vectors.set(internalDocumentId, [1, stored]);
	}
	remove(internalDocumentId) {
		this.vectors.delete(internalDocumentId);
	}
	find(vector, similarity, whereFiltersIDs) {
		const queryVector = new Float32Array(vector);
		if (normalizeVector(queryVector, this.size) === 0) return [];
		return findSimilarVectors(queryVector, whereFiltersIDs, this.vectors, this.size, similarity);
	}
	toJSON() {
		const vectors = [];
		for (const [id, [magnitude, vector]] of this.vectors) vectors.push([id, [magnitude, Array.from(vector)]]);
		return {
			kind: "flat",
			size: this.size,
			vectors
		};
	}
	static fromJSON(json) {
		const raw = json;
		const index = new VectorIndex(raw.size);
		for (const [id, [, vector]] of raw.vectors) {
			const stored = new Float32Array(vector);
			normalizeVector(stored, raw.size);
			index.vectors.set(id, [1, stored]);
		}
		return index;
	}
};
function findSimilarVectors(targetVector, keys, vectors, length, threshold) {
	const similarVectors = [];
	if (keys) {
		for (const vectorId of keys) {
			const entry = vectors.get(vectorId);
			if (!entry) continue;
			const score = dotProduct(targetVector, entry[1], length);
			if (score >= threshold) similarVectors.push([vectorId, score]);
		}
		return similarVectors;
	}
	for (const [vectorId, [, vector]] of vectors) {
		const score = dotProduct(targetVector, vector, length);
		if (score >= threshold) similarVectors.push([vectorId, score]);
	}
	return similarVectors;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/trees/vector-index.js
function createFactory(kind, create, fromJSON) {
	return Object.assign(create, {
		kind,
		fromJSON
	});
}
function createFlatVectorIndexFactory() {
	return createFactory("flat", (ctx) => new VectorIndex(ctx.dim), (json) => VectorIndex.fromJSON(json));
}
var defaultFlatVectorIndexFactory = createFlatVectorIndexFactory();
function resolveVectorIndexFactory(property, indexes) {
	if (!indexes) return defaultFlatVectorIndexFactory;
	const propertyConfig = property === "__vector" ? void 0 : indexes[property];
	if (propertyConfig !== void 0) return resolveVectorIndexConfig(propertyConfig);
	const defaultConfig = indexes[RESERVED_VECTOR_INDEX_KEY];
	if (defaultConfig !== void 0) return resolveVectorIndexConfig(defaultConfig);
	return defaultFlatVectorIndexFactory;
}
function resolveVectorIndexConfig(config) {
	if (config === "flat") return defaultFlatVectorIndexFactory;
	return config;
}
function deserializeVectorIndex(property, raw, indexes) {
	const kind = raw.kind ?? "flat";
	const factory = resolveVectorIndexFactory(property, indexes);
	if (kind === "ivf" && factory.kind !== "ivf") throw createError("IVF_INDEX_REQUIRES_FACTORY", property, property);
	return factory.fromJSON(raw);
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/algorithms.js
function BM25(tf, matchingCount, docsCount, fieldLength, averageFieldLength, { k, b, d }) {
	return Math.log(1 + (docsCount - matchingCount + .5) / (matchingCount + .5)) * (d + tf * (k + 1)) / (tf + k * (1 - b + b * fieldLength / averageFieldLength));
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/index.js
function insertDocumentScoreParameters(index, prop, id, tokens, docsCount, internalId) {
	const resolvedInternalId = internalId ?? getInternalDocumentId(index.sharedInternalDocumentStore, id);
	index.avgFieldLength[prop] = ((index.avgFieldLength[prop] ?? 0) * (docsCount - 1) + tokens.length) / docsCount;
	index.fieldLengths[prop][resolvedInternalId] = tokens.length;
	index.frequencies[prop][resolvedInternalId] = {};
	return resolvedInternalId;
}
function insertTokenScoreParameters(index, prop, id, tokens, token, internalId) {
	let tokenFrequency = 0;
	const tokenLength = tokens.length;
	for (let i = 0; i < tokenLength; i++) if (tokens[i] === token) tokenFrequency++;
	const resolvedInternalId = internalId ?? getInternalDocumentId(index.sharedInternalDocumentStore, id);
	const tf = tokenLength > 0 ? tokenFrequency / tokenLength : 0;
	index.frequencies[prop][resolvedInternalId][token] = tf;
}
function insertRadixTokens(index, prop, node, id, internalId, tokens, docsCount) {
	insertDocumentScoreParameters(index, prop, id, tokens, docsCount, internalId);
	const frequencies = index.frequencies[prop][internalId];
	const tokenLength = tokens.length;
	for (let i = 0; i < tokenLength; i++) {
		const token = tokens[i];
		if (Object.hasOwn(frequencies, token)) frequencies[token] += 1;
		else {
			frequencies[token] = 1;
			node.insert(token, internalId);
		}
	}
}
function removeDocumentScoreParameters(index, prop, id, docsCount) {
	const internalId = getInternalDocumentId(index.sharedInternalDocumentStore, id);
	if (docsCount > 1) index.avgFieldLength[prop] = (index.avgFieldLength[prop] * docsCount - index.fieldLengths[prop][internalId]) / (docsCount - 1);
	else index.avgFieldLength[prop] = void 0;
	index.fieldLengths[prop][internalId] = void 0;
	index.frequencies[prop][internalId] = void 0;
}
function removeTokenScoreParameters(_index, _prop, _token) {}
function create$3(zbsearch, sharedInternalDocumentStore, schema, index, prefix = "") {
	if (!index) index = {
		sharedInternalDocumentStore,
		indexes: {},
		vectorIndexes: {},
		searchableProperties: [],
		searchablePropertiesWithTypes: {},
		frequencies: {},
		tokenOccurrences: {},
		avgFieldLength: {},
		fieldLengths: {}
	};
	for (const [prop, type] of Object.entries(schema)) {
		const path = `${prefix}${prefix ? "." : ""}${prop}`;
		if (typeof type === "object" && !Array.isArray(type)) {
			create$3(zbsearch, sharedInternalDocumentStore, type, index, path);
			continue;
		}
		addSearchablePropertyToIndex(zbsearch, index, path, type);
	}
	return index;
}
function addSearchablePropertyToIndex(zbsearch, index, path, type) {
	if (isVectorType(type)) {
		const factory = resolveVectorIndexFactory(path, zbsearch.indexes);
		index.searchableProperties.push(path);
		index.searchablePropertiesWithTypes[path] = type;
		index.vectorIndexes[path] = {
			type: "Vector",
			node: factory({
				dim: getVectorSize(type),
				property: path
			}),
			isArray: false
		};
		return;
	}
	const isArray = /\[/.test(type);
	switch (type) {
		case "boolean":
		case "boolean[]":
			index.indexes[path] = {
				type: "Bool",
				node: new BoolNode(),
				isArray
			};
			break;
		case "number":
		case "number[]":
			index.indexes[path] = {
				type: "AVL",
				node: new AVLTree(0, []),
				isArray
			};
			break;
		case "string":
		case "string[]":
			index.indexes[path] = {
				type: "Radix",
				node: new RadixTree(),
				isArray
			};
			index.avgFieldLength[path] = 0;
			index.frequencies[path] = {};
			index.tokenOccurrences[path] = {};
			index.fieldLengths[path] = {};
			break;
		case "enum":
		case "enum[]":
			index.indexes[path] = {
				type: "Flat",
				node: new FlatTree(),
				isArray
			};
			break;
		case "geopoint":
			index.indexes[path] = {
				type: "BKD",
				node: new BKDTree(),
				isArray
			};
			break;
		default: throw createError("INVALID_SCHEMA_TYPE", Array.isArray(type) ? "array" : type, path);
	}
	index.searchableProperties.push(path);
	index.searchablePropertiesWithTypes[path] = type;
}
function insertScalarValue(_implementation, index, prop, id, internalId, value, language, tokenizer, docsCount, options) {
	const { type, node } = index.indexes[prop];
	switch (type) {
		case "Bool":
			node[value ? "true" : "false"].add(internalId);
			break;
		case "AVL": {
			const avlRebalanceThreshold = options?.avlRebalanceThreshold ?? 1;
			node.insert(value, internalId, avlRebalanceThreshold);
			break;
		}
		case "Radix":
			insertRadixTokens(index, prop, node, id, internalId, tokenizer.tokenize(value, language, prop), docsCount);
			break;
		case "Flat":
			node.insert(value, internalId);
			break;
		case "BKD": node.insert(value, [internalId]);
	}
}
function insert$1(implementation, index, prop, id, internalId, value, schemaType, language, tokenizer, docsCount, options) {
	if (isVectorType(schemaType)) return insertVector(index, prop, value, id, internalId);
	if (!isArrayType(schemaType)) return insertScalarValue(implementation, index, prop, id, internalId, value, language, tokenizer, docsCount, options);
	const elements = value;
	const elementsLength = elements.length;
	for (let i = 0; i < elementsLength; i++) insertScalarValue(implementation, index, prop, id, internalId, elements[i], language, tokenizer, docsCount, options);
}
function insertVector(index, prop, value, id, internalDocumentId) {
	index.vectorIndexes[prop].node.add(internalDocumentId, value);
}
function removeScalar(implementation, index, prop, id, internalId, value, schemaType, language, tokenizer, docsCount) {
	if (isVectorType(schemaType)) {
		index.vectorIndexes[prop].node.remove(internalId);
		return true;
	}
	const { type, node } = index.indexes[prop];
	switch (type) {
		case "AVL":
			node.removeDocument(value, internalId);
			return true;
		case "Bool":
			node[value ? "true" : "false"].delete(internalId);
			return true;
		case "Radix": {
			const tokens = tokenizer.tokenize(value, language, prop);
			implementation.removeDocumentScoreParameters(index, prop, id, docsCount);
			for (const token of tokens) {
				implementation.removeTokenScoreParameters(index, prop, token);
				node.removeDocumentByWord(token, internalId);
			}
			return true;
		}
		case "Flat":
			node.removeDocument(internalId, value);
			return true;
		case "BKD":
			node.removeDocByID(value, internalId);
			return false;
	}
}
function remove$1(implementation, index, prop, id, internalId, value, schemaType, language, tokenizer, docsCount) {
	if (!isArrayType(schemaType)) return removeScalar(implementation, index, prop, id, internalId, value, schemaType, language, tokenizer, docsCount);
	const innerSchemaType = getInnerType(schemaType);
	const elements = value;
	const elementsLength = elements.length;
	for (let i = 0; i < elementsLength; i++) removeScalar(implementation, index, prop, id, internalId, elements[i], innerSchemaType, language, tokenizer, docsCount);
	return true;
}
function calculateResultScores(index, prop, term, ids, docsCount, bm25Relevance, resultsMap, boostPerProperty, whereFiltersIDs, keywordMatchesMap) {
	const avgFieldLength = index.avgFieldLength[prop];
	const fieldLengths = index.fieldLengths[prop];
	const zbsearchFrequencies = index.frequencies[prop];
	const termOccurrences = getTermDocumentFrequency(index, prop, term);
	const documentIDsLength = ids.length;
	for (let k = 0; k < documentIDsLength; k++) {
		const internalId = ids[k];
		if (whereFiltersIDs && !whereFiltersIDs.has(internalId)) continue;
		if (keywordMatchesMap) {
			if (!keywordMatchesMap.has(internalId)) keywordMatchesMap.set(internalId, /* @__PURE__ */ new Map());
			const propertyMatches = keywordMatchesMap.get(internalId);
			propertyMatches.set(prop, (propertyMatches.get(prop) || 0) + 1);
		}
		const bm25 = BM25(zbsearchFrequencies?.[internalId]?.[term] ?? 0, termOccurrences, docsCount, fieldLengths[internalId], avgFieldLength, bm25Relevance);
		if (resultsMap.has(internalId)) resultsMap.set(internalId, resultsMap.get(internalId) + bm25 * boostPerProperty);
		else resultsMap.set(internalId, bm25 * boostPerProperty);
	}
}
function collectFindResultIds(searchResult) {
	const ids = /* @__PURE__ */ new Set();
	for (const word in searchResult) {
		const docIds = searchResult[word];
		for (let i = 0; i < docIds.length; i++) ids.add(docIds[i]);
	}
	return ids;
}
function filterIdsToCandidates(ids, candidates) {
	const filtered = [];
	for (let i = 0; i < ids.length; i++) {
		const id = ids[i];
		if (candidates.has(id)) filtered.push(id);
	}
	return filtered;
}
var PREFIX_EXPANSION_SCORE_DEMOTION = .5;
function bm25Idf(documentFrequency, docsCount) {
	return Math.log(1 + (docsCount - documentFrequency + .5) / (documentFrequency + .5));
}
function prefixExpansionDemotion(tokenDf, wordDf, docsCount) {
	if (tokenDf === void 0) return PREFIX_EXPANSION_SCORE_DEMOTION;
	const wordIdf = bm25Idf(wordDf, docsCount);
	if (!wordIdf) return PREFIX_EXPANSION_SCORE_DEMOTION;
	return PREFIX_EXPANSION_SCORE_DEMOTION * Math.min(1, bm25Idf(tokenDf, docsCount) / wordIdf);
}
function searchThresholdZero(index, tokens, propertiesToSearch, exact, tolerance, boost, relevance, docsCount, whereFiltersIDs) {
	const findCache = /* @__PURE__ */ new Map();
	const candidateIds = /* @__PURE__ */ new Set();
	const matchingProperties = [];
	for (const prop of propertiesToSearch) {
		if (!(prop in index.indexes)) continue;
		const tree = index.indexes[prop];
		if (tree.type !== "Radix") throw createError("WRONG_SEARCH_PROPERTY_TYPE", prop);
		const boostPerProperty = boost[prop] ?? 1;
		if (boostPerProperty <= 0) throw createError("INVALID_BOOST_VALUE", boostPerProperty);
		let propertyIntersection;
		const tokenLength = tokens.length;
		for (let i = 0; i < tokenLength; i++) {
			const token = tokens[i];
			const cacheKey = `${prop}\0${token}`;
			let searchResult = findCache.get(cacheKey);
			if (!searchResult) {
				searchResult = tree.node.find({
					term: token,
					exact,
					tolerance
				});
				findCache.set(cacheKey, searchResult);
			}
			if (!Object.keys(searchResult).length) {
				propertyIntersection = void 0;
				break;
			}
			const tokenIds = collectFindResultIds(searchResult);
			propertyIntersection = propertyIntersection === void 0 ? tokenIds : setIntersection(propertyIntersection, tokenIds);
			if (!propertyIntersection.size) break;
		}
		if (!propertyIntersection || !propertyIntersection.size) continue;
		matchingProperties.push(prop);
		for (const id of propertyIntersection) if (!whereFiltersIDs || whereFiltersIDs.has(id)) candidateIds.add(id);
	}
	if (!candidateIds.size) return [];
	const resultsMap = /* @__PURE__ */ new Map();
	for (const prop of matchingProperties) {
		if (index.indexes[prop].type !== "Radix") continue;
		const boostPerProperty = boost[prop] ?? 1;
		const tokenLength = tokens.length;
		for (let i = 0; i < tokenLength; i++) {
			const token = tokens[i];
			const cacheKey = `${prop}\0${token}`;
			const searchResult = findCache.get(cacheKey);
			const words = Object.keys(searchResult);
			for (let j = 0; j < words.length; j++) {
				const word = words[j];
				const filteredIds = filterIdsToCandidates(searchResult[word], candidateIds);
				if (filteredIds.length > 0) calculateResultScores(index, prop, word, filteredIds, docsCount, relevance, resultsMap, boostPerProperty * (word === token ? 1 : prefixExpansionDemotion(searchResult[token]?.length, searchResult[word].length, docsCount)), whereFiltersIDs);
			}
		}
	}
	return Array.from(resultsMap.entries()).map(([id, score]) => [id, score]).sort((a, b) => b[1] - a[1]);
}
function search$1(index, term, tokenizer, language, propertiesToSearch, exact, tolerance, boost, relevance, docsCount, whereFiltersIDs, threshold = 0, prefix = true) {
	const tokens = uniqueTokens(tokenizer.tokenize(term, language));
	const keywordsCount = tokens.length || 1;
	if (!tokens.length && !term) tokens.push("");
	const radixExact = term ? exact || !prefix && !tolerance : false;
	if (!threshold && tokens.length > 1) return searchThresholdZero(index, tokens, propertiesToSearch, radixExact, tolerance, boost, relevance, docsCount, whereFiltersIDs);
	const keywordMatchesMap = /* @__PURE__ */ new Map();
	const tokenFoundMap = /* @__PURE__ */ new Map();
	const resultsMap = /* @__PURE__ */ new Map();
	for (const prop of propertiesToSearch) {
		if (!(prop in index.indexes)) continue;
		const tree = index.indexes[prop];
		const { type } = tree;
		if (type !== "Radix") throw createError("WRONG_SEARCH_PROPERTY_TYPE", prop);
		const boostPerProperty = boost[prop] ?? 1;
		if (boostPerProperty <= 0) throw createError("INVALID_BOOST_VALUE", boostPerProperty);
		const tokenLength = tokens.length;
		for (let i = 0; i < tokenLength; i++) {
			const token = tokens[i];
			const searchResult = tree.node.find({
				term: token,
				exact: radixExact,
				tolerance
			});
			const termsFound = Object.keys(searchResult);
			if (termsFound.length > 0) tokenFoundMap.set(token, true);
			const termsFoundLength = termsFound.length;
			for (let j = 0; j < termsFoundLength; j++) {
				const word = termsFound[j];
				const ids = searchResult[word];
				calculateResultScores(index, prop, word, ids, docsCount, relevance, resultsMap, boostPerProperty * (word === token ? 1 : prefixExpansionDemotion(searchResult[token]?.length, ids.length, docsCount)), whereFiltersIDs, keywordMatchesMap);
			}
		}
	}
	const results = Array.from(resultsMap.entries()).map(([id, score]) => [id, score]).sort((a, b) => b[1] - a[1]);
	if (results.length === 0) return [];
	if (threshold === 1) return results;
	if (threshold === 0) {
		if (keywordsCount === 1) return results;
		for (const token of tokens) if (!tokenFoundMap.get(token)) return [];
		return results.filter(([id]) => {
			const propertyMatches = keywordMatchesMap.get(id);
			if (!propertyMatches) return false;
			return Array.from(propertyMatches.values()).some((matches) => matches === keywordsCount);
		});
	}
	const fullMatches = results.filter(([id]) => {
		const propertyMatches = keywordMatchesMap.get(id);
		if (!propertyMatches) return false;
		return Array.from(propertyMatches.values()).some((matches) => matches === keywordsCount);
	});
	if (fullMatches.length > 0) {
		const remainingResults = results.filter(([id]) => !fullMatches.some(([fid]) => fid === id));
		const additionalResults = Math.ceil(remainingResults.length * threshold);
		return [...fullMatches, ...remainingResults.slice(0, additionalResults)];
	}
	return results;
}
function searchByWhereClause(index, tokenizer, filters, language) {
	if ("and" in filters && filters.and && Array.isArray(filters.and)) {
		const andFilters = filters.and;
		if (andFilters.length === 0) return /* @__PURE__ */ new Set();
		return setIntersection(...andFilters.map((filter) => searchByWhereClause(index, tokenizer, filter, language)));
	}
	if ("or" in filters && filters.or && Array.isArray(filters.or)) {
		const orFilters = filters.or;
		if (orFilters.length === 0) return /* @__PURE__ */ new Set();
		return orFilters.map((filter) => searchByWhereClause(index, tokenizer, filter, language)).reduce((acc, set) => setUnion(acc, set), /* @__PURE__ */ new Set());
	}
	if ("not" in filters && filters.not) {
		const notFilter = filters.not;
		const allDocs = /* @__PURE__ */ new Set();
		const docsStore = index.sharedInternalDocumentStore;
		for (let i = 1; i <= docsStore.internalIdToId.length; i++) allDocs.add(i);
		return setDifference(allDocs, searchByWhereClause(index, tokenizer, notFilter, language));
	}
	const filterKeys = Object.keys(filters);
	const filtersMap = filterKeys.reduce((acc, key) => ({
		[key]: /* @__PURE__ */ new Set(),
		...acc
	}), {});
	for (const param of filterKeys) {
		const operation = filters[param];
		if (typeof index.indexes[param] === "undefined") throw createError("UNKNOWN_FILTER_PROPERTY", param);
		const { node, type, isArray } = index.indexes[param];
		if (type === "Bool") {
			const idx = node;
			const filteredIDs = operation ? idx.true : idx.false;
			filtersMap[param] = setUnion(filtersMap[param], filteredIDs);
			continue;
		}
		if (type === "BKD") {
			let reqOperation;
			if ("radius" in operation) reqOperation = "radius";
			else if ("polygon" in operation) reqOperation = "polygon";
			else throw new Error(`Invalid operation ${operation}`);
			if (reqOperation === "radius") {
				const { value, coordinates, unit = "m", inside = true, highPrecision = false } = operation[reqOperation];
				const distanceInMeters = convertDistanceToMeters(value, unit);
				const ids = node.searchByRadius(coordinates, distanceInMeters, inside, void 0, highPrecision);
				filtersMap[param] = addGeoResult(filtersMap[param], ids);
			} else {
				const { coordinates, inside = true, highPrecision = false } = operation[reqOperation];
				const ids = node.searchByPolygon(coordinates, inside, void 0, highPrecision);
				filtersMap[param] = addGeoResult(filtersMap[param], ids);
			}
			continue;
		}
		if (type === "Radix" && (typeof operation === "string" || Array.isArray(operation))) {
			for (const raw of [operation].flat()) {
				const term = tokenizer.tokenize(raw, language, param);
				for (const t of term) {
					const filteredIDsResults = node.find({
						term: t,
						exact: true
					});
					filtersMap[param] = addFindResult(filtersMap[param], filteredIDsResults);
				}
			}
			continue;
		}
		const operationKeys = Object.keys(operation);
		if (operationKeys.length > 1) throw createError("INVALID_FILTER_OPERATION", operationKeys.length);
		if (type === "Flat") {
			const results = new Set(isArray ? node.filterArr(operation) : node.filter(operation));
			filtersMap[param] = setUnion(filtersMap[param], results);
			continue;
		}
		if (type === "AVL") {
			const operationOpt = operationKeys[0];
			const operationValue = operation[operationOpt];
			let filteredIDs;
			switch (operationOpt) {
				case "gt":
					filteredIDs = node.greaterThan(operationValue, false);
					break;
				case "gte":
					filteredIDs = node.greaterThan(operationValue, true);
					break;
				case "lt":
					filteredIDs = node.lessThan(operationValue, false);
					break;
				case "lte":
					filteredIDs = node.lessThan(operationValue, true);
					break;
				case "eq":
					filteredIDs = node.find(operationValue) ?? /* @__PURE__ */ new Set();
					break;
				case "between": {
					const [min, max] = operationValue;
					filteredIDs = node.rangeSearch(min, max);
					break;
				}
				default: throw createError("INVALID_FILTER_OPERATION", operationOpt);
			}
			filtersMap[param] = setUnion(filtersMap[param], filteredIDs);
		}
	}
	return setIntersection(...Object.values(filtersMap));
}
function getSearchableProperties(index) {
	return index.searchableProperties;
}
function getSearchablePropertiesWithTypes(index) {
	return index.searchablePropertiesWithTypes;
}
function deserializeIndexEntry(rawIndex) {
	const { node, type, isArray } = rawIndex;
	switch (type) {
		case "Radix": return {
			type: "Radix",
			node: RadixTree.fromJSON(node),
			isArray
		};
		case "Flat": return {
			type: "Flat",
			node: FlatTree.fromJSON(node),
			isArray
		};
		case "AVL": return {
			type: "AVL",
			node: AVLTree.fromJSON(node),
			isArray
		};
		case "BKD": return {
			type: "BKD",
			node: BKDTree.fromJSON(node),
			isArray
		};
		case "Bool": return {
			type: "Bool",
			node: BoolNode.fromJSON(node),
			isArray
		};
		default: return rawIndex;
	}
}
function load$3(sharedInternalDocumentStore, raw, indexesConfig) {
	const { indexes: rawIndexes, vectorIndexes: rawVectorIndexes, searchableProperties, searchablePropertiesWithTypes, frequencies, tokenOccurrences, avgFieldLength, fieldLengths } = raw;
	const indexes = {};
	const vectorIndexes = {};
	for (const prop of Object.keys(rawIndexes)) indexes[prop] = deserializeIndexEntry(rawIndexes[prop]);
	for (const idx of Object.keys(rawVectorIndexes)) vectorIndexes[idx] = {
		type: "Vector",
		isArray: false,
		node: deserializeVectorIndex(idx, rawVectorIndexes[idx], indexesConfig)
	};
	return {
		sharedInternalDocumentStore,
		indexes,
		vectorIndexes,
		searchableProperties,
		searchablePropertiesWithTypes,
		frequencies,
		tokenOccurrences,
		avgFieldLength,
		fieldLengths
	};
}
async function loadAsync$1(sharedInternalDocumentStore, raw, indexesConfig) {
	const { indexes: rawIndexes, vectorIndexes: rawVectorIndexes, searchableProperties, searchablePropertiesWithTypes, frequencies, tokenOccurrences, avgFieldLength, fieldLengths } = raw;
	const indexes = {};
	const vectorIndexes = {};
	const props = Object.keys(rawIndexes);
	const vectorProps = Object.keys(rawVectorIndexes);
	for (let i = 0; i < props.length; i++) {
		const prop = props[i];
		indexes[prop] = deserializeIndexEntry(rawIndexes[prop]);
		if (i < props.length - 1 || vectorProps.length > 0) await yieldToEventLoop();
	}
	for (let i = 0; i < vectorProps.length; i++) {
		const idx = vectorProps[i];
		vectorIndexes[idx] = {
			type: "Vector",
			isArray: false,
			node: deserializeVectorIndex(idx, rawVectorIndexes[idx], indexesConfig)
		};
		if (i < vectorProps.length - 1) await yieldToEventLoop();
	}
	return {
		sharedInternalDocumentStore,
		indexes,
		vectorIndexes,
		searchableProperties,
		searchablePropertiesWithTypes,
		frequencies,
		tokenOccurrences,
		avgFieldLength,
		fieldLengths
	};
}
function save$2(index) {
	const { indexes, vectorIndexes, searchableProperties, searchablePropertiesWithTypes, frequencies, tokenOccurrences: _tokenOccurrences, avgFieldLength, fieldLengths } = index;
	const dumpVectorIndexes = {};
	for (const idx of Object.keys(vectorIndexes)) dumpVectorIndexes[idx] = vectorIndexes[idx].node.toJSON();
	const savedIndexes = {};
	for (const name of Object.keys(indexes)) {
		const { type, node, isArray } = indexes[name];
		if (type === "Flat" || type === "Radix" || type === "AVL" || type === "BKD" || type === "Bool") savedIndexes[name] = {
			type,
			node: node.toJSON(),
			isArray
		};
		else {
			savedIndexes[name] = indexes[name];
			savedIndexes[name].node = savedIndexes[name].node.toJSON();
		}
	}
	return {
		indexes: savedIndexes,
		vectorIndexes: dumpVectorIndexes,
		searchableProperties,
		searchablePropertiesWithTypes,
		frequencies,
		tokenOccurrences: {},
		avgFieldLength,
		fieldLengths
	};
}
function getTermDocumentFrequency(index, prop, term) {
	const treeIndex = index.indexes[prop];
	if (treeIndex?.type === "Radix") return treeIndex.node.getDocumentFrequency(term);
	const stored = index.tokenOccurrences[prop]?.[term];
	return typeof stored === "number" ? stored : 0;
}
function createIndex() {
	return {
		create: create$3,
		insert: insert$1,
		remove: remove$1,
		insertDocumentScoreParameters,
		insertTokenScoreParameters,
		removeDocumentScoreParameters,
		removeTokenScoreParameters,
		calculateResultScores,
		search: search$1,
		supportsSuggestions: true,
		searchByWhereClause,
		getSearchableProperties,
		getSearchablePropertiesWithTypes,
		load: load$3,
		loadAsync: loadAsync$1,
		save: save$2
	};
}
function addGeoResult(set, ids) {
	if (!set) set = /* @__PURE__ */ new Set();
	const idsLength = ids.length;
	for (let i = 0; i < idsLength; i++) {
		const entry = ids[i].docIDs;
		const idsLength = entry.length;
		for (let j = 0; j < idsLength; j++) set.add(entry[j]);
	}
	return set;
}
function createGeoTokenScores(ids, centerPoint, highPrecision = false) {
	const distanceFn = highPrecision ? BKDTree.vincentyDistance : BKDTree.haversineDistance;
	const results = [];
	const distances = [];
	for (const { point } of ids) distances.push(distanceFn(centerPoint, point));
	const maxDistance = Math.max(...distances);
	let index = 0;
	for (const { docIDs } of ids) {
		const score = maxDistance - distances[index] + 1;
		for (const docID of docIDs) results.push([docID, score]);
		index++;
	}
	results.sort((a, b) => b[1] - a[1]);
	return results;
}
function isGeosearchOnlyQuery(filters, index) {
	const filterKeys = Object.keys(filters);
	if (filterKeys.length !== 1) return { isGeoOnly: false };
	const param = filterKeys[0];
	const operation = filters[param];
	if (typeof index.indexes[param] === "undefined") return { isGeoOnly: false };
	const { type } = index.indexes[param];
	if (type === "BKD" && operation && ("radius" in operation || "polygon" in operation)) return {
		isGeoOnly: true,
		geoProperty: param,
		geoOperation: operation
	};
	return { isGeoOnly: false };
}
function searchByGeoWhereClause(index, filters) {
	const indexTyped = index;
	const geoInfo = isGeosearchOnlyQuery(filters, indexTyped);
	if (!geoInfo.isGeoOnly || !geoInfo.geoProperty || !geoInfo.geoOperation) return null;
	const { node } = indexTyped.indexes[geoInfo.geoProperty];
	const operation = geoInfo.geoOperation;
	const bkdNode = node;
	let results;
	if ("radius" in operation) {
		const { value, coordinates, unit = "m", inside = true, highPrecision = false } = operation.radius;
		const centerPoint = coordinates;
		const distanceInMeters = convertDistanceToMeters(value, unit);
		results = bkdNode.searchByRadius(centerPoint, distanceInMeters, inside, "asc", highPrecision);
		return createGeoTokenScores(results, centerPoint, highPrecision);
	} else if ("polygon" in operation) {
		const { coordinates, inside = true, highPrecision = false } = operation.polygon;
		results = bkdNode.searchByPolygon(coordinates, inside, "asc", highPrecision);
		const centroid = BKDTree.calculatePolygonCentroid(coordinates);
		return createGeoTokenScores(results, centroid, highPrecision);
	}
	return null;
}
function addFindResult(set, filteredIDsResults) {
	if (!set) set = /* @__PURE__ */ new Set();
	const keys = Object.keys(filteredIDsResults);
	const keysLength = keys.length;
	for (let i = 0; i < keysLength; i++) {
		const ids = filteredIDsResults[keys[i]];
		const idsLength = ids.length;
		for (let j = 0; j < idsLength; j++) set.add(ids[j]);
	}
	return set;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/pinning.js
function create$2(sharedInternalDocumentStore) {
	return {
		sharedInternalDocumentStore,
		rules: /* @__PURE__ */ new Map()
	};
}
function addRule(store, rule) {
	if (store.rules.has(rule.id)) throw new Error(`PINNING_RULE_ALREADY_EXISTS: A pinning rule with id "${rule.id}" already exists. Use updateRule to modify it.`);
	store.rules.set(rule.id, rule);
}
function updateRule(store, rule) {
	if (!store.rules.has(rule.id)) throw new Error(`PINNING_RULE_NOT_FOUND: Cannot update pinning rule with id "${rule.id}" because it does not exist. Use addRule to create it.`);
	store.rules.set(rule.id, rule);
}
function removeRule(store, ruleId) {
	return store.rules.delete(ruleId);
}
function getRule(store, ruleId) {
	return store.rules.get(ruleId);
}
function getAllRules(store) {
	return Array.from(store.rules.values());
}
function matchesCondition(term, condition) {
	const normalizedTerm = term.toLowerCase().trim();
	const normalizedPattern = condition.pattern.toLowerCase().trim();
	switch (condition.anchoring) {
		case "is": return normalizedTerm === normalizedPattern;
		case "starts_with": return normalizedTerm.startsWith(normalizedPattern);
		case "contains": return normalizedTerm.includes(normalizedPattern);
		default: return false;
	}
}
function matchesRule(term, rule) {
	if (!term) return false;
	return rule.conditions.every((condition) => matchesCondition(term, condition));
}
function getMatchingRules(store, term) {
	if (!term) return [];
	const matchingRules = [];
	for (const rule of store.rules.values()) if (matchesRule(term, rule)) matchingRules.push(rule);
	return matchingRules;
}
function load$2(sharedInternalDocumentStore, raw) {
	return {
		sharedInternalDocumentStore,
		rules: new Map(raw?.rules ?? [])
	};
}
function save$1(store) {
	return { rules: Array.from(store.rules.entries()) };
}
function createPinning() {
	return {
		create: create$2,
		addRule,
		updateRule,
		removeRule,
		getRule,
		getAllRules,
		getMatchingRules,
		load: load$2,
		save: save$1
	};
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/plugins.js
var AVAILABLE_PLUGIN_HOOKS = [
	"beforeInsert",
	"afterInsert",
	"beforeRemove",
	"afterRemove",
	"beforeUpdate",
	"afterUpdate",
	"beforeUpsert",
	"afterUpsert",
	"beforeSearch",
	"afterSearch",
	"beforeInsertMultiple",
	"afterInsertMultiple",
	"beforeRemoveMultiple",
	"afterRemoveMultiple",
	"beforeUpdateMultiple",
	"afterUpdateMultiple",
	"beforeUpsertMultiple",
	"afterUpsertMultiple",
	"beforeLoad",
	"afterLoad",
	"afterCreate"
];
function getAllPluginsByHook(zbsearch, hook) {
	const pluginsToRun = [];
	const pluginsLength = zbsearch.plugins?.length;
	if (!pluginsLength) return pluginsToRun;
	for (let i = 0; i < pluginsLength; i++) try {
		const plugin = zbsearch.plugins[i];
		if (typeof plugin[hook] === "function") pluginsToRun.push(plugin[hook]);
	} catch (error) {
		console.error("Caught error in getAllPluginsByHook:", error);
		throw createError("PLUGIN_CRASHED");
	}
	return pluginsToRun;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/sorter.js
function addSortablePropertyToSorter(sorter, path, type) {
	if (!sorter.enabled || (sorter.unsortableProperties ?? []).includes(path)) return;
	switch (type) {
		case "boolean":
		case "number":
		case "string":
			sorter.sortableProperties.push(path);
			sorter.sortablePropertiesWithTypes[path] = type;
			sorter.sorts[path] = {
				docs: /* @__PURE__ */ new Map(),
				orderedDocsToRemove: /* @__PURE__ */ new Map(),
				orderedDocs: [],
				type
			};
			break;
		default: return;
	}
}
function innerCreate(zbsearch, sharedInternalDocumentStore, schema, sortableDeniedProperties, prefix) {
	const sorter = {
		language: zbsearch.tokenizer.language,
		sharedInternalDocumentStore,
		enabled: true,
		isSorted: true,
		sortableProperties: [],
		sortablePropertiesWithTypes: {},
		sorts: {},
		unsortableProperties: sortableDeniedProperties
	};
	for (const [prop, type] of Object.entries(schema)) {
		const path = `${prefix}${prefix ? "." : ""}${prop}`;
		if (sortableDeniedProperties.includes(path)) continue;
		if (typeof type === "object" && !Array.isArray(type)) {
			const ret = innerCreate(zbsearch, sharedInternalDocumentStore, type, sortableDeniedProperties, path);
			safeArrayPush(sorter.sortableProperties, ret.sortableProperties);
			sorter.sorts = {
				...sorter.sorts,
				...ret.sorts
			};
			sorter.sortablePropertiesWithTypes = {
				...sorter.sortablePropertiesWithTypes,
				...ret.sortablePropertiesWithTypes
			};
			continue;
		}
		if (isVectorType(type)) continue;
		switch (type) {
			case "boolean":
			case "number":
			case "string":
				addSortablePropertyToSorter(sorter, path, type);
				break;
			case "geopoint":
			case "enum": continue;
			case "enum[]":
			case "boolean[]":
			case "number[]":
			case "string[]": continue;
			default: throw createError("INVALID_SORT_SCHEMA_TYPE", Array.isArray(type) ? "array" : type, path);
		}
	}
	return sorter;
}
function create$1(zbsearch, sharedInternalDocumentStore, schema, config) {
	if (!(config?.enabled !== false)) return { disabled: true };
	return innerCreate(zbsearch, sharedInternalDocumentStore, schema, (config || {}).unsortableProperties || [], "");
}
function insert(sorter, prop, id, value) {
	if (!sorter.enabled) return;
	sorter.isSorted = false;
	const internalId = getInternalDocumentId(sorter.sharedInternalDocumentStore, id);
	const s = sorter.sorts[prop];
	if (s.orderedDocsToRemove.has(internalId)) ensureOrderedDocsAreDeletedByProperty(sorter, prop);
	s.docs.set(internalId, s.orderedDocs.length);
	s.orderedDocs.push([internalId, value]);
}
function ensureIsSorted(sorter) {
	if (sorter.isSorted || !sorter.enabled) return;
	const properties = Object.keys(sorter.sorts);
	for (const prop of properties) ensurePropertyIsSorted(sorter, prop);
	sorter.isSorted = true;
}
function stringSort(language, value, d) {
	return value[1].localeCompare(d[1], getLocale(language));
}
function numberSort(value, d) {
	return value[1] - d[1];
}
function booleanSort(value, d) {
	return d[1] ? -1 : 1;
}
function ensurePropertyIsSorted(sorter, prop) {
	const s = sorter.sorts[prop];
	let predicate;
	switch (s.type) {
		case "string":
			predicate = stringSort.bind(null, sorter.language);
			break;
		case "number":
			predicate = numberSort.bind(null);
			break;
		case "boolean": predicate = booleanSort.bind(null);
	}
	s.orderedDocs.sort(predicate);
	const orderedDocsLength = s.orderedDocs.length;
	for (let i = 0; i < orderedDocsLength; i++) {
		const docId = s.orderedDocs[i][0];
		s.docs.set(docId, i);
	}
}
function ensureOrderedDocsAreDeleted(sorter) {
	const properties = Object.keys(sorter.sorts);
	for (const prop of properties) ensureOrderedDocsAreDeletedByProperty(sorter, prop);
}
function ensureOrderedDocsAreDeletedByProperty(sorter, prop) {
	const s = sorter.sorts[prop];
	if (!s.orderedDocsToRemove.size) return;
	s.orderedDocs = s.orderedDocs.filter((doc) => !s.orderedDocsToRemove.has(doc[0]));
	s.orderedDocsToRemove.clear();
}
function remove(sorter, prop, id) {
	if (!sorter.enabled) return;
	const s = sorter.sorts[prop];
	const internalId = getInternalDocumentId(sorter.sharedInternalDocumentStore, id);
	if (!s.docs.get(internalId)) return;
	s.docs.delete(internalId);
	s.orderedDocsToRemove.set(internalId, true);
}
function sortBy(sorter, docIds, by) {
	if (!sorter.enabled) throw createError("SORT_DISABLED");
	const property = by.property;
	const isDesc = by.order === "DESC";
	const s = sorter.sorts[property];
	if (!s) throw createError("UNABLE_TO_SORT_ON_UNKNOWN_FIELD", property, sorter.sortableProperties.join(", "));
	ensureOrderedDocsAreDeletedByProperty(sorter, property);
	ensureIsSorted(sorter);
	docIds.sort((a, b) => {
		const indexOfA = s.docs.get(getInternalDocumentId(sorter.sharedInternalDocumentStore, a[0]));
		const indexOfB = s.docs.get(getInternalDocumentId(sorter.sharedInternalDocumentStore, b[0]));
		const isAIndexed = typeof indexOfA !== "undefined";
		const isBIndexed = typeof indexOfB !== "undefined";
		if (!isAIndexed && !isBIndexed) return 0;
		if (!isAIndexed) return 1;
		if (!isBIndexed) return -1;
		return isDesc ? indexOfB - indexOfA : indexOfA - indexOfB;
	});
	return docIds;
}
function getSortableProperties(sorter) {
	if (!sorter.enabled) return [];
	return sorter.sortableProperties;
}
function getSortablePropertiesWithTypes(sorter) {
	if (!sorter.enabled) return {};
	return sorter.sortablePropertiesWithTypes;
}
function load$1(sharedInternalDocumentStore, raw) {
	const rawDocument = raw;
	if (!rawDocument.enabled) return { enabled: false };
	const sorts = Object.keys(rawDocument.sorts).reduce((acc, prop) => {
		const { docs, orderedDocs, type } = rawDocument.sorts[prop];
		acc[prop] = {
			docs: new Map(Object.entries(docs).map(([k, v]) => [+k, v])),
			orderedDocsToRemove: /* @__PURE__ */ new Map(),
			orderedDocs,
			type
		};
		return acc;
	}, {});
	return {
		sharedInternalDocumentStore,
		language: rawDocument.language,
		sortableProperties: rawDocument.sortableProperties,
		sortablePropertiesWithTypes: rawDocument.sortablePropertiesWithTypes,
		sorts,
		enabled: true,
		isSorted: rawDocument.isSorted,
		unsortableProperties: rawDocument.unsortableProperties ?? []
	};
}
async function loadAsync(sharedInternalDocumentStore, raw) {
	const rawDocument = raw;
	if (!rawDocument.enabled) return { enabled: false };
	const sorts = {};
	const props = Object.keys(rawDocument.sorts);
	for (let i = 0; i < props.length; i++) {
		const prop = props[i];
		const { docs, orderedDocs, type } = rawDocument.sorts[prop];
		sorts[prop] = {
			docs: new Map(Object.entries(docs).map(([k, v]) => [+k, v])),
			orderedDocsToRemove: /* @__PURE__ */ new Map(),
			orderedDocs,
			type
		};
		if (i < props.length - 1) await yieldToEventLoop();
	}
	return {
		sharedInternalDocumentStore,
		language: rawDocument.language,
		sortableProperties: rawDocument.sortableProperties,
		sortablePropertiesWithTypes: rawDocument.sortablePropertiesWithTypes,
		sorts,
		enabled: true,
		isSorted: rawDocument.isSorted,
		unsortableProperties: rawDocument.unsortableProperties ?? []
	};
}
function save(sorter) {
	if (!sorter.enabled) return { enabled: false };
	ensureOrderedDocsAreDeleted(sorter);
	ensureIsSorted(sorter);
	const sorts = Object.keys(sorter.sorts).reduce((acc, prop) => {
		const { docs, orderedDocs, type } = sorter.sorts[prop];
		acc[prop] = {
			docs: Object.fromEntries(docs.entries()),
			orderedDocs,
			type
		};
		return acc;
	}, {});
	return {
		language: sorter.language,
		sortableProperties: sorter.sortableProperties,
		sortablePropertiesWithTypes: sorter.sortablePropertiesWithTypes,
		sorts,
		enabled: sorter.enabled,
		isSorted: sorter.isSorted,
		unsortableProperties: sorter.unsortableProperties ?? []
	};
}
function createSorter() {
	return {
		create: create$1,
		insert,
		remove,
		save,
		load: load$1,
		loadAsync,
		sortBy,
		getSortableProperties,
		getSortablePropertiesWithTypes
	};
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/tokenizer/diacritics.js
var DIACRITICS_CHARCODE_START = 192;
var DIACRITICS_CHARCODE_END = 383;
var CHARCODE_REPLACE_MAPPING = [
	65,
	65,
	65,
	65,
	65,
	65,
	65,
	67,
	69,
	69,
	69,
	69,
	73,
	73,
	73,
	73,
	69,
	78,
	79,
	79,
	79,
	79,
	79,
	null,
	79,
	85,
	85,
	85,
	85,
	89,
	80,
	115,
	97,
	97,
	97,
	97,
	97,
	97,
	97,
	99,
	101,
	101,
	101,
	101,
	105,
	105,
	105,
	105,
	101,
	110,
	111,
	111,
	111,
	111,
	111,
	null,
	111,
	117,
	117,
	117,
	117,
	121,
	112,
	121,
	65,
	97,
	65,
	97,
	65,
	97,
	67,
	99,
	67,
	99,
	67,
	99,
	67,
	99,
	68,
	100,
	68,
	100,
	69,
	101,
	69,
	101,
	69,
	101,
	69,
	101,
	69,
	101,
	71,
	103,
	71,
	103,
	71,
	103,
	71,
	103,
	72,
	104,
	72,
	104,
	73,
	105,
	73,
	105,
	73,
	105,
	73,
	105,
	73,
	105,
	73,
	105,
	74,
	106,
	75,
	107,
	107,
	76,
	108,
	76,
	108,
	76,
	108,
	76,
	108,
	76,
	108,
	78,
	110,
	78,
	110,
	78,
	110,
	110,
	78,
	110,
	79,
	111,
	79,
	111,
	79,
	111,
	79,
	111,
	82,
	114,
	82,
	114,
	82,
	114,
	83,
	115,
	83,
	115,
	83,
	115,
	83,
	115,
	84,
	116,
	84,
	116,
	84,
	116,
	85,
	117,
	85,
	117,
	85,
	117,
	85,
	117,
	85,
	117,
	85,
	117,
	87,
	119,
	89,
	121,
	89,
	90,
	122,
	90,
	122,
	90,
	122,
	115
];
var EXTRA_FOLDINGS = {
	1025: 1045,
	1105: 1077,
	1570: 1575,
	1571: 1575,
	1573: 1575,
	1649: 1575,
	1609: 1610
};
function replaceChar(charCode) {
	if (charCode < DIACRITICS_CHARCODE_START) return charCode;
	if (charCode <= DIACRITICS_CHARCODE_END)
 /* c8 ignore next  */
	return CHARCODE_REPLACE_MAPPING[charCode - DIACRITICS_CHARCODE_START] || charCode;
	return EXTRA_FOLDINGS[charCode] ?? charCode;
}
function replaceDiacritics(str) {
	const len = str.length;
	for (let idx = 0; idx < len; idx++) {
		const charCode = str.charCodeAt(idx);
		if (charCode < DIACRITICS_CHARCODE_START) continue;
		const replaced = replaceChar(charCode);
		if (replaced === charCode) continue;
		const codes = new Array(len);
		for (let j = 0; j < idx; j++) codes[j] = str.charCodeAt(j);
		codes[idx] = replaced;
		for (let j = idx + 1; j < len; j++) codes[j] = replaceChar(str.charCodeAt(j));
		return String.fromCharCode(...codes);
	}
	return str;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/tokenizer/english-stemmer.js
var step2List = {
	ational: "ate",
	tional: "tion",
	enci: "ence",
	anci: "ance",
	izer: "ize",
	bli: "ble",
	alli: "al",
	entli: "ent",
	eli: "e",
	ousli: "ous",
	ization: "ize",
	ation: "ate",
	ator: "ate",
	alism: "al",
	iveness: "ive",
	fulness: "ful",
	ousness: "ous",
	aliti: "al",
	iviti: "ive",
	biliti: "ble",
	logi: "log"
};
var step3List = {
	icate: "ic",
	ative: "",
	alize: "al",
	iciti: "ic",
	ical: "ic",
	ful: "",
	ness: ""
};
var v = "[aeiouy]";
var C = "[^aeiou][^aeiouy]*";
var V = v + "[aeiou]*";
var mgr0 = "^(" + C + ")?" + V + C;
var meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$";
var mgr1 = "^(" + C + ")?" + V + C + V + C;
var s_v = "^(" + C + ")?" + v;
function stemmer(w) {
	let stem;
	let suffix;
	let re;
	let re2;
	let re3;
	let re4;
	if (w.length < 3) return w;
	const firstch = w.substring(0, 1);
	if (firstch == "y") w = firstch.toUpperCase() + w.substring(1);
	re = /^(.+?)(ss|i)es$/;
	re2 = /^(.+?)([^s])s$/;
	if (re.test(w)) w = w.replace(re, "$1$2");
	else if (re2.test(w)) w = w.replace(re2, "$1$2");
	re = /^(.+?)eed$/;
	re2 = /^(.+?)(ed|ing)$/;
	if (re.test(w)) {
		const fp = re.exec(w);
		re = new RegExp(mgr0);
		if (re.test(fp[1])) {
			re = /.$/;
			w = w.replace(re, "");
		}
	} else if (re2.test(w)) {
		stem = re2.exec(w)[1];
		re2 = new RegExp(s_v);
		if (re2.test(stem)) {
			w = stem;
			re2 = /(at|bl|iz)$/;
			re3 = /* @__PURE__ */ new RegExp("([^aeiouylsz])\\1$");
			re4 = new RegExp("^" + C + v + "[^aeiouwxy]$");
			if (re2.test(w)) w = w + "e";
			else if (re3.test(w)) {
				re = /.$/;
				w = w.replace(re, "");
			} else if (re4.test(w)) w = w + "e";
		}
	}
	re = /^(.+?)y$/;
	if (re.test(w)) {
		stem = re.exec(w)?.[1];
		re = new RegExp(s_v);
		if (stem && re.test(stem)) w = stem + "i";
	}
	re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
	if (re.test(w)) {
		const fp = re.exec(w);
		stem = fp?.[1];
		suffix = fp?.[2];
		re = new RegExp(mgr0);
		if (stem && re.test(stem)) w = stem + step2List[suffix];
	}
	re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
	if (re.test(w)) {
		const fp = re.exec(w);
		stem = fp?.[1];
		suffix = fp?.[2];
		re = new RegExp(mgr0);
		if (stem && re.test(stem)) w = stem + step3List[suffix];
	}
	re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
	re2 = /^(.+?)(s|t)(ion)$/;
	if (re.test(w)) {
		stem = re.exec(w)?.[1];
		re = new RegExp(mgr1);
		if (stem && re.test(stem)) w = stem;
	} else if (re2.test(w)) {
		const fp = re2.exec(w);
		stem = (fp?.[1] ?? "") + (fp?.[2] ?? "");
		re2 = new RegExp(mgr1);
		if (re2.test(stem)) w = stem;
	}
	re = /^(.+?)e$/;
	if (re.test(w)) {
		stem = re.exec(w)?.[1];
		re = new RegExp(mgr1);
		re2 = new RegExp(meq1);
		re3 = new RegExp("^" + C + v + "[^aeiouwxy]$");
		if (stem && (re.test(stem) || re2.test(stem) && !re3.test(stem))) w = stem;
	}
	re = /ll$/;
	re2 = new RegExp(mgr1);
	if (re.test(w) && re2.test(w)) {
		re = /.$/;
		w = w.replace(re, "");
	}
	if (firstch == "y") w = firstch.toLowerCase() + w.substring(1);
	return w;
}
function cacheNormalizedToken(tokenizer, key, token) {
	const cache = tokenizer.normalizationCache;
	const maxSize = tokenizer.normalizationCacheSize ?? 5e4;
	if (maxSize <= 0) return;
	if (cache.size >= maxSize && !cache.has(key)) cache.delete(cache.keys().next().value);
	cache.set(key, token);
}
function normalizeToken(prop, token, withCache = true) {
	const property = prop ?? "";
	const key = `${this.language}:${property.length}:${property}:${token}`;
	if (withCache && this.normalizationCache.has(key)) return this.normalizationCache.get(key);
	if (!LANGUAGES_WITH_SIGNIFICANT_DIACRITICS.has(this.language)) token = replaceDiacritics(token);
	if (this.stopWordsSet?.has(token)) {
		if (withCache) cacheNormalizedToken(this, key, "");
		return "";
	}
	if (this.stemmer && !this.stemmerSkipProperties.has(property)) token = this.stemmer(token);
	if (withCache) cacheNormalizedToken(this, key, token);
	return token;
}
/* c8 ignore next 10 */
function trim(text) {
	while (text[text.length - 1] === "") text.pop();
	while (text[0] === "") text.shift();
	return text;
}
var UNICODE_WORD = /[\p{L}\p{M}\p{N}]+/gu;
var multilingualSegmenter;
function splitMultilingual(input) {
	if (multilingualSegmenter === void 0 && typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") multilingualSegmenter = new Intl.Segmenter(void 0, { granularity: "word" });
	if (multilingualSegmenter) {
		const parts = [];
		for (const { segment, isWordLike } of multilingualSegmenter.segment(input)) if (isWordLike) parts.push(segment.toLowerCase());
		return parts;
	}
	return input.toLowerCase().match(UNICODE_WORD) ?? [];
}
var EDGE_PUNCTUATION = /^['-]+|['-]+$/g;
function trimEdgePunctuation(part) {
	const first = part.charCodeAt(0);
	const last = part.charCodeAt(part.length - 1);
	if (first === 39 || first === 45 || last === 39 || last === 45) return part.replace(EDGE_PUNCTUATION, "");
	return part;
}
function tokenize(input, language, prop, withCache = true) {
	if (language && language !== this.language) throw createError("LANGUAGE_NOT_SUPPORTED", language);
	/* c8 ignore next 3 */
	if (typeof input !== "string") return [input];
	const property = prop ?? "";
	if (prop && this.tokenizeSkipProperties.has(prop)) {
		const token = this.normalizeToken(property, input, withCache);
		return token ? [token] : [];
	}
	const parts = this.language === "multilingual" ? splitMultilingual(input) : input.toLowerCase().split(SPLITTERS[this.language]);
	const tokens = [];
	const partsLength = parts.length;
	for (let i = 0; i < partsLength; i++) {
		const part = trimEdgePunctuation(parts[i]);
		if (!part) continue;
		const token = this.normalizeToken(property, part, withCache);
		if (token) tokens.push(token);
	}
	const trimTokens = trim(tokens);
	if (!this.allowDuplicates) return Array.from(new Set(trimTokens));
	return trimTokens;
}
function createTokenizer(config = {}) {
	if (!config.language) config.language = "english";
	else if (config.language !== "multilingual" && !SUPPORTED_LANGUAGES.includes(config.language)) throw createError("LANGUAGE_NOT_SUPPORTED", config.language);
	let stemmer$1;
	if (config.stemming || config.stemmer && !("stemming" in config)) {
		if (config.stemmer) {
			if (typeof config.stemmer !== "function") throw createError("INVALID_STEMMER_FUNCTION_TYPE");
			stemmer$1 = config.stemmer;
		} else if (config.language === "english") stemmer$1 = stemmer;
		else throw createError("MISSING_STEMMER", config.language);
	}
	if (config.normalizationCacheSize !== void 0 && (!Number.isInteger(config.normalizationCacheSize) || config.normalizationCacheSize < 0)) throw createError("INVALID_NORMALIZATION_CACHE_SIZE", String(config.normalizationCacheSize));
	let stopWords;
	if (config.stopWords !== false) {
		stopWords = [];
		if (Array.isArray(config.stopWords)) stopWords = config.stopWords;
		else if (typeof config.stopWords === "function") stopWords = config.stopWords(stopWords);
		else if (config.stopWords) throw createError("CUSTOM_STOP_WORDS_MUST_BE_FUNCTION_OR_ARRAY");
		if (!Array.isArray(stopWords)) throw createError("CUSTOM_STOP_WORDS_MUST_BE_FUNCTION_OR_ARRAY");
		for (const s of stopWords) if (typeof s !== "string") throw createError("CUSTOM_STOP_WORDS_MUST_BE_FUNCTION_OR_ARRAY");
	}
	const tokenizer = {
		tokenize,
		language: config.language,
		stemmer: stemmer$1,
		stemmerSkipProperties: new Set(config.stemmerSkipProperties ? [config.stemmerSkipProperties].flat() : []),
		tokenizeSkipProperties: new Set(config.tokenizeSkipProperties ? [config.tokenizeSkipProperties].flat() : []),
		stopWords,
		stopWordsSet: stopWords ? new Set(LANGUAGES_WITH_SIGNIFICANT_DIACRITICS.has(config.language) ? stopWords : stopWords.map(replaceDiacritics)) : void 0,
		allowDuplicates: config.allowDuplicates ?? true,
		normalizeToken,
		normalizationCache: /* @__PURE__ */ new Map(),
		normalizationCacheSize: config.normalizationCacheSize ?? 5e4
	};
	tokenizer.tokenize = tokenize.bind(tokenizer);
	tokenizer.normalizeToken = normalizeToken;
	return tokenizer;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/create.js
function validateComponents(components) {
	const defaultComponents = {
		formatElapsedTime,
		getDocumentIndexId,
		getDocumentProperties,
		validateSchema
	};
	for (const rawKey of FUNCTION_COMPONENTS) {
		const key = rawKey;
		if (components[key]) {
			if (typeof components[key] !== "function") throw createError("COMPONENT_MUST_BE_FUNCTION", key);
		} else components[key] = defaultComponents[key];
	}
	for (const rawKey of Object.keys(components)) if (!OBJECT_COMPONENTS.includes(rawKey) && !FUNCTION_COMPONENTS.includes(rawKey)) throw createError("UNSUPPORTED_COMPONENT", rawKey);
}
function create(args = {}) {
	const { indexes, sort, language, plugins } = args;
	let { id } = args;
	const schema = args.schema ?? {};
	const inferSchema = args.inferSchema ?? args.schema === void 0;
	let components = args.components;
	if (!components) components = {};
	for (const plugin of plugins ?? []) {
		if (!("getComponents" in plugin)) continue;
		if (typeof plugin.getComponents !== "function") continue;
		const pluginComponents = plugin.getComponents(schema);
		const keys = Object.keys(pluginComponents);
		for (const key of keys) if (components[key]) throw createError("PLUGIN_COMPONENT_CONFLICT", key, plugin.name);
		components = {
			...components,
			...pluginComponents
		};
	}
	if (!id) id = uniqueId();
	assertSchemaHasNoReservedKeys(schema);
	let tokenizer = components.tokenizer;
	let index = components.index;
	let documentsStore = components.documentsStore;
	let sorter = components.sorter;
	let pinning = components.pinning;
	if (!tokenizer) tokenizer = createTokenizer({ language: language ?? "english" });
	else if (!tokenizer.tokenize) tokenizer = createTokenizer(tokenizer);
	else tokenizer = tokenizer;
	if (components.tokenizer && language) throw createError("NO_LANGUAGE_WITH_CUSTOM_TOKENIZER");
	const internalDocumentStore = createInternalDocumentIDStore();
	index ||= createIndex();
	sorter ||= createSorter();
	documentsStore ||= createDocumentsStore();
	pinning ||= createPinning();
	validateComponents(components);
	const { getDocumentProperties, getDocumentIndexId, validateSchema, formatElapsedTime } = components;
	const zbsearch = {
		data: {},
		caches: {},
		schema,
		inferSchema,
		tokenizer,
		index,
		sorter,
		documentsStore,
		pinning,
		internalDocumentIDStore: internalDocumentStore,
		getDocumentProperties,
		getDocumentIndexId,
		validateSchema,
		beforeInsert: [],
		afterInsert: [],
		beforeRemove: [],
		afterRemove: [],
		beforeUpdate: [],
		afterUpdate: [],
		beforeUpsert: [],
		afterUpsert: [],
		beforeSearch: [],
		afterSearch: [],
		beforeInsertMultiple: [],
		afterInsertMultiple: [],
		beforeRemoveMultiple: [],
		afterRemoveMultiple: [],
		beforeUpdateMultiple: [],
		afterUpdateMultiple: [],
		beforeUpsertMultiple: [],
		afterUpsertMultiple: [],
		afterCreate: [],
		formatElapsedTime,
		id,
		indexes,
		plugins,
		version: getVersion()
	};
	zbsearch.data = {
		index: zbsearch.index.create(zbsearch, internalDocumentStore, schema),
		docs: zbsearch.documentsStore.create(zbsearch, internalDocumentStore),
		sorting: zbsearch.sorter.create(zbsearch, internalDocumentStore, schema, sort),
		pinning: zbsearch.pinning.create(internalDocumentStore)
	};
	for (const hook of AVAILABLE_PLUGIN_HOOKS) zbsearch[hook] = (zbsearch[hook] ?? []).concat(getAllPluginsByHook(zbsearch, hook));
	const afterCreate = zbsearch["afterCreate"];
	if (afterCreate) runAfterCreate(afterCreate, zbsearch);
	return zbsearch;
}
function getVersion() {
	return "{{VERSION}}";
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/docs.js
function getByID(db, id) {
	return db.documentsStore.get(db.data.docs, id);
}
function count(db) {
	return db.documentsStore.count(db.data.docs);
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/facets.js
function sortAsc(a, b) {
	return a[1] - b[1];
}
function sortDesc(a, b) {
	return b[1] - a[1];
}
function sortingPredicateBuilder(order = "desc") {
	return order.toLowerCase() === "asc" ? sortAsc : sortDesc;
}
function getValueAtPath(doc, pathParts) {
	let value = doc;
	for (let i = 0; i < pathParts.length; i++) {
		if (value === null || value === void 0 || typeof value !== "object") return;
		value = value[pathParts[i]];
	}
	return value;
}
function incrementNumberFacet(ranges, values, facetValue, alreadyInsertedValues) {
	for (let i = 0; i < ranges.length; i++) {
		const range = ranges[i];
		if (alreadyInsertedValues?.has(range.key)) continue;
		if (facetValue >= range.from && facetValue <= range.to) {
			const current = values[range.key];
			if (current === void 0) values[range.key] = 1;
			else {
				values[range.key] = current + 1;
				alreadyInsertedValues?.add(range.key);
			}
		}
	}
}
function incrementBooleanStringOrEnumFacet(values, propertyType, facetValue, alreadyInsertedValues) {
	const defaultValue = propertyType === "boolean" ? "false" : "";
	const value = facetValue?.toString() ?? defaultValue;
	if (alreadyInsertedValues?.has(value)) return;
	const current = values[value];
	values[value] = current === void 0 ? 1 : current + 1;
	alreadyInsertedValues?.add(value);
}
function prepareRangeValues(ranges) {
	const values = {};
	for (let i = 0; i < ranges.length; i++) {
		const range = ranges[i];
		values[`${range.from}-${range.to}`] = 0;
	}
	return values;
}
function prepareRanges(ranges) {
	const prepared = Array.from({ length: ranges.length });
	for (let i = 0; i < ranges.length; i++) {
		const range = ranges[i];
		prepared[i] = {
			from: range.from,
			to: range.to,
			key: `${range.from}-${range.to}`
		};
	}
	return prepared;
}
function prepareFacet(facet, facetsConfig, propertyType, pathParts) {
	const getFacetValue = pathParts ? (doc) => getValueAtPath(doc, pathParts) : (doc) => doc[facet];
	let values = {};
	let process;
	let finalize = () => values;
	switch (propertyType) {
		case "number": {
			const { ranges } = facetsConfig[facet];
			const preparedRanges = prepareRanges(ranges);
			values = prepareRangeValues(ranges);
			process = (doc) => {
				const facetValue = getFacetValue(doc);
				if (typeof facetValue === "number") incrementNumberFacet(preparedRanges, values, facetValue);
			};
			break;
		}
		case "number[]": {
			const { ranges } = facetsConfig[facet];
			const preparedRanges = prepareRanges(ranges);
			values = prepareRangeValues(ranges);
			process = (doc) => {
				const facetValue = getFacetValue(doc);
				if (!Array.isArray(facetValue)) return;
				const alreadyInsertedValues = /* @__PURE__ */ new Set();
				for (let i = 0; i < facetValue.length; i++) incrementNumberFacet(preparedRanges, values, facetValue[i], alreadyInsertedValues);
			};
			break;
		}
		case "boolean":
		case "enum":
		case "string": {
			const innerType = propertyType;
			process = (doc) => {
				const facetValue = getFacetValue(doc);
				incrementBooleanStringOrEnumFacet(values, innerType, facetValue);
			};
			if (propertyType === "string") {
				const stringFacetDefinition = facetsConfig[facet];
				const sortingPredicate = sortingPredicateBuilder(stringFacetDefinition.sort);
				const offset = stringFacetDefinition.offset ?? 0;
				const limit = stringFacetDefinition.limit ?? 10;
				finalize = () => Object.fromEntries(Object.entries(values).sort(sortingPredicate).slice(offset, offset + limit));
			}
			break;
		}
		case "boolean[]":
		case "enum[]":
		case "string[]": {
			const innerType = propertyType === "boolean[]" ? "boolean" : "string";
			process = (doc) => {
				const facetValue = getFacetValue(doc);
				if (!Array.isArray(facetValue)) return;
				const alreadyInsertedValues = /* @__PURE__ */ new Set();
				for (let i = 0; i < facetValue.length; i++) incrementBooleanStringOrEnumFacet(values, innerType, facetValue[i], alreadyInsertedValues);
			};
			break;
		}
		default: throw createError("FACET_NOT_SUPPORTED", propertyType);
	}
	return {
		values,
		process,
		finalize
	};
}
function getFacets(zbsearch, results, facetsConfig) {
	const facets = {};
	const facetKeys = Object.keys(facetsConfig);
	const properties = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
	const docs = zbsearch.data.docs.docs;
	const preparedFacets = Array.from({ length: facetKeys.length });
	for (let i = 0; i < facetKeys.length; i++) {
		const facet = facetKeys[i];
		const pathParts = facet.includes(".") ? facet.split(".") : null;
		preparedFacets[i] = prepareFacet(facet, facetsConfig, properties[facet], pathParts);
		facets[facet] = {
			count: 0,
			values: preparedFacets[i].values
		};
	}
	const resultsLength = results.length;
	for (let i = 0; i < resultsLength; i++) {
		const doc = docs[results[i][0]];
		if (!doc) continue;
		for (let j = 0; j < facetKeys.length; j++) preparedFacets[j].process(doc);
	}
	for (let i = 0; i < facetKeys.length; i++) {
		const facet = facetKeys[i];
		const preparedFacet = preparedFacets[i];
		facets[facet].count = Object.keys(preparedFacet.values).length;
		facets[facet].values = preparedFacet.finalize();
	}
	return facets;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/groups.js
var DEFAULT_REDUCE = {
	reducer: (_, acc, res, index) => {
		acc[index] = res;
		return acc;
	},
	getInitialValue: (length) => Array.from({ length })
};
var ALLOWED_TYPES = [
	"string",
	"number",
	"boolean"
];
function getGroups(zbsearch, results, groupBy) {
	const properties = groupBy.properties;
	const propertiesLength = properties.length;
	const schemaProperties = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
	for (let i = 0; i < propertiesLength; i++) {
		const property = properties[i];
		if (typeof schemaProperties[property] === "undefined") throw createError("UNKNOWN_GROUP_BY_PROPERTY", property);
		if (!ALLOWED_TYPES.includes(schemaProperties[property])) throw createError("INVALID_GROUP_BY_PROPERTY", property, ALLOWED_TYPES.join(", "), schemaProperties[property]);
	}
	const allIDs = results.map(([id]) => getDocumentIdFromInternalId(zbsearch.internalDocumentIDStore, id));
	const allDocs = zbsearch.documentsStore.getMultiple(zbsearch.data.docs, allIDs);
	const allDocsLength = allDocs.length;
	const returnedCount = groupBy.maxResult || Number.MAX_SAFE_INTEGER;
	const listOfValues = [];
	const g = {};
	for (let i = 0; i < propertiesLength; i++) {
		const groupByKey = properties[i];
		const group = {
			property: groupByKey,
			perValue: {}
		};
		const values = /* @__PURE__ */ new Set();
		for (let j = 0; j < allDocsLength; j++) {
			const doc = allDocs[j];
			const value = getNested(doc, groupByKey);
			if (typeof value === "undefined") continue;
			const keyValue = typeof value !== "boolean" ? value : "" + value;
			const perValue = group.perValue[keyValue] ?? {
				indexes: [],
				count: 0
			};
			if (perValue.count >= returnedCount) continue;
			perValue.indexes.push(j);
			perValue.count++;
			group.perValue[keyValue] = perValue;
			values.add(value);
		}
		listOfValues.push(Array.from(values));
		g[groupByKey] = group;
	}
	const combinations = calculateCombination(listOfValues);
	const combinationsLength = combinations.length;
	const groups = [];
	for (let i = 0; i < combinationsLength; i++) {
		const combination = combinations[i];
		const combinationLength = combination.length;
		const group = {
			values: [],
			indexes: []
		};
		const indexes = [];
		for (let j = 0; j < combinationLength; j++) {
			const value = combination[j];
			const property = properties[j];
			indexes.push(g[property].perValue[typeof value !== "boolean" ? value : "" + value].indexes);
			group.values.push(value);
		}
		group.indexes = intersect(indexes).sort((a, b) => a - b);
		if (group.indexes.length === 0) continue;
		groups.push(group);
	}
	const groupsLength = groups.length;
	const res = Array.from({ length: groupsLength });
	for (let i = 0; i < groupsLength; i++) {
		const group = groups[i];
		const reduce = groupBy.reduce || DEFAULT_REDUCE;
		const docs = group.indexes.map((index) => {
			return {
				id: allIDs[index],
				score: results[index][1],
				document: allDocs[index]
			};
		});
		const func = reduce.reducer.bind(null, group.values);
		const initialValue = reduce.getInitialValue(group.indexes.length);
		const aggregationValue = docs.reduce(func, initialValue);
		res[i] = {
			values: group.values,
			result: aggregationValue
		};
	}
	return res;
}
function calculateCombination(arrs, index = 0) {
	if (index + 1 === arrs.length) return arrs[index].map((item) => [item]);
	const head = arrs[index];
	const c = calculateCombination(arrs, index + 1);
	const combinations = [];
	for (const value of head) for (const combination of c) {
		const result = [value];
		safeArrayPush(result, combination);
		combinations.push(result);
	}
	return combinations;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/components/pinning-manager.js
/**
* Apply pinning rules to search results.
* This function modifies the uniqueDocsArray by:
* 1. Finding matching pin rules based on the search term
* 2. Inserting pinned documents at their specified positions
* 3. Assigning high scores to pinned documents to maintain their positions
*/
function applyPinningRules(zbsearch, pinningStore, uniqueDocsArray, searchTerm) {
	const matchingRules = getMatchingRules(pinningStore, searchTerm);
	if (matchingRules.length === 0) return uniqueDocsArray;
	const allPromotions = matchingRules.flatMap((rule) => rule.consequence.promote);
	allPromotions.sort((a, b) => a.position - b.position);
	const pinnedInternalIds = /* @__PURE__ */ new Set();
	const promotionsMap = /* @__PURE__ */ new Map();
	const positionsTaken = /* @__PURE__ */ new Set();
	for (const promotion of allPromotions) {
		const internalId = getInternalDocumentId(zbsearch.internalDocumentIDStore, promotion.doc_id);
		if (internalId === void 0) continue;
		if (promotionsMap.has(internalId)) {
			const existingPosition = promotionsMap.get(internalId);
			if (promotion.position < existingPosition) promotionsMap.set(internalId, promotion.position);
			continue;
		}
		if (positionsTaken.has(promotion.position)) continue;
		pinnedInternalIds.add(internalId);
		promotionsMap.set(internalId, promotion.position);
		positionsTaken.add(promotion.position);
	}
	if (promotionsMap.size === 0) return uniqueDocsArray;
	const originalScoresByInternalId = /* @__PURE__ */ new Map();
	for (const [id, score] of uniqueDocsArray) originalScoresByInternalId.set(id, score);
	const unpinnedResults = [];
	for (const entry of uniqueDocsArray) if (!pinnedInternalIds.has(entry[0])) unpinnedResults.push(entry);
	const BASE_PIN_SCORE = 1e6;
	const pinnedResults = [];
	for (const [internalId, position] of promotionsMap) if (originalScoresByInternalId.get(internalId) !== void 0) pinnedResults.push([internalId, BASE_PIN_SCORE - position]);
	else if (zbsearch.documentsStore.get(zbsearch.data.docs, internalId)) pinnedResults.push([internalId, 0]);
	pinnedResults.sort((a, b) => {
		return (promotionsMap.get(a[0]) ?? Infinity) - (promotionsMap.get(b[0]) ?? Infinity);
	});
	const finalResults = [];
	const pinnedByPosition = /* @__PURE__ */ new Map();
	for (const pinnedResult of pinnedResults) {
		const position = promotionsMap.get(pinnedResult[0]);
		pinnedByPosition.set(position, pinnedResult);
	}
	let unpinnedIndex = 0;
	let currentPosition = 0;
	while (currentPosition < unpinnedResults.length + pinnedResults.length) if (pinnedByPosition.has(currentPosition)) {
		finalResults.push(pinnedByPosition.get(currentPosition));
		currentPosition++;
	} else if (unpinnedIndex < unpinnedResults.length) {
		finalResults.push(unpinnedResults[unpinnedIndex]);
		unpinnedIndex++;
		currentPosition++;
	} else break;
	for (const [position, pinnedResult] of pinnedByPosition.entries()) if (position >= finalResults.length) finalResults.push(pinnedResult);
	return finalResults;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/fetch-documents.js
function fetchDocumentsWithDistinct(zbsearch, uniqueDocsArray, offset, limit, distinctOn) {
	const docs = zbsearch.data.docs;
	const values = /* @__PURE__ */ new Map();
	const results = [];
	const resultIDs = /* @__PURE__ */ new Set();
	const uniqueDocsArrayLength = uniqueDocsArray.length;
	let count = 0;
	for (let i = 0; i < uniqueDocsArrayLength; i++) {
		const idAndScore = uniqueDocsArray[i];
		if (typeof idAndScore === "undefined") continue;
		const [id, score] = idAndScore;
		if (resultIDs.has(id)) continue;
		const doc = zbsearch.documentsStore.get(docs, id);
		const value = getNested(doc, distinctOn);
		if (typeof value === "undefined" || values.has(value)) continue;
		values.set(value, true);
		count++;
		if (count <= offset) continue;
		results.push({
			id: getDocumentIdFromInternalId(zbsearch.internalDocumentIDStore, id),
			score,
			document: doc
		});
		resultIDs.add(id);
		if (count >= offset + limit) break;
	}
	return results;
}
function fetchDocuments(zbsearch, uniqueDocsArray, offset, limit) {
	const docs = zbsearch.data.docs;
	const results = [];
	const end = Math.min(offset + limit, uniqueDocsArray.length);
	for (let i = offset; i < end; i++) {
		const idAndScore = uniqueDocsArray[i];
		if (typeof idAndScore === "undefined") break;
		const [id, score] = idAndScore;
		const fullDoc = zbsearch.documentsStore.get(docs, id);
		results.push({
			id: getDocumentIdFromInternalId(zbsearch.internalDocumentIDStore, id),
			score,
			document: fullDoc
		});
	}
	return results;
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/search-fulltext.js
function getPropertiesToSearch(zbsearch, properties) {
	const index = zbsearch.data.index;
	let propertiesToSearch = zbsearch.caches["propertiesToSearch"];
	if (!propertiesToSearch) {
		const propertiesToSearchWithTypes = zbsearch.index.getSearchablePropertiesWithTypes(index);
		propertiesToSearch = zbsearch.index.getSearchableProperties(index);
		propertiesToSearch = propertiesToSearch.filter((prop) => propertiesToSearchWithTypes[prop].startsWith("string"));
		zbsearch.caches["propertiesToSearch"] = propertiesToSearch;
	}
	if (properties && properties !== "*") {
		for (const prop of properties) if (!propertiesToSearch.includes(prop)) throw createError("UNKNOWN_INDEX", prop, propertiesToSearch.join(", "));
		propertiesToSearch = propertiesToSearch.filter((prop) => properties.includes(prop));
	}
	return propertiesToSearch;
}
function innerFullTextSearch(zbsearch, params, language, precomputedWhereFiltersIDs) {
	const { term, properties } = params;
	const index = zbsearch.data.index;
	const propertiesToSearch = getPropertiesToSearch(zbsearch, properties);
	const hasFilters = Object.keys(params.where ?? {}).length > 0;
	let whereFiltersIDs = precomputedWhereFiltersIDs;
	if (hasFilters && whereFiltersIDs === void 0) whereFiltersIDs = zbsearch.index.searchByWhereClause(index, zbsearch.tokenizer, params.where, language);
	let uniqueDocsIDs;
	const threshold = params.threshold !== void 0 && params.threshold !== null ? params.threshold : 1;
	if (term || properties) {
		const docsCount = count(zbsearch);
		uniqueDocsIDs = zbsearch.index.search(index, term || "", zbsearch.tokenizer, language, propertiesToSearch, params.exact || false, params.tolerance || 0, params.boost || {}, applyDefault(params.relevance), docsCount, whereFiltersIDs, threshold, params.prefix);
		if (params.exact && term) {
			const exactRegexes = term.trim().split(/\s+/).map((searchTerm) => new RegExp(`\\b${escapeRegex(searchTerm)}\\b`));
			uniqueDocsIDs = uniqueDocsIDs.filter(([docId]) => {
				const doc = zbsearch.documentsStore.get(zbsearch.data.docs, docId);
				if (!doc) return false;
				for (const prop of propertiesToSearch) {
					const propValue = getPropValue(doc, prop);
					if (typeof propValue === "string") {
						if (exactRegexes.every((regex) => regex.test(propValue))) return true;
					}
				}
				return false;
			});
		}
	} else if (hasFilters) {
		const geoResults = searchByGeoWhereClause(index, params.where);
		if (geoResults) uniqueDocsIDs = geoResults;
		else uniqueDocsIDs = (whereFiltersIDs ? Array.from(whereFiltersIDs) : []).map((k) => [+k, 0]);
	} else uniqueDocsIDs = Object.keys(zbsearch.documentsStore.getAll(zbsearch.data.docs)).map((k) => [+k, 0]);
	return uniqueDocsIDs;
}
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getPropValue(obj, path) {
	const keys = path.split(".");
	let value = obj;
	for (const key of keys) if (value && typeof value === "object" && key in value) value = value[key];
	else return;
	return value;
}
function fullTextSearch(zbsearch, params, language) {
	const timeStart = getNanosecondsTime();
	function performSearchLogic() {
		const vectorProperties = Object.keys(zbsearch.data.index.vectorIndexes);
		const shouldCalculateFacets = params.facets && Object.keys(params.facets).length > 0;
		const { limit = 10, offset = 0, distinctOn, includeVectors = false } = params;
		const isPreflight = params.preflight === true;
		let uniqueDocsArray = innerFullTextSearch(zbsearch, params, language);
		if (params.sortBy) {
			if (typeof params.sortBy === "function") {
				const ids = uniqueDocsArray.map(([id]) => id);
				const docsWithIdAndScore = zbsearch.documentsStore.getMultiple(zbsearch.data.docs, ids).map((d, i) => [
					uniqueDocsArray[i][0],
					uniqueDocsArray[i][1],
					d
				]);
				docsWithIdAndScore.sort(params.sortBy);
				uniqueDocsArray = docsWithIdAndScore.map(([id, score]) => [id, score]);
			} else uniqueDocsArray = zbsearch.sorter.sortBy(zbsearch.data.sorting, uniqueDocsArray, params.sortBy).map(([id, score]) => [getInternalDocumentId(zbsearch.internalDocumentIDStore, id), score]);
		} else uniqueDocsArray = uniqueDocsArray.sort(sortTokenScorePredicate);
		uniqueDocsArray = applyPinningRules(zbsearch, zbsearch.data.pinning, uniqueDocsArray, params.term);
		let results;
		if (!isPreflight) results = distinctOn ? fetchDocumentsWithDistinct(zbsearch, uniqueDocsArray, offset, limit, distinctOn) : fetchDocuments(zbsearch, uniqueDocsArray, offset, limit);
		const searchResult = {
			elapsed: {
				formatted: "",
				raw: 0
			},
			hits: [],
			count: uniqueDocsArray.length
		};
		if (typeof results !== "undefined") {
			searchResult.hits = results.filter(Boolean);
			if (!includeVectors) removeVectorsFromHits(searchResult, vectorProperties);
		}
		if (shouldCalculateFacets) searchResult.facets = getFacets(zbsearch, uniqueDocsArray, params.facets);
		if (params.groupBy) searchResult.groups = getGroups(zbsearch, uniqueDocsArray, params.groupBy);
		searchResult.elapsed = zbsearch.formatElapsedTime(getNanosecondsTime() - timeStart);
		return searchResult;
	}
	async function executeSearchAsync() {
		if (zbsearch.beforeSearch) await runBeforeSearch(zbsearch.beforeSearch, zbsearch, params, language);
		const searchResult = performSearchLogic();
		if (zbsearch.afterSearch) await runAfterSearch(zbsearch.afterSearch, zbsearch, params, language, searchResult);
		return searchResult;
	}
	if (zbsearch.beforeSearch?.length || zbsearch.afterSearch?.length) return executeSearchAsync();
	return performSearchLogic();
}
var defaultBM25Params = Object.freeze({
	k: 1.2,
	b: .75,
	d: .5
});
function applyDefault(bm25Relevance) {
	return {
		k: bm25Relevance?.k ?? defaultBM25Params.k,
		b: bm25Relevance?.b ?? defaultBM25Params.b,
		d: bm25Relevance?.d ?? defaultBM25Params.d
	};
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/search-vector.js
function innerVectorSearch(zbsearch, params, language, precomputedWhereFiltersIDs) {
	const vector = params.vector;
	if (vector && (!("value" in vector) || !("property" in vector))) throw createError("INVALID_VECTOR_INPUT", Object.keys(vector).join(", "));
	const vectorIndex = zbsearch.data.index.vectorIndexes[vector.property];
	if (!vectorIndex) throw createError("UNKNOWN_VECTOR_PROPERTY", vector.property);
	const vectorSize = vectorIndex.node.size;
	if (vector?.value.length !== vectorSize) {
		if (vector?.property === void 0 || vector?.value.length === void 0) throw createError("INVALID_INPUT_VECTOR", "undefined", vectorSize, "undefined");
		throw createError("INVALID_INPUT_VECTOR", vector.property, vectorSize, vector.value.length);
	}
	const index = zbsearch.data.index;
	let whereFiltersIDs = precomputedWhereFiltersIDs;
	if (Object.keys(params.where ?? {}).length > 0 && whereFiltersIDs === void 0) whereFiltersIDs = zbsearch.index.searchByWhereClause(index, zbsearch.tokenizer, params.where, language);
	return vectorIndex.node.find(vector.value, params.similarity ?? .8, whereFiltersIDs);
}
function searchVector(zbsearch, params, language = "english") {
	const timeStart = getNanosecondsTime();
	function performSearchLogic() {
		let results = innerVectorSearch(zbsearch, params, language).sort(sortTokenScorePredicate);
		results = applyPinningRules(zbsearch, zbsearch.data.pinning, results, void 0);
		let facetsResults = [];
		if (params.facets && Object.keys(params.facets).length > 0) facetsResults = getFacets(zbsearch, results, params.facets);
		const vectorProperty = params.vector.property;
		const includeVectors = params.includeVectors ?? false;
		const limit = params.limit ?? 10;
		const offset = params.offset ?? 0;
		const hits = fetchDocuments(zbsearch, results, offset, limit).filter(Boolean);
		let groups = [];
		if (params.groupBy) groups = getGroups(zbsearch, results, params.groupBy);
		const elapsedTime = getNanosecondsTime() - timeStart;
		const searchResult = {
			count: results.length,
			hits,
			elapsed: {
				raw: Number(elapsedTime),
				formatted: formatNanoseconds(elapsedTime)
			},
			...facetsResults ? { facets: facetsResults } : {},
			...groups ? { groups } : {}
		};
		if (!includeVectors) removeVectorsFromHits(searchResult, [vectorProperty]);
		return searchResult;
	}
	async function executeSearchAsync() {
		if (zbsearch.beforeSearch) await runBeforeSearch(zbsearch.beforeSearch, zbsearch, params, language);
		const results = performSearchLogic();
		if (zbsearch.afterSearch) await runAfterSearch(zbsearch.afterSearch, zbsearch, params, language, results);
		return results;
	}
	if (zbsearch.beforeSearch?.length || zbsearch.afterSearch?.length) return executeSearchAsync();
	return performSearchLogic();
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/search-hybrid.js
function innerHybridSearch(zbsearch, params, language) {
	const hasFilters = Object.keys(params.where ?? {}).length > 0;
	let whereFiltersIDs;
	if (hasFilters) whereFiltersIDs = zbsearch.index.searchByWhereClause(zbsearch.data.index, zbsearch.tokenizer, params.where, language);
	const fullTextIDs = Boolean(params.term) || Boolean(params.properties) ? innerFullTextSearch(zbsearch, params, language, whereFiltersIDs) : [];
	const vectorIDs = innerVectorSearch(zbsearch, params, language, whereFiltersIDs);
	const hybridWeights = params.hybridWeights;
	return mergeAndRankResults(fullTextIDs, vectorIDs, params.term ?? "", hybridWeights);
}
function hybridSearch(zbsearch, params, language) {
	const timeStart = getNanosecondsTime();
	function performSearchLogic() {
		let uniqueTokenScores = innerHybridSearch(zbsearch, params, language);
		uniqueTokenScores = applyPinningRules(zbsearch, zbsearch.data.pinning, uniqueTokenScores, params.term);
		let facetsResults;
		if (params.facets && Object.keys(params.facets).length > 0) facetsResults = getFacets(zbsearch, uniqueTokenScores, params.facets);
		let groups;
		if (params.groupBy) groups = getGroups(zbsearch, uniqueTokenScores, params.groupBy);
		const offset = params.offset ?? 0;
		const limit = params.limit ?? 10;
		const results = fetchDocuments(zbsearch, uniqueTokenScores, offset, limit).filter(Boolean);
		const timeEnd = getNanosecondsTime();
		const returningResults = {
			count: uniqueTokenScores.length,
			elapsed: {
				raw: Number(timeEnd - timeStart),
				formatted: formatNanoseconds(timeEnd - timeStart)
			},
			hits: results,
			...facetsResults ? { facets: facetsResults } : {},
			...groups ? { groups } : {}
		};
		if (!(params.includeVectors ?? false)) removeVectorsFromHits(returningResults, Object.keys(zbsearch.data.index.vectorIndexes));
		return returningResults;
	}
	async function executeSearchAsync() {
		if (zbsearch.beforeSearch) await runBeforeSearch(zbsearch.beforeSearch, zbsearch, params, language);
		const results = performSearchLogic();
		if (zbsearch.afterSearch) await runAfterSearch(zbsearch.afterSearch, zbsearch, params, language, results);
		return results;
	}
	if (zbsearch.beforeSearch?.length || zbsearch.afterSearch?.length) return executeSearchAsync();
	return performSearchLogic();
}
function getMaxScore(results) {
	let max = 0;
	const resultsLength = results.length;
	for (let i = 0; i < resultsLength; i++) {
		const score = results[i][1];
		if (score > max) max = score;
	}
	return max;
}
function normalizeScore(score, maxScore) {
	return maxScore > 0 ? score / maxScore : 0;
}
function hybridScoreBuilder(textWeight, vectorWeight) {
	return (textScore, vectorScore) => textScore * textWeight + vectorScore * vectorWeight;
}
function mergeAndRankResults(textResults, vectorResults, query, hybridWeights) {
	const maxTextScore = getMaxScore(textResults);
	const maxVectorScore = getMaxScore(vectorResults);
	const { text: textWeight, vector: vectorWeight } = hybridWeights && typeof hybridWeights.text === "number" && typeof hybridWeights.vector === "number" ? hybridWeights : getQueryWeights(query);
	const mergedResults = /* @__PURE__ */ new Map();
	const textResultsLength = textResults.length;
	const hybridScore = hybridScoreBuilder(textWeight, vectorWeight);
	for (let i = 0; i < textResultsLength; i++) {
		const [id, score] = textResults[i];
		const hybridScoreValue = hybridScore(normalizeScore(score, maxTextScore), 0);
		mergedResults.set(id, hybridScoreValue);
	}
	const vectorResultsLength = vectorResults.length;
	for (let i = 0; i < vectorResultsLength; i++) {
		const [resultId, score] = vectorResults[i];
		const normalizedScore = normalizeScore(score, maxVectorScore);
		const existingRes = mergedResults.get(resultId) ?? 0;
		mergedResults.set(resultId, existingRes + hybridScore(0, normalizedScore));
	}
	return [...mergedResults].sort(sortTokenScorePredicate);
}
function getQueryWeights(query) {
	return {
		text: .5,
		vector: .5
	};
}
//#endregion
//#region ../node_modules/.pnpm/zbsearch@4.0.1/node_modules/zbsearch/dist/esm/methods/search.js
function search(zbsearch, params, language) {
	const mode = params.mode ?? "fulltext";
	if (mode === "fulltext") return fullTextSearch(zbsearch, params, language);
	if (mode === "vector") return searchVector(zbsearch, params);
	if (mode === "hybrid") return hybridSearch(zbsearch, params);
	throw createError("INVALID_SEARCH_MODE", mode);
}
function isChunkedRawData(data) {
	return typeof data === "object" && data !== null && typeof data.version === "number" && Array.isArray(data.chunks);
}
function isPlainRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function containerAt(root, path) {
	let node = root;
	const full = ["root", ...path];
	for (let i = 0; i < full.length - 1; i++) {
		const key = full[i];
		if (!isPlainRecord(node[key])) node[key] = {};
		node = node[key];
	}
	return {
		parent: node,
		key: full[full.length - 1]
	};
}
function beginPart(root, part) {
	const { parent, key } = containerAt(root, part.p);
	if (part.k === "value") return {
		parent,
		key,
		target: null
	};
	const target = part.k === "array" ? [] : {};
	parent[key] = target;
	return {
		parent,
		key,
		target
	};
}
function applyPiece(slot, part, piece) {
	if (part.k === "value") {
		slot.parent[slot.key] = piece;
		return;
	}
	if (part.k === "array") {
		const target = slot.target;
		for (const item of piece) target.push(item);
		return;
	}
	Object.assign(slot.target, piece);
}
function readHeader(data) {
	if (data.version !== 2) throw new TypeError(`unsupported chunked index version ${data.version}, this build understands 2`);
	if (!data.chunks.length) throw new TypeError("chunked index is empty");
	return JSON.parse(data.chunks[0]);
}
function fromChunkedRawData(data) {
	const header = readHeader(data);
	const root = {};
	let cursor = 1;
	for (const part of header.parts) {
		const slot = beginPart(root, part);
		for (let i = 0; i < part.n; i++) applyPiece(slot, part, JSON.parse(data.chunks[cursor++]));
	}
	return root["root"];
}
function load(zbsearch, raw) {
	const data = isChunkedRawData(raw) ? fromChunkedRawData(raw) : raw;
	zbsearch.internalDocumentIDStore.load(zbsearch, data.internalDocumentIDStore);
	zbsearch.data.index = zbsearch.index.load(zbsearch.internalDocumentIDStore, data.index, zbsearch.indexes);
	zbsearch.data.docs = zbsearch.documentsStore.load(zbsearch.internalDocumentIDStore, data.docs);
	zbsearch.data.sorting = zbsearch.sorter.load(zbsearch.internalDocumentIDStore, data.sorting);
	zbsearch.data.pinning = zbsearch.pinning.load(zbsearch.internalDocumentIDStore, data.pinning);
	zbsearch.tokenizer.language = data.language;
}
//#endregion
//#region ../node_modules/.pnpm/fumadocs-core@16.17.1_@mdx-_11ae55ae1af62cf101cec7ced32746d4/node_modules/fumadocs-core/dist/advanced-cJMxLDd5.js
async function searchSimple(db, query, params = {}, locale) {
	return (await search(db, {
		term: query,
		tolerance: 1,
		...params,
		boost: {
			title: 2,
			..."boost" in params ? params.boost : void 0
		},
		where: removeUndefined({
			locale: locale ? { eq: locale } : void 0,
			...params.where
		})
	})).hits.map((hit) => ({
		type: "page",
		content: hit.document.title,
		breadcrumbs: hit.document.breadcrumbs,
		id: hit.document.url,
		url: hit.document.url
	}));
}
async function searchAdvanced(db, query, tag = [], { mode = "fulltext", limit = 60, ...override } = {}, locale) {
	if (typeof tag === "string") tag = [tag];
	const params = {
		limit,
		mode,
		...override,
		where: removeUndefined({
			tags: tag.length > 0 ? { containsAll: tag } : void 0,
			locale: locale ? { eq: locale } : void 0,
			...override.where
		}),
		groupBy: {
			properties: ["page_id"],
			maxResult: 8,
			...override.groupBy
		},
		properties: mode === "fulltext" ? ["content"] : ["content", "embeddings"]
	};
	if (query.length > 0) params.term = query;
	const result = await search(db, params);
	const list = [];
	for (const item of result.groups ?? []) {
		if (list.length >= limit) break;
		const pageId = item.values[0];
		const page = getByID(db, pageId);
		if (!page) continue;
		list.push({
			id: pageId,
			type: "page",
			content: page.content,
			breadcrumbs: page.breadcrumbs,
			url: page.url
		});
		for (const hit of item.result) {
			if (list.length >= limit) break;
			if (hit.document.type === "page") continue;
			list.push({
				id: hit.document.id.toString(),
				content: hit.document.content,
				breadcrumbs: hit.document.breadcrumbs,
				type: hit.document.type,
				url: hit.document.url,
				table: hit.document.table
			});
		}
	}
	return list;
}
//#endregion
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

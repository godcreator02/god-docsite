import { t as __commonJSMin } from "./rolldown-runtime-B-lAHAz2.js";
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/base64.js
var require_base64 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
	/**
	* Encode an integer in the range of 0 to 63 to a single base 64 digit.
	*/
	exports.encode = function(number) {
		if (0 <= number && number < intToCharMap.length) return intToCharMap[number];
		throw new TypeError("Must be between 0 and 63: " + number);
	};
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/base64-vlq.js
var require_base64_vlq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var base64 = require_base64();
	var VLQ_BASE_SHIFT = 5;
	var VLQ_BASE = 32;
	var VLQ_BASE_MASK = 31;
	var VLQ_CONTINUATION_BIT = VLQ_BASE;
	/**
	* Converts from a two-complement value to a value where the sign bit is
	* placed in the least significant bit.  For example, as decimals:
	*   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
	*   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
	*/
	function toVLQSigned(aValue) {
		return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
	}
	/**
	* Returns the base 64 VLQ encoded value.
	*/
	exports.encode = function base64VLQ_encode(aValue) {
		let encoded = "";
		let digit;
		let vlq = toVLQSigned(aValue);
		do {
			digit = vlq & VLQ_BASE_MASK;
			vlq >>>= VLQ_BASE_SHIFT;
			if (vlq > 0) digit |= VLQ_CONTINUATION_BIT;
			encoded += base64.encode(digit);
		} while (vlq > 0);
		return encoded;
	};
}));
//#endregion
//#region browser-external:url
var require_browser_external_url = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = Object.create(new Proxy({}, { get(_, key) {
		if (key !== "__esModule" && key !== "__proto__" && key !== "constructor" && key !== "splice") console.warn(`Module "url" has been externalized for browser compatibility. Cannot access "url.${key}" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.`);
	} }));
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/url.js
var require_url = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof URL === "function" ? URL : require_browser_external_url().URL;
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/util.js
var require_util = /* @__PURE__ */ __commonJSMin(((exports) => {
	var URL = require_url();
	/**
	* This is a helper function for getting values from parameter/options
	* objects.
	*
	* @param args The object we are extracting values from
	* @param name The name of the property we are getting.
	* @param defaultValue An optional value to return if the property is missing
	* from the object. If this is not specified and the property is missing, an
	* error will be thrown.
	*/
	function getArg(aArgs, aName, aDefaultValue) {
		if (aName in aArgs) return aArgs[aName];
		else if (arguments.length === 3) return aDefaultValue;
		throw new Error("\"" + aName + "\" is a required argument.");
	}
	exports.getArg = getArg;
	var supportsNullProto = (function() {
		return !("__proto__" in Object.create(null));
	})();
	function identity(s) {
		return s;
	}
	/**
	* Because behavior goes wacky when you set `__proto__` on objects, we
	* have to prefix all the strings in our set with an arbitrary character.
	*
	* See https://github.com/mozilla/source-map/pull/31 and
	* https://github.com/mozilla/source-map/issues/30
	*
	* @param String aStr
	*/
	function toSetString(aStr) {
		if (isProtoString(aStr)) return "$" + aStr;
		return aStr;
	}
	exports.toSetString = supportsNullProto ? identity : toSetString;
	function fromSetString(aStr) {
		if (isProtoString(aStr)) return aStr.slice(1);
		return aStr;
	}
	exports.fromSetString = supportsNullProto ? identity : fromSetString;
	function isProtoString(s) {
		if (!s) return false;
		const length = s.length;
		if (length < 9) return false;
		if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) return false;
		for (let i = length - 10; i >= 0; i--) if (s.charCodeAt(i) !== 36) return false;
		return true;
	}
	function strcmp(aStr1, aStr2) {
		if (aStr1 === aStr2) return 0;
		if (aStr1 === null) return 1;
		if (aStr2 === null) return -1;
		if (aStr1 > aStr2) return 1;
		return -1;
	}
	/**
	* Comparator between two mappings with inflated source and name strings where
	* the generated positions are compared.
	*/
	function compareByGeneratedPositionsInflated(mappingA, mappingB) {
		let cmp = mappingA.generatedLine - mappingB.generatedLine;
		if (cmp !== 0) return cmp;
		cmp = mappingA.generatedColumn - mappingB.generatedColumn;
		if (cmp !== 0) return cmp;
		cmp = strcmp(mappingA.source, mappingB.source);
		if (cmp !== 0) return cmp;
		cmp = mappingA.originalLine - mappingB.originalLine;
		if (cmp !== 0) return cmp;
		cmp = mappingA.originalColumn - mappingB.originalColumn;
		if (cmp !== 0) return cmp;
		return strcmp(mappingA.name, mappingB.name);
	}
	exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
	/**
	* Strip any JSON XSSI avoidance prefix from the string (as documented
	* in the source maps specification), and then parse the string as
	* JSON.
	*/
	function parseSourceMapInput(str) {
		return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
	}
	exports.parseSourceMapInput = parseSourceMapInput;
	var PROTOCOL_AND_HOST = `http://host`;
	/**
	* Make it easy to create small utilities that tweak a URL's path.
	*/
	function createSafeHandler(cb) {
		return (input) => {
			const type = getURLType(input);
			const base = buildSafeBase(input);
			const url = new URL(input, base);
			cb(url);
			const result = url.toString();
			if (type === "absolute") return result;
			else if (type === "scheme-relative") return result.slice(5);
			else if (type === "path-absolute") return result.slice(PROTOCOL_AND_HOST.length);
			return computeRelativeURL(base, result);
		};
	}
	function withBase(url, base) {
		return new URL(url, base).toString();
	}
	function buildUniqueSegment(prefix, str) {
		let id = 0;
		do {
			const ident = prefix + id++;
			if (str.indexOf(ident) === -1) return ident;
		} while (true);
	}
	function buildSafeBase(str) {
		const maxDotParts = str.split("..").length - 1;
		const segment = buildUniqueSegment("p", str);
		let base = `${PROTOCOL_AND_HOST}/`;
		for (let i = 0; i < maxDotParts; i++) base += `${segment}/`;
		return base;
	}
	var ABSOLUTE_SCHEME = /^[A-Za-z0-9\+\-\.]+:/;
	function getURLType(url) {
		if (url[0] === "/") {
			if (url[1] === "/") return "scheme-relative";
			return "path-absolute";
		}
		return ABSOLUTE_SCHEME.test(url) ? "absolute" : "path-relative";
	}
	/**
	* Given two URLs that are assumed to be on the same
	* protocol/host/user/password build a relative URL from the
	* path, params, and hash values.
	*
	* @param rootURL The root URL that the target will be relative to.
	* @param targetURL The target that the relative URL points to.
	* @return A rootURL-relative, normalized URL value.
	*/
	function computeRelativeURL(rootURL, targetURL) {
		if (typeof rootURL === "string") rootURL = new URL(rootURL);
		if (typeof targetURL === "string") targetURL = new URL(targetURL);
		const targetParts = targetURL.pathname.split("/");
		const rootParts = rootURL.pathname.split("/");
		if (rootParts.length > 0 && !rootParts[rootParts.length - 1]) rootParts.pop();
		while (targetParts.length > 0 && rootParts.length > 0 && targetParts[0] === rootParts[0]) {
			targetParts.shift();
			rootParts.shift();
		}
		return rootParts.map(() => "..").concat(targetParts).join("/") + targetURL.search + targetURL.hash;
	}
	/**
	* Given a URL, ensure that it is treated as a directory URL.
	*
	* @param url
	* @return A normalized URL value.
	*/
	var ensureDirectory = createSafeHandler((url) => {
		url.pathname = url.pathname.replace(/\/?$/, "/");
	});
	/**
	* Given a URL, strip off any filename if one is present.
	*
	* @param url
	* @return A normalized URL value.
	*/
	var trimFilename = createSafeHandler((url) => {
		url.href = new URL(".", url.toString()).toString();
	});
	/**
	* Normalize a given URL.
	* * Convert backslashes.
	* * Remove any ".." and "." segments.
	*
	* @param url
	* @return A normalized URL value.
	*/
	var normalize = createSafeHandler((url) => {});
	exports.normalize = normalize;
	/**
	* Joins two paths/URLs.
	*
	* All returned URLs will be normalized.
	*
	* @param aRoot The root path or URL. Assumed to reference a directory.
	* @param aPath The path or URL to be joined with the root.
	* @return A joined and normalized URL value.
	*/
	function join(aRoot, aPath) {
		const pathType = getURLType(aPath);
		const rootType = getURLType(aRoot);
		aRoot = ensureDirectory(aRoot);
		if (pathType === "absolute") return withBase(aPath, void 0);
		if (rootType === "absolute") return withBase(aPath, aRoot);
		if (pathType === "scheme-relative") return normalize(aPath);
		if (rootType === "scheme-relative") return withBase(aPath, withBase(aRoot, PROTOCOL_AND_HOST)).slice(5);
		if (pathType === "path-absolute") return normalize(aPath);
		if (rootType === "path-absolute") return withBase(aPath, withBase(aRoot, PROTOCOL_AND_HOST)).slice(PROTOCOL_AND_HOST.length);
		const base = buildSafeBase(aPath + aRoot);
		return computeRelativeURL(base, withBase(aPath, withBase(aRoot, base)));
	}
	exports.join = join;
	/**
	* Make a path relative to a URL or another path. If returning a
	* relative URL is not possible, the original target will be returned.
	* All returned URLs will be normalized.
	*
	* @param aRoot The root path or URL.
	* @param aPath The path or URL to be made relative to aRoot.
	* @return A rootURL-relative (if possible), normalized URL value.
	*/
	function relative(rootURL, targetURL) {
		const result = relativeIfPossible(rootURL, targetURL);
		return typeof result === "string" ? result : normalize(targetURL);
	}
	exports.relative = relative;
	function relativeIfPossible(rootURL, targetURL) {
		if (getURLType(rootURL) !== getURLType(targetURL)) return null;
		const base = buildSafeBase(rootURL + targetURL);
		const root = new URL(rootURL, base);
		const target = new URL(targetURL, base);
		try {
			new URL("", target.toString());
		} catch (err) {
			return null;
		}
		if (target.protocol !== root.protocol || target.user !== root.user || target.password !== root.password || target.hostname !== root.hostname || target.port !== root.port) return null;
		return computeRelativeURL(root, target);
	}
	/**
	* Compute the URL of a source given the the source root, the source's
	* URL, and the source map's URL.
	*/
	function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
		if (sourceRoot && getURLType(sourceURL) === "path-absolute") sourceURL = sourceURL.replace(/^\//, "");
		let url = normalize(sourceURL || "");
		if (sourceRoot) url = join(sourceRoot, url);
		if (sourceMapURL) url = join(trimFilename(sourceMapURL), url);
		return url;
	}
	exports.computeSourceURL = computeSourceURL;
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/array-set.js
var require_array_set = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.ArraySet = class ArraySet {
		constructor() {
			this._array = [];
			this._set = /* @__PURE__ */ new Map();
		}
		/**
		* Static method for creating ArraySet instances from an existing array.
		*/
		static fromArray(aArray, aAllowDuplicates) {
			const set = new ArraySet();
			for (let i = 0, len = aArray.length; i < len; i++) set.add(aArray[i], aAllowDuplicates);
			return set;
		}
		/**
		* Return how many unique items are in this ArraySet. If duplicates have been
		* added, than those do not count towards the size.
		*
		* @returns Number
		*/
		size() {
			return this._set.size;
		}
		/**
		* Add the given string to this set.
		*
		* @param String aStr
		*/
		add(aStr, aAllowDuplicates) {
			const isDuplicate = this.has(aStr);
			const idx = this._array.length;
			if (!isDuplicate || aAllowDuplicates) this._array.push(aStr);
			if (!isDuplicate) this._set.set(aStr, idx);
		}
		/**
		* Is the given string a member of this set?
		*
		* @param String aStr
		*/
		has(aStr) {
			return this._set.has(aStr);
		}
		/**
		* What is the index of the given string in the array?
		*
		* @param String aStr
		*/
		indexOf(aStr) {
			const idx = this._set.get(aStr);
			if (idx >= 0) return idx;
			throw new Error("\"" + aStr + "\" is not in the set.");
		}
		/**
		* What is the element at the given index?
		*
		* @param Number aIdx
		*/
		at(aIdx) {
			if (aIdx >= 0 && aIdx < this._array.length) return this._array[aIdx];
			throw new Error("No element indexed by " + aIdx);
		}
		/**
		* Returns the array representation of this set (which has the proper indices
		* indicated by indexOf). Note that this is a copy of the internal array used
		* for storing the members so that no one can mess with internal state.
		*/
		toArray() {
			return this._array.slice();
		}
	};
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/mapping-list.js
var require_mapping_list = /* @__PURE__ */ __commonJSMin(((exports) => {
	var util = require_util();
	/**
	* Determine whether mappingB is after mappingA with respect to generated
	* position.
	*/
	function generatedPositionAfter(mappingA, mappingB) {
		const lineA = mappingA.generatedLine;
		const lineB = mappingB.generatedLine;
		const columnA = mappingA.generatedColumn;
		const columnB = mappingB.generatedColumn;
		return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
	}
	/**
	* A data structure to provide a sorted view of accumulated mappings in a
	* performance conscious manner. It trades a negligible overhead in general
	* case for a large speedup in case of mappings being added in order.
	*/
	var MappingList = class {
		constructor() {
			this._array = [];
			this._sorted = true;
			this._last = {
				generatedLine: -1,
				generatedColumn: 0
			};
		}
		/**
		* Iterate through internal items. This method takes the same arguments that
		* `Array.prototype.forEach` takes.
		*
		* NOTE: The order of the mappings is NOT guaranteed.
		*/
		unsortedForEach(aCallback, aThisArg) {
			this._array.forEach(aCallback, aThisArg);
		}
		/**
		* Add the given source mapping.
		*
		* @param Object aMapping
		*/
		add(aMapping) {
			if (generatedPositionAfter(this._last, aMapping)) {
				this._last = aMapping;
				this._array.push(aMapping);
			} else {
				this._sorted = false;
				this._array.push(aMapping);
			}
		}
		/**
		* Returns the flat, sorted array of mappings. The mappings are sorted by
		* generated position.
		*
		* WARNING: This method returns internal data without copying, for
		* performance. The return value must NOT be mutated, and should be treated as
		* an immutable borrow. If you want to take ownership, you must make your own
		* copy.
		*/
		toArray() {
			if (!this._sorted) {
				this._array.sort(util.compareByGeneratedPositionsInflated);
				this._sorted = true;
			}
			return this._array;
		}
	};
	exports.MappingList = MappingList;
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/source-map-generator.js
var require_source_map_generator = /* @__PURE__ */ __commonJSMin(((exports) => {
	var base64VLQ = require_base64_vlq();
	var util = require_util();
	var ArraySet = require_array_set().ArraySet;
	var MappingList = require_mapping_list().MappingList;
	/**
	* An instance of the SourceMapGenerator represents a source map which is
	* being built incrementally. You may pass an object with the following
	* properties:
	*
	*   - file: The filename of the generated source.
	*   - sourceRoot: A root for all relative URLs in this source map.
	*/
	var SourceMapGenerator = class SourceMapGenerator {
		constructor(aArgs) {
			if (!aArgs) aArgs = {};
			this._file = util.getArg(aArgs, "file", null);
			this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
			this._skipValidation = util.getArg(aArgs, "skipValidation", false);
			this._sources = new ArraySet();
			this._names = new ArraySet();
			this._mappings = new MappingList();
			this._sourcesContents = null;
		}
		/**
		* Creates a new SourceMapGenerator based on a SourceMapConsumer
		*
		* @param aSourceMapConsumer The SourceMap.
		*/
		static fromSourceMap(aSourceMapConsumer) {
			const sourceRoot = aSourceMapConsumer.sourceRoot;
			const generator = new SourceMapGenerator({
				file: aSourceMapConsumer.file,
				sourceRoot
			});
			aSourceMapConsumer.eachMapping(function(mapping) {
				const newMapping = { generated: {
					line: mapping.generatedLine,
					column: mapping.generatedColumn
				} };
				if (mapping.source != null) {
					newMapping.source = mapping.source;
					if (sourceRoot != null) newMapping.source = util.relative(sourceRoot, newMapping.source);
					newMapping.original = {
						line: mapping.originalLine,
						column: mapping.originalColumn
					};
					if (mapping.name != null) newMapping.name = mapping.name;
				}
				generator.addMapping(newMapping);
			});
			aSourceMapConsumer.sources.forEach(function(sourceFile) {
				let sourceRelative = sourceFile;
				if (sourceRoot != null) sourceRelative = util.relative(sourceRoot, sourceFile);
				if (!generator._sources.has(sourceRelative)) generator._sources.add(sourceRelative);
				const content = aSourceMapConsumer.sourceContentFor(sourceFile);
				if (content != null) generator.setSourceContent(sourceFile, content);
			});
			return generator;
		}
		/**
		* Add a single mapping from original source line and column to the generated
		* source's line and column for this source map being created. The mapping
		* object should have the following properties:
		*
		*   - generated: An object with the generated line and column positions.
		*   - original: An object with the original line and column positions.
		*   - source: The original source file (relative to the sourceRoot).
		*   - name: An optional original token name for this mapping.
		*/
		addMapping(aArgs) {
			const generated = util.getArg(aArgs, "generated");
			const original = util.getArg(aArgs, "original", null);
			let source = util.getArg(aArgs, "source", null);
			let name = util.getArg(aArgs, "name", null);
			if (!this._skipValidation) this._validateMapping(generated, original, source, name);
			if (source != null) {
				source = String(source);
				if (!this._sources.has(source)) this._sources.add(source);
			}
			if (name != null) {
				name = String(name);
				if (!this._names.has(name)) this._names.add(name);
			}
			this._mappings.add({
				generatedLine: generated.line,
				generatedColumn: generated.column,
				originalLine: original && original.line,
				originalColumn: original && original.column,
				source,
				name
			});
		}
		/**
		* Set the source content for a source file.
		*/
		setSourceContent(aSourceFile, aSourceContent) {
			let source = aSourceFile;
			if (this._sourceRoot != null) source = util.relative(this._sourceRoot, source);
			if (aSourceContent != null) {
				if (!this._sourcesContents) this._sourcesContents = Object.create(null);
				this._sourcesContents[util.toSetString(source)] = aSourceContent;
			} else if (this._sourcesContents) {
				delete this._sourcesContents[util.toSetString(source)];
				if (Object.keys(this._sourcesContents).length === 0) this._sourcesContents = null;
			}
		}
		/**
		* Applies the mappings of a sub-source-map for a specific source file to the
		* source map being generated. Each mapping to the supplied source file is
		* rewritten using the supplied source map. Note: The resolution for the
		* resulting mappings is the minimium of this map and the supplied map.
		*
		* @param aSourceMapConsumer The source map to be applied.
		* @param aSourceFile Optional. The filename of the source file.
		*        If omitted, SourceMapConsumer's file property will be used.
		* @param aSourceMapPath Optional. The dirname of the path to the source map
		*        to be applied. If relative, it is relative to the SourceMapConsumer.
		*        This parameter is needed when the two source maps aren't in the same
		*        directory, and the source map to be applied contains relative source
		*        paths. If so, those relative source paths need to be rewritten
		*        relative to the SourceMapGenerator.
		*/
		applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
			let sourceFile = aSourceFile;
			if (aSourceFile == null) {
				if (aSourceMapConsumer.file == null) throw new Error("SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's \"file\" property. Both were omitted.");
				sourceFile = aSourceMapConsumer.file;
			}
			const sourceRoot = this._sourceRoot;
			if (sourceRoot != null) sourceFile = util.relative(sourceRoot, sourceFile);
			const newSources = this._mappings.toArray().length > 0 ? new ArraySet() : this._sources;
			const newNames = new ArraySet();
			this._mappings.unsortedForEach(function(mapping) {
				if (mapping.source === sourceFile && mapping.originalLine != null) {
					const original = aSourceMapConsumer.originalPositionFor({
						line: mapping.originalLine,
						column: mapping.originalColumn
					});
					if (original.source != null) {
						mapping.source = original.source;
						if (aSourceMapPath != null) mapping.source = util.join(aSourceMapPath, mapping.source);
						if (sourceRoot != null) mapping.source = util.relative(sourceRoot, mapping.source);
						mapping.originalLine = original.line;
						mapping.originalColumn = original.column;
						if (original.name != null) mapping.name = original.name;
					}
				}
				const source = mapping.source;
				if (source != null && !newSources.has(source)) newSources.add(source);
				const name = mapping.name;
				if (name != null && !newNames.has(name)) newNames.add(name);
			}, this);
			this._sources = newSources;
			this._names = newNames;
			aSourceMapConsumer.sources.forEach(function(srcFile) {
				const content = aSourceMapConsumer.sourceContentFor(srcFile);
				if (content != null) {
					if (aSourceMapPath != null) srcFile = util.join(aSourceMapPath, srcFile);
					if (sourceRoot != null) srcFile = util.relative(sourceRoot, srcFile);
					this.setSourceContent(srcFile, content);
				}
			}, this);
		}
		/**
		* A mapping can have one of the three levels of data:
		*
		*   1. Just the generated position.
		*   2. The Generated position, original position, and original source.
		*   3. Generated and original position, original source, as well as a name
		*      token.
		*
		* To maintain consistency, we validate that any new mapping being added falls
		* in to one of these categories.
		*/
		_validateMapping(aGenerated, aOriginal, aSource, aName) {
			if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") throw new Error("original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values.");
			if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {} else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {} else throw new Error("Invalid mapping: " + JSON.stringify({
				generated: aGenerated,
				source: aSource,
				original: aOriginal,
				name: aName
			}));
		}
		/**
		* Serialize the accumulated mappings in to the stream of base 64 VLQs
		* specified by the source map format.
		*/
		_serializeMappings() {
			let previousGeneratedColumn = 0;
			let previousGeneratedLine = 1;
			let previousOriginalColumn = 0;
			let previousOriginalLine = 0;
			let previousName = 0;
			let previousSource = 0;
			let result = "";
			let next;
			let mapping;
			let nameIdx;
			let sourceIdx;
			const mappings = this._mappings.toArray();
			for (let i = 0, len = mappings.length; i < len; i++) {
				mapping = mappings[i];
				next = "";
				if (mapping.generatedLine !== previousGeneratedLine) {
					previousGeneratedColumn = 0;
					while (mapping.generatedLine !== previousGeneratedLine) {
						next += ";";
						previousGeneratedLine++;
					}
				} else if (i > 0) {
					if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) continue;
					next += ",";
				}
				next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
				previousGeneratedColumn = mapping.generatedColumn;
				if (mapping.source != null) {
					sourceIdx = this._sources.indexOf(mapping.source);
					next += base64VLQ.encode(sourceIdx - previousSource);
					previousSource = sourceIdx;
					next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
					previousOriginalLine = mapping.originalLine - 1;
					next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
					previousOriginalColumn = mapping.originalColumn;
					if (mapping.name != null) {
						nameIdx = this._names.indexOf(mapping.name);
						next += base64VLQ.encode(nameIdx - previousName);
						previousName = nameIdx;
					}
				}
				result += next;
			}
			return result;
		}
		_generateSourcesContent(aSources, aSourceRoot) {
			return aSources.map(function(source) {
				if (!this._sourcesContents) return null;
				if (aSourceRoot != null) source = util.relative(aSourceRoot, source);
				const key = util.toSetString(source);
				return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
			}, this);
		}
		/**
		* Externalize the source map.
		*/
		toJSON() {
			const map = {
				version: this._version,
				sources: this._sources.toArray(),
				names: this._names.toArray(),
				mappings: this._serializeMappings()
			};
			if (this._file != null) map.file = this._file;
			if (this._sourceRoot != null) map.sourceRoot = this._sourceRoot;
			if (this._sourcesContents) map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
			return map;
		}
		/**
		* Render the source map being generated to a string.
		*/
		toString() {
			return JSON.stringify(this.toJSON());
		}
	};
	SourceMapGenerator.prototype._version = 3;
	exports.SourceMapGenerator = SourceMapGenerator;
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/binary-search.js
var require_binary_search = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.GREATEST_LOWER_BOUND = 1;
	exports.LEAST_UPPER_BOUND = 2;
	/**
	* Recursive implementation of binary search.
	*
	* @param aLow Indices here and lower do not contain the needle.
	* @param aHigh Indices here and higher do not contain the needle.
	* @param aNeedle The element being searched for.
	* @param aHaystack The non-empty array being searched.
	* @param aCompare Function which takes two elements and returns -1, 0, or 1.
	* @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
	*     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
	*     closest element that is smaller than or greater than the one we are
	*     searching for, respectively, if the exact element cannot be found.
	*/
	function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
		const mid = Math.floor((aHigh - aLow) / 2) + aLow;
		const cmp = aCompare(aNeedle, aHaystack[mid], true);
		if (cmp === 0) return mid;
		else if (cmp > 0) {
			if (aHigh - mid > 1) return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
			if (aBias === exports.LEAST_UPPER_BOUND) return aHigh < aHaystack.length ? aHigh : -1;
			return mid;
		}
		if (mid - aLow > 1) return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
		if (aBias == exports.LEAST_UPPER_BOUND) return mid;
		return aLow < 0 ? -1 : aLow;
	}
	/**
	* This is an implementation of binary search which will always try and return
	* the index of the closest element if there is no exact hit. This is because
	* mappings between original and generated line/col pairs are single points,
	* and there is an implicit region between each of them, so a miss just means
	* that you aren't on the very start of a region.
	*
	* @param aNeedle The element you are looking for.
	* @param aHaystack The array that is being searched.
	* @param aCompare A function which takes the needle and an element in the
	*     array and returns -1, 0, or 1 depending on whether the needle is less
	*     than, equal to, or greater than the element, respectively.
	* @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
	*     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
	*     closest element that is smaller than or greater than the one we are
	*     searching for, respectively, if the exact element cannot be found.
	*     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
	*/
	exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
		if (aHaystack.length === 0) return -1;
		let index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare, aBias || exports.GREATEST_LOWER_BOUND);
		if (index < 0) return -1;
		while (index - 1 >= 0) {
			if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) break;
			--index;
		}
		return index;
	};
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/read-wasm-browser.js
var require_read_wasm_browser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var mappingsWasm = null;
	module.exports = function readWasm() {
		if (typeof mappingsWasm === "string") return fetch(mappingsWasm).then((response) => response.arrayBuffer());
		if (mappingsWasm instanceof ArrayBuffer) return Promise.resolve(mappingsWasm);
		throw new Error("You must provide the string URL or ArrayBuffer contents of lib/mappings.wasm by calling SourceMapConsumer.initialize({ 'lib/mappings.wasm': ... }) before using SourceMapConsumer");
	};
	module.exports.initialize = (input) => {
		mappingsWasm = input;
	};
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/wasm.js
var require_wasm = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var readWasm = require_read_wasm_browser();
	/**
	* Provide the JIT with a nice shape / hidden class.
	*/
	function Mapping() {
		this.generatedLine = 0;
		this.generatedColumn = 0;
		this.lastGeneratedColumn = null;
		this.source = null;
		this.originalLine = null;
		this.originalColumn = null;
		this.name = null;
	}
	var cachedWasm = null;
	module.exports = function wasm() {
		if (cachedWasm) return cachedWasm;
		const callbackStack = [];
		cachedWasm = readWasm().then((buffer) => {
			return WebAssembly.instantiate(buffer, { env: {
				mapping_callback(generatedLine, generatedColumn, hasLastGeneratedColumn, lastGeneratedColumn, hasOriginal, source, originalLine, originalColumn, hasName, name) {
					const mapping = new Mapping();
					mapping.generatedLine = generatedLine + 1;
					mapping.generatedColumn = generatedColumn;
					if (hasLastGeneratedColumn) mapping.lastGeneratedColumn = lastGeneratedColumn - 1;
					if (hasOriginal) {
						mapping.source = source;
						mapping.originalLine = originalLine + 1;
						mapping.originalColumn = originalColumn;
						if (hasName) mapping.name = name;
					}
					callbackStack[callbackStack.length - 1](mapping);
				},
				start_all_generated_locations_for() {
					console.time("all_generated_locations_for");
				},
				end_all_generated_locations_for() {
					console.timeEnd("all_generated_locations_for");
				},
				start_compute_column_spans() {
					console.time("compute_column_spans");
				},
				end_compute_column_spans() {
					console.timeEnd("compute_column_spans");
				},
				start_generated_location_for() {
					console.time("generated_location_for");
				},
				end_generated_location_for() {
					console.timeEnd("generated_location_for");
				},
				start_original_location_for() {
					console.time("original_location_for");
				},
				end_original_location_for() {
					console.timeEnd("original_location_for");
				},
				start_parse_mappings() {
					console.time("parse_mappings");
				},
				end_parse_mappings() {
					console.timeEnd("parse_mappings");
				},
				start_sort_by_generated_location() {
					console.time("sort_by_generated_location");
				},
				end_sort_by_generated_location() {
					console.timeEnd("sort_by_generated_location");
				},
				start_sort_by_original_location() {
					console.time("sort_by_original_location");
				},
				end_sort_by_original_location() {
					console.timeEnd("sort_by_original_location");
				}
			} });
		}).then((Wasm) => {
			return {
				exports: Wasm.instance.exports,
				withMappingCallback: (mappingCallback, f) => {
					callbackStack.push(mappingCallback);
					try {
						f();
					} finally {
						callbackStack.pop();
					}
				}
			};
		}).then(null, (e) => {
			cachedWasm = null;
			throw e;
		});
		return cachedWasm;
	};
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/source-map-consumer.js
var require_source_map_consumer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var util = require_util();
	var binarySearch = require_binary_search();
	var ArraySet = require_array_set().ArraySet;
	require_base64_vlq();
	var readWasm = require_read_wasm_browser();
	var wasm = require_wasm();
	var INTERNAL = Symbol("smcInternal");
	var SourceMapConsumer = class SourceMapConsumer {
		constructor(aSourceMap, aSourceMapURL) {
			if (aSourceMap == INTERNAL) return Promise.resolve(this);
			return _factory(aSourceMap, aSourceMapURL);
		}
		static initialize(opts) {
			readWasm.initialize(opts["lib/mappings.wasm"]);
		}
		static fromSourceMap(aSourceMap, aSourceMapURL) {
			return _factoryBSM(aSourceMap, aSourceMapURL);
		}
		/**
		* Construct a new `SourceMapConsumer` from `rawSourceMap` and `sourceMapUrl`
		* (see the `SourceMapConsumer` constructor for details. Then, invoke the `async
		* function f(SourceMapConsumer) -> T` with the newly constructed consumer, wait
		* for `f` to complete, call `destroy` on the consumer, and return `f`'s return
		* value.
		*
		* You must not use the consumer after `f` completes!
		*
		* By using `with`, you do not have to remember to manually call `destroy` on
		* the consumer, since it will be called automatically once `f` completes.
		*
		* ```js
		* const xSquared = await SourceMapConsumer.with(
		*   myRawSourceMap,
		*   null,
		*   async function (consumer) {
		*     // Use `consumer` inside here and don't worry about remembering
		*     // to call `destroy`.
		*
		*     const x = await whatever(consumer);
		*     return x * x;
		*   }
		* );
		*
		* // You may not use that `consumer` anymore out here; it has
		* // been destroyed. But you can use `xSquared`.
		* console.log(xSquared);
		* ```
		*/
		static async with(rawSourceMap, sourceMapUrl, f) {
			const consumer = await new SourceMapConsumer(rawSourceMap, sourceMapUrl);
			try {
				return await f(consumer);
			} finally {
				consumer.destroy();
			}
		}
		/**
		* Iterate over each mapping between an original source/line/column and a
		* generated line/column in this source map.
		*
		* @param Function aCallback
		*        The function that is called with each mapping.
		* @param Object aContext
		*        Optional. If specified, this object will be the value of `this` every
		*        time that `aCallback` is called.
		* @param aOrder
		*        Either `SourceMapConsumer.GENERATED_ORDER` or
		*        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
		*        iterate over the mappings sorted by the generated file's line/column
		*        order or the original's source/line/column order, respectively. Defaults to
		*        `SourceMapConsumer.GENERATED_ORDER`.
		*/
		eachMapping(aCallback, aContext, aOrder) {
			throw new Error("Subclasses must implement eachMapping");
		}
		/**
		* Returns all generated line and column information for the original source,
		* line, and column provided. If no column is provided, returns all mappings
		* corresponding to a either the line we are searching for or the next
		* closest line that has any mappings. Otherwise, returns all mappings
		* corresponding to the given line and either the column we are searching for
		* or the next closest column that has any offsets.
		*
		* The only argument is an object with the following properties:
		*
		*   - source: The filename of the original source.
		*   - line: The line number in the original source.  The line number is 1-based.
		*   - column: Optional. the column number in the original source.
		*    The column number is 0-based.
		*
		* and an array of objects is returned, each with the following properties:
		*
		*   - line: The line number in the generated source, or null.  The
		*    line number is 1-based.
		*   - column: The column number in the generated source, or null.
		*    The column number is 0-based.
		*/
		allGeneratedPositionsFor(aArgs) {
			throw new Error("Subclasses must implement allGeneratedPositionsFor");
		}
		destroy() {
			throw new Error("Subclasses must implement destroy");
		}
	};
	/**
	* The version of the source mapping spec that we are consuming.
	*/
	SourceMapConsumer.prototype._version = 3;
	SourceMapConsumer.GENERATED_ORDER = 1;
	SourceMapConsumer.ORIGINAL_ORDER = 2;
	SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
	SourceMapConsumer.LEAST_UPPER_BOUND = 2;
	exports.SourceMapConsumer = SourceMapConsumer;
	/**
	* A BasicSourceMapConsumer instance represents a parsed source map which we can
	* query for information about the original file positions by giving it a file
	* position in the generated source.
	*
	* The first parameter is the raw source map (either as a JSON string, or
	* already parsed to an object). According to the spec, source maps have the
	* following attributes:
	*
	*   - version: Which version of the source map spec this map is following.
	*   - sources: An array of URLs to the original source files.
	*   - names: An array of identifiers which can be referenced by individual mappings.
	*   - sourceRoot: Optional. The URL root from which all sources are relative.
	*   - sourcesContent: Optional. An array of contents of the original source files.
	*   - mappings: A string of base64 VLQs which contain the actual mappings.
	*   - file: Optional. The generated file this source map is associated with.
	*
	* Here is an example source map, taken from the source map spec[0]:
	*
	*     {
	*       version : 3,
	*       file: "out.js",
	*       sourceRoot : "",
	*       sources: ["foo.js", "bar.js"],
	*       names: ["src", "maps", "are", "fun"],
	*       mappings: "AA,AB;;ABCDE;"
	*     }
	*
	* The second parameter, if given, is a string whose value is the URL
	* at which the source map was found.  This URL is used to compute the
	* sources array.
	*
	* [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
	*/
	var BasicSourceMapConsumer = class BasicSourceMapConsumer extends SourceMapConsumer {
		constructor(aSourceMap, aSourceMapURL) {
			return super(INTERNAL).then((that) => {
				let sourceMap = aSourceMap;
				if (typeof aSourceMap === "string") sourceMap = util.parseSourceMapInput(aSourceMap);
				const version = util.getArg(sourceMap, "version");
				const sources = util.getArg(sourceMap, "sources").map(String);
				const names = util.getArg(sourceMap, "names", []);
				const sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
				const sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
				const mappings = util.getArg(sourceMap, "mappings");
				const file = util.getArg(sourceMap, "file", null);
				const x_google_ignoreList = util.getArg(sourceMap, "x_google_ignoreList", null);
				if (version != that._version) throw new Error("Unsupported version: " + version);
				that._sourceLookupCache = /* @__PURE__ */ new Map();
				that._names = ArraySet.fromArray(names.map(String), true);
				that._sources = ArraySet.fromArray(sources, true);
				that._absoluteSources = ArraySet.fromArray(that._sources.toArray().map(function(s) {
					return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
				}), true);
				that.sourceRoot = sourceRoot;
				that.sourcesContent = sourcesContent;
				that._mappings = mappings;
				that._sourceMapURL = aSourceMapURL;
				that.file = file;
				that.x_google_ignoreList = x_google_ignoreList;
				that._computedColumnSpans = false;
				that._mappingsPtr = 0;
				that._wasm = null;
				return wasm().then((w) => {
					that._wasm = w;
					return that;
				});
			});
		}
		/**
		* Utility function to find the index of a source.  Returns -1 if not
		* found.
		*/
		_findSourceIndex(aSource) {
			const cachedIndex = this._sourceLookupCache.get(aSource);
			if (typeof cachedIndex === "number") return cachedIndex;
			const sourceAsMapRelative = util.computeSourceURL(null, aSource, this._sourceMapURL);
			if (this._absoluteSources.has(sourceAsMapRelative)) {
				const index = this._absoluteSources.indexOf(sourceAsMapRelative);
				this._sourceLookupCache.set(aSource, index);
				return index;
			}
			const sourceAsSourceRootRelative = util.computeSourceURL(this.sourceRoot, aSource, this._sourceMapURL);
			if (this._absoluteSources.has(sourceAsSourceRootRelative)) {
				const index = this._absoluteSources.indexOf(sourceAsSourceRootRelative);
				this._sourceLookupCache.set(aSource, index);
				return index;
			}
			return -1;
		}
		/**
		* Create a BasicSourceMapConsumer from a SourceMapGenerator.
		*
		* @param SourceMapGenerator aSourceMap
		*        The source map that will be consumed.
		* @param String aSourceMapURL
		*        The URL at which the source map can be found (optional)
		* @returns BasicSourceMapConsumer
		*/
		static fromSourceMap(aSourceMap, aSourceMapURL) {
			return new BasicSourceMapConsumer(aSourceMap.toString());
		}
		get sources() {
			return this._absoluteSources.toArray();
		}
		_getMappingsPtr() {
			if (this._mappingsPtr === 0) this._parseMappings();
			return this._mappingsPtr;
		}
		/**
		* Parse the mappings in a string in to a data structure which we can easily
		* query (the ordered arrays in the `this.__generatedMappings` and
		* `this.__originalMappings` properties).
		*/
		_parseMappings() {
			const aStr = this._mappings;
			const size = aStr.length;
			const mappingsBufPtr = this._wasm.exports.allocate_mappings(size) >>> 0;
			const mappingsBuf = new Uint8Array(this._wasm.exports.memory.buffer, mappingsBufPtr, size);
			for (let i = 0; i < size; i++) mappingsBuf[i] = aStr.charCodeAt(i);
			const mappingsPtr = this._wasm.exports.parse_mappings(mappingsBufPtr);
			if (!mappingsPtr) {
				const error = this._wasm.exports.get_last_error();
				let msg = `Error parsing mappings (code ${error}): `;
				switch (error) {
					case 1:
						msg += "the mappings contained a negative line, column, source index, or name index";
						break;
					case 2:
						msg += "the mappings contained a number larger than 2**32";
						break;
					case 3:
						msg += "reached EOF while in the middle of parsing a VLQ";
						break;
					case 4:
						msg += "invalid base 64 character while parsing a VLQ";
						break;
					default: msg += "unknown error code";
				}
				throw new Error(msg);
			}
			this._mappingsPtr = mappingsPtr;
		}
		eachMapping(aCallback, aContext, aOrder) {
			const context = aContext || null;
			const order = aOrder || SourceMapConsumer.GENERATED_ORDER;
			this._wasm.withMappingCallback((mapping) => {
				if (mapping.source !== null) {
					mapping.source = this._absoluteSources.at(mapping.source);
					if (mapping.name !== null) mapping.name = this._names.at(mapping.name);
				}
				if (this._computedColumnSpans && mapping.lastGeneratedColumn === null) mapping.lastGeneratedColumn = Infinity;
				aCallback.call(context, mapping);
			}, () => {
				switch (order) {
					case SourceMapConsumer.GENERATED_ORDER:
						this._wasm.exports.by_generated_location(this._getMappingsPtr());
						break;
					case SourceMapConsumer.ORIGINAL_ORDER:
						this._wasm.exports.by_original_location(this._getMappingsPtr());
						break;
					default: throw new Error("Unknown order of iteration.");
				}
			});
		}
		allGeneratedPositionsFor(aArgs) {
			let source = util.getArg(aArgs, "source");
			const originalLine = util.getArg(aArgs, "line");
			const originalColumn = aArgs.column || 0;
			source = this._findSourceIndex(source);
			if (source < 0) return [];
			if (originalLine < 1) throw new Error("Line numbers must be >= 1");
			if (originalColumn < 0) throw new Error("Column numbers must be >= 0");
			const mappings = [];
			this._wasm.withMappingCallback((m) => {
				let lastColumn = m.lastGeneratedColumn;
				if (this._computedColumnSpans && lastColumn === null) lastColumn = Infinity;
				mappings.push({
					line: m.generatedLine,
					column: m.generatedColumn,
					lastColumn
				});
			}, () => {
				this._wasm.exports.all_generated_locations_for(this._getMappingsPtr(), source, originalLine - 1, "column" in aArgs, originalColumn);
			});
			return mappings;
		}
		destroy() {
			if (this._mappingsPtr !== 0) {
				this._wasm.exports.free_mappings(this._mappingsPtr);
				this._mappingsPtr = 0;
			}
		}
		/**
		* Compute the last column for each generated mapping. The last column is
		* inclusive.
		*/
		computeColumnSpans() {
			if (this._computedColumnSpans) return;
			this._wasm.exports.compute_column_spans(this._getMappingsPtr());
			this._computedColumnSpans = true;
		}
		/**
		* Returns the original source, line, and column information for the generated
		* source's line and column positions provided. The only argument is an object
		* with the following properties:
		*
		*   - line: The line number in the generated source.  The line number
		*     is 1-based.
		*   - column: The column number in the generated source.  The column
		*     number is 0-based.
		*   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
		*     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
		*     closest element that is smaller than or greater than the one we are
		*     searching for, respectively, if the exact element cannot be found.
		*     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
		*
		* and an object is returned with the following properties:
		*
		*   - source: The original source file, or null.
		*   - line: The line number in the original source, or null.  The
		*     line number is 1-based.
		*   - column: The column number in the original source, or null.  The
		*     column number is 0-based.
		*   - name: The original identifier, or null.
		*/
		originalPositionFor(aArgs) {
			const needle = {
				generatedLine: util.getArg(aArgs, "line"),
				generatedColumn: util.getArg(aArgs, "column")
			};
			if (needle.generatedLine < 1) throw new Error("Line numbers must be >= 1");
			if (needle.generatedColumn < 0) throw new Error("Column numbers must be >= 0");
			let bias = util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND);
			if (bias == null) bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
			let mapping;
			this._wasm.withMappingCallback((m) => mapping = m, () => {
				this._wasm.exports.original_location_for(this._getMappingsPtr(), needle.generatedLine - 1, needle.generatedColumn, bias);
			});
			if (mapping) {
				if (mapping.generatedLine === needle.generatedLine) {
					let source = util.getArg(mapping, "source", null);
					if (source !== null) source = this._absoluteSources.at(source);
					let name = util.getArg(mapping, "name", null);
					if (name !== null) name = this._names.at(name);
					return {
						source,
						line: util.getArg(mapping, "originalLine", null),
						column: util.getArg(mapping, "originalColumn", null),
						name
					};
				}
			}
			return {
				source: null,
				line: null,
				column: null,
				name: null
			};
		}
		/**
		* Return true if we have the source content for every source in the source
		* map, false otherwise.
		*/
		hasContentsOfAllSources() {
			if (!this.sourcesContent) return false;
			return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc) {
				return sc == null;
			});
		}
		/**
		* Returns the original source content. The only argument is the url of the
		* original source file. Returns null if no original source content is
		* available.
		*/
		sourceContentFor(aSource, nullOnMissing) {
			if (!this.sourcesContent) return null;
			const index = this._findSourceIndex(aSource);
			if (index >= 0) return this.sourcesContent[index];
			if (nullOnMissing) return null;
			throw new Error("\"" + aSource + "\" is not in the SourceMap.");
		}
		/**
		* Returns the generated line and column information for the original source,
		* line, and column positions provided. The only argument is an object with
		* the following properties:
		*
		*   - source: The filename of the original source.
		*   - line: The line number in the original source.  The line number
		*     is 1-based.
		*   - column: The column number in the original source.  The column
		*     number is 0-based.
		*   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
		*     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
		*     closest element that is smaller than or greater than the one we are
		*     searching for, respectively, if the exact element cannot be found.
		*     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
		*
		* and an object is returned with the following properties:
		*
		*   - line: The line number in the generated source, or null.  The
		*     line number is 1-based.
		*   - column: The column number in the generated source, or null.
		*     The column number is 0-based.
		*/
		generatedPositionFor(aArgs) {
			let source = util.getArg(aArgs, "source");
			source = this._findSourceIndex(source);
			if (source < 0) return {
				line: null,
				column: null,
				lastColumn: null
			};
			const needle = {
				source,
				originalLine: util.getArg(aArgs, "line"),
				originalColumn: util.getArg(aArgs, "column")
			};
			if (needle.originalLine < 1) throw new Error("Line numbers must be >= 1");
			if (needle.originalColumn < 0) throw new Error("Column numbers must be >= 0");
			let bias = util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND);
			if (bias == null) bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
			let mapping;
			this._wasm.withMappingCallback((m) => mapping = m, () => {
				this._wasm.exports.generated_location_for(this._getMappingsPtr(), needle.source, needle.originalLine - 1, needle.originalColumn, bias);
			});
			if (mapping) {
				if (mapping.source === needle.source) {
					let lastColumn = mapping.lastGeneratedColumn;
					if (this._computedColumnSpans && lastColumn === null) lastColumn = Infinity;
					return {
						line: util.getArg(mapping, "generatedLine", null),
						column: util.getArg(mapping, "generatedColumn", null),
						lastColumn
					};
				}
			}
			return {
				line: null,
				column: null,
				lastColumn: null
			};
		}
	};
	BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
	exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
	/**
	* An IndexedSourceMapConsumer instance represents a parsed source map which
	* we can query for information. It differs from BasicSourceMapConsumer in
	* that it takes "indexed" source maps (i.e. ones with a "sections" field) as
	* input.
	*
	* The first parameter is a raw source map (either as a JSON string, or already
	* parsed to an object). According to the spec for indexed source maps, they
	* have the following attributes:
	*
	*   - version: Which version of the source map spec this map is following.
	*   - file: Optional. The generated file this source map is associated with.
	*   - sections: A list of section definitions.
	*
	* Each value under the "sections" field has two fields:
	*   - offset: The offset into the original specified at which this section
	*       begins to apply, defined as an object with a "line" and "column"
	*       field.
	*   - map: A source map definition. This source map could also be indexed,
	*       but doesn't have to be.
	*
	* Instead of the "map" field, it's also possible to have a "url" field
	* specifying a URL to retrieve a source map from, but that's currently
	* unsupported.
	*
	* Here's an example source map, taken from the source map spec[0], but
	* modified to omit a section which uses the "url" field.
	*
	*  {
	*    version : 3,
	*    file: "app.js",
	*    sections: [{
	*      offset: {line:100, column:10},
	*      map: {
	*        version : 3,
	*        file: "section.js",
	*        sources: ["foo.js", "bar.js"],
	*        names: ["src", "maps", "are", "fun"],
	*        mappings: "AAAA,E;;ABCDE;"
	*      }
	*    }],
	*  }
	*
	* The second parameter, if given, is a string whose value is the URL
	* at which the source map was found.  This URL is used to compute the
	* sources array.
	*
	* [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
	*/
	var IndexedSourceMapConsumer = class extends SourceMapConsumer {
		constructor(aSourceMap, aSourceMapURL) {
			return super(INTERNAL).then((that) => {
				let sourceMap = aSourceMap;
				if (typeof aSourceMap === "string") sourceMap = util.parseSourceMapInput(aSourceMap);
				const version = util.getArg(sourceMap, "version");
				const sections = util.getArg(sourceMap, "sections");
				if (version != that._version) throw new Error("Unsupported version: " + version);
				let lastOffset = {
					line: -1,
					column: 0
				};
				return Promise.all(sections.map((s) => {
					if (s.url) throw new Error("Support for url field in sections not implemented.");
					const offset = util.getArg(s, "offset");
					const offsetLine = util.getArg(offset, "line");
					const offsetColumn = util.getArg(offset, "column");
					if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) throw new Error("Section offsets must be ordered and non-overlapping.");
					lastOffset = offset;
					return new SourceMapConsumer(util.getArg(s, "map"), aSourceMapURL).then((consumer) => {
						return {
							generatedOffset: {
								generatedLine: offsetLine + 1,
								generatedColumn: offsetColumn + 1
							},
							consumer
						};
					});
				})).then((s) => {
					that._sections = s;
					return that;
				});
			});
		}
		/**
		* The list of original sources.
		*/
		get sources() {
			const sources = [];
			for (let i = 0; i < this._sections.length; i++) for (let j = 0; j < this._sections[i].consumer.sources.length; j++) sources.push(this._sections[i].consumer.sources[j]);
			return sources;
		}
		/**
		* Returns the original source, line, and column information for the generated
		* source's line and column positions provided. The only argument is an object
		* with the following properties:
		*
		*   - line: The line number in the generated source.  The line number
		*     is 1-based.
		*   - column: The column number in the generated source.  The column
		*     number is 0-based.
		*
		* and an object is returned with the following properties:
		*
		*   - source: The original source file, or null.
		*   - line: The line number in the original source, or null.  The
		*     line number is 1-based.
		*   - column: The column number in the original source, or null.  The
		*     column number is 0-based.
		*   - name: The original identifier, or null.
		*/
		originalPositionFor(aArgs) {
			const needle = {
				generatedLine: util.getArg(aArgs, "line"),
				generatedColumn: util.getArg(aArgs, "column")
			};
			const sectionIndex = binarySearch.search(needle, this._sections, function(aNeedle, section) {
				const cmp = aNeedle.generatedLine - section.generatedOffset.generatedLine;
				if (cmp) return cmp;
				return aNeedle.generatedColumn - (section.generatedOffset.generatedColumn - 1);
			});
			const section = this._sections[sectionIndex];
			if (!section) return {
				source: null,
				line: null,
				column: null,
				name: null
			};
			return section.consumer.originalPositionFor({
				line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
				column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
				bias: aArgs.bias
			});
		}
		/**
		* Return true if we have the source content for every source in the source
		* map, false otherwise.
		*/
		hasContentsOfAllSources() {
			return this._sections.every(function(s) {
				return s.consumer.hasContentsOfAllSources();
			});
		}
		/**
		* Returns the original source content. The only argument is the url of the
		* original source file. Returns null if no original source content is
		* available.
		*/
		sourceContentFor(aSource, nullOnMissing) {
			for (let i = 0; i < this._sections.length; i++) {
				const content = this._sections[i].consumer.sourceContentFor(aSource, true);
				if (content) return content;
			}
			if (nullOnMissing) return null;
			throw new Error("\"" + aSource + "\" is not in the SourceMap.");
		}
		_findSectionIndex(source) {
			for (let i = 0; i < this._sections.length; i++) {
				const { consumer } = this._sections[i];
				if (consumer._findSourceIndex(source) !== -1) return i;
			}
			return -1;
		}
		/**
		* Returns the generated line and column information for the original source,
		* line, and column positions provided. The only argument is an object with
		* the following properties:
		*
		*   - source: The filename of the original source.
		*   - line: The line number in the original source.  The line number
		*     is 1-based.
		*   - column: The column number in the original source.  The column
		*     number is 0-based.
		*
		* and an object is returned with the following properties:
		*
		*   - line: The line number in the generated source, or null.  The
		*     line number is 1-based.
		*   - column: The column number in the generated source, or null.
		*     The column number is 0-based.
		*/
		generatedPositionFor(aArgs) {
			const index = this._findSectionIndex(util.getArg(aArgs, "source"));
			const section = index >= 0 ? this._sections[index] : null;
			const nextSection = index >= 0 && index + 1 < this._sections.length ? this._sections[index + 1] : null;
			const generatedPosition = section && section.consumer.generatedPositionFor(aArgs);
			if (generatedPosition && generatedPosition.line !== null) {
				const lineShift = section.generatedOffset.generatedLine - 1;
				const columnShift = section.generatedOffset.generatedColumn - 1;
				if (generatedPosition.line === 1) {
					generatedPosition.column += columnShift;
					if (typeof generatedPosition.lastColumn === "number") generatedPosition.lastColumn += columnShift;
				}
				if (generatedPosition.lastColumn === Infinity && nextSection && generatedPosition.line === nextSection.generatedOffset.generatedLine) generatedPosition.lastColumn = nextSection.generatedOffset.generatedColumn - 2;
				generatedPosition.line += lineShift;
				return generatedPosition;
			}
			return {
				line: null,
				column: null,
				lastColumn: null
			};
		}
		allGeneratedPositionsFor(aArgs) {
			const index = this._findSectionIndex(util.getArg(aArgs, "source"));
			const section = index >= 0 ? this._sections[index] : null;
			const nextSection = index >= 0 && index + 1 < this._sections.length ? this._sections[index + 1] : null;
			if (!section) return [];
			return section.consumer.allGeneratedPositionsFor(aArgs).map((generatedPosition) => {
				const lineShift = section.generatedOffset.generatedLine - 1;
				const columnShift = section.generatedOffset.generatedColumn - 1;
				if (generatedPosition.line === 1) {
					generatedPosition.column += columnShift;
					if (typeof generatedPosition.lastColumn === "number") generatedPosition.lastColumn += columnShift;
				}
				if (generatedPosition.lastColumn === Infinity && nextSection && generatedPosition.line === nextSection.generatedOffset.generatedLine) generatedPosition.lastColumn = nextSection.generatedOffset.generatedColumn - 2;
				generatedPosition.line += lineShift;
				return generatedPosition;
			});
		}
		eachMapping(aCallback, aContext, aOrder) {
			this._sections.forEach((section, index) => {
				const nextSection = index + 1 < this._sections.length ? this._sections[index + 1] : null;
				const { generatedOffset } = section;
				const lineShift = generatedOffset.generatedLine - 1;
				const columnShift = generatedOffset.generatedColumn - 1;
				section.consumer.eachMapping(function(mapping) {
					if (mapping.generatedLine === 1) {
						mapping.generatedColumn += columnShift;
						if (typeof mapping.lastGeneratedColumn === "number") mapping.lastGeneratedColumn += columnShift;
					}
					if (mapping.lastGeneratedColumn === Infinity && nextSection && mapping.generatedLine === nextSection.generatedOffset.generatedLine) mapping.lastGeneratedColumn = nextSection.generatedOffset.generatedColumn - 2;
					mapping.generatedLine += lineShift;
					aCallback.call(this, mapping);
				}, aContext, aOrder);
			});
		}
		computeColumnSpans() {
			for (let i = 0; i < this._sections.length; i++) this._sections[i].consumer.computeColumnSpans();
		}
		destroy() {
			for (let i = 0; i < this._sections.length; i++) this._sections[i].consumer.destroy();
		}
	};
	exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
	function _factory(aSourceMap, aSourceMapURL) {
		let sourceMap = aSourceMap;
		if (typeof aSourceMap === "string") sourceMap = util.parseSourceMapInput(aSourceMap);
		const consumer = sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
		return Promise.resolve(consumer);
	}
	function _factoryBSM(aSourceMap, aSourceMapURL) {
		return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
	}
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/lib/source-node.js
var require_source_node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
	var util = require_util();
	var REGEX_NEWLINE = /(\r?\n)/;
	var NEWLINE_CODE = 10;
	var isSourceNode = "$$$isSourceNode$$$";
	exports.SourceNode = class SourceNode {
		constructor(aLine, aColumn, aSource, aChunks, aName) {
			this.children = [];
			this.sourceContents = {};
			this.line = aLine == null ? null : aLine;
			this.column = aColumn == null ? null : aColumn;
			this.source = aSource == null ? null : aSource;
			this.name = aName == null ? null : aName;
			this[isSourceNode] = true;
			if (aChunks != null) this.add(aChunks);
		}
		/**
		* Creates a SourceNode from generated code and a SourceMapConsumer.
		*
		* @param aGeneratedCode The generated code
		* @param aSourceMapConsumer The SourceMap for the generated code
		* @param aRelativePath Optional. The path that relative sources in the
		*        SourceMapConsumer should be relative to.
		*/
		static fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
			const node = new SourceNode();
			const remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
			let remainingLinesIndex = 0;
			const shiftNextLine = function() {
				return getNextLine() + (getNextLine() || "");
				function getNextLine() {
					return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : void 0;
				}
			};
			let lastGeneratedLine = 1, lastGeneratedColumn = 0;
			let lastMapping = null;
			let nextLine;
			aSourceMapConsumer.eachMapping(function(mapping) {
				if (lastMapping !== null) {
					if (lastGeneratedLine < mapping.generatedLine) {
						addMappingWithCode(lastMapping, shiftNextLine());
						lastGeneratedLine++;
						lastGeneratedColumn = 0;
					} else {
						nextLine = remainingLines[remainingLinesIndex] || "";
						const code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
						remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
						lastGeneratedColumn = mapping.generatedColumn;
						addMappingWithCode(lastMapping, code);
						lastMapping = mapping;
						return;
					}
				}
				while (lastGeneratedLine < mapping.generatedLine) {
					node.add(shiftNextLine());
					lastGeneratedLine++;
				}
				if (lastGeneratedColumn < mapping.generatedColumn) {
					nextLine = remainingLines[remainingLinesIndex] || "";
					node.add(nextLine.substr(0, mapping.generatedColumn));
					remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
					lastGeneratedColumn = mapping.generatedColumn;
				}
				lastMapping = mapping;
			}, this);
			if (remainingLinesIndex < remainingLines.length) {
				if (lastMapping) addMappingWithCode(lastMapping, shiftNextLine());
				node.add(remainingLines.splice(remainingLinesIndex).join(""));
			}
			aSourceMapConsumer.sources.forEach(function(sourceFile) {
				const content = aSourceMapConsumer.sourceContentFor(sourceFile);
				if (content != null) {
					if (aRelativePath != null) sourceFile = util.join(aRelativePath, sourceFile);
					node.setSourceContent(sourceFile, content);
				}
			});
			return node;
			function addMappingWithCode(mapping, code) {
				if (mapping === null || mapping.source === void 0) node.add(code);
				else {
					const source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
					node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, source, code, mapping.name));
				}
			}
		}
		/**
		* Add a chunk of generated JS to this source node.
		*
		* @param aChunk A string snippet of generated JS code, another instance of
		*        SourceNode, or an array where each member is one of those things.
		*/
		add(aChunk) {
			if (Array.isArray(aChunk)) aChunk.forEach(function(chunk) {
				this.add(chunk);
			}, this);
			else if (aChunk[isSourceNode] || typeof aChunk === "string") {
				if (aChunk) this.children.push(aChunk);
			} else throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
			return this;
		}
		/**
		* Add a chunk of generated JS to the beginning of this source node.
		*
		* @param aChunk A string snippet of generated JS code, another instance of
		*        SourceNode, or an array where each member is one of those things.
		*/
		prepend(aChunk) {
			if (Array.isArray(aChunk)) for (let i = aChunk.length - 1; i >= 0; i--) this.prepend(aChunk[i]);
			else if (aChunk[isSourceNode] || typeof aChunk === "string") this.children.unshift(aChunk);
			else throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
			return this;
		}
		/**
		* Walk over the tree of JS snippets in this node and its children. The
		* walking function is called once for each snippet of JS and is passed that
		* snippet and the its original associated source's line/column location.
		*
		* @param aFn The traversal function.
		*/
		walk(aFn) {
			let chunk;
			for (let i = 0, len = this.children.length; i < len; i++) {
				chunk = this.children[i];
				if (chunk[isSourceNode]) chunk.walk(aFn);
				else if (chunk !== "") aFn(chunk, {
					source: this.source,
					line: this.line,
					column: this.column,
					name: this.name
				});
			}
		}
		/**
		* Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
		* each of `this.children`.
		*
		* @param aSep The separator.
		*/
		join(aSep) {
			let newChildren;
			let i;
			const len = this.children.length;
			if (len > 0) {
				newChildren = [];
				for (i = 0; i < len - 1; i++) {
					newChildren.push(this.children[i]);
					newChildren.push(aSep);
				}
				newChildren.push(this.children[i]);
				this.children = newChildren;
			}
			return this;
		}
		/**
		* Call String.prototype.replace on the very right-most source snippet. Useful
		* for trimming whitespace from the end of a source node, etc.
		*
		* @param aPattern The pattern to replace.
		* @param aReplacement The thing to replace the pattern with.
		*/
		replaceRight(aPattern, aReplacement) {
			const lastChild = this.children[this.children.length - 1];
			if (lastChild[isSourceNode]) lastChild.replaceRight(aPattern, aReplacement);
			else if (typeof lastChild === "string") this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
			else this.children.push("".replace(aPattern, aReplacement));
			return this;
		}
		/**
		* Set the source content for a source file. This will be added to the SourceMapGenerator
		* in the sourcesContent field.
		*
		* @param aSourceFile The filename of the source file
		* @param aSourceContent The content of the source file
		*/
		setSourceContent(aSourceFile, aSourceContent) {
			this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
		}
		/**
		* Walk over the tree of SourceNodes. The walking function is called for each
		* source file content and is passed the filename and source content.
		*
		* @param aFn The traversal function.
		*/
		walkSourceContents(aFn) {
			for (let i = 0, len = this.children.length; i < len; i++) if (this.children[i][isSourceNode]) this.children[i].walkSourceContents(aFn);
			const sources = Object.keys(this.sourceContents);
			for (let i = 0, len = sources.length; i < len; i++) aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
		}
		/**
		* Return the string representation of this source node. Walks over the tree
		* and concatenates all the various snippets together to one string.
		*/
		toString() {
			let str = "";
			this.walk(function(chunk) {
				str += chunk;
			});
			return str;
		}
		/**
		* Returns the string representation of this source node along with a source
		* map.
		*/
		toStringWithSourceMap(aArgs) {
			const generated = {
				code: "",
				line: 1,
				column: 0
			};
			const map = new SourceMapGenerator(aArgs);
			let sourceMappingActive = false;
			let lastOriginalSource = null;
			let lastOriginalLine = null;
			let lastOriginalColumn = null;
			let lastOriginalName = null;
			this.walk(function(chunk, original) {
				generated.code += chunk;
				if (original.source !== null && original.line !== null && original.column !== null) {
					if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) map.addMapping({
						source: original.source,
						original: {
							line: original.line,
							column: original.column
						},
						generated: {
							line: generated.line,
							column: generated.column
						},
						name: original.name
					});
					lastOriginalSource = original.source;
					lastOriginalLine = original.line;
					lastOriginalColumn = original.column;
					lastOriginalName = original.name;
					sourceMappingActive = true;
				} else if (sourceMappingActive) {
					map.addMapping({ generated: {
						line: generated.line,
						column: generated.column
					} });
					lastOriginalSource = null;
					sourceMappingActive = false;
				}
				for (let idx = 0, length = chunk.length; idx < length; idx++) if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
					generated.line++;
					generated.column = 0;
					if (idx + 1 === length) {
						lastOriginalSource = null;
						sourceMappingActive = false;
					} else if (sourceMappingActive) map.addMapping({
						source: original.source,
						original: {
							line: original.line,
							column: original.column
						},
						generated: {
							line: generated.line,
							column: generated.column
						},
						name: original.name
					});
				} else generated.column++;
			});
			this.walkSourceContents(function(sourceFile, sourceContent) {
				map.setSourceContent(sourceFile, sourceContent);
			});
			return {
				code: generated.code,
				map
			};
		}
	};
}));
//#endregion
//#region ../../2610111754_fumadocs-16-17-1/site/node_modules/.pnpm/source-map@0.7.6/node_modules/source-map/source-map.js
var require_source_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
	exports.SourceMapConsumer = require_source_map_consumer().SourceMapConsumer;
	exports.SourceNode = require_source_node().SourceNode;
}));
//#endregion
export default require_source_map();

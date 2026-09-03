/**
 * @god-live-doc/core——核心包的唯一出口。零依赖（只用 node:crypto）。
 * types 是契约正本，span / diff 是几个比较器共用的纯函数，service 是编排。
 */

export { attrsOf, draftOf, fileOf, formalOf, keyToTarget, parseAttrs, parseFormal, targetKey, toTarget, wordOf } from "./types.ts";
export type {
  Comparator,
  ExistsTarget,
  FileTarget,
  Fill,
  Format,
  HasTarget,
  Item,
  Judgement,
  Ledger,
  Listing,
  MemoRecord,
  Orphan,
  Reader,
  Reference,
  RenderContext,
  Snapshot,
  Span,
  SpanTarget,
  Status,
  Target,
  TreeTarget,
} from "./types.ts";
export { fileText, hashSpan, lineCount, normalize, normalizeLines, sliceSpan } from "./span.ts";
export { mapRange, mappedSpan, parseHunks, renderDiff } from "./diff.ts";
export type { Hunk, Mapped } from "./diff.ts";
export { createHashComparator, findSpan, wantedSpan } from "./hash-comparator.ts";
export type { HashRecord } from "./hash-comparator.ts";
export { createExistsComparator, createHasComparator, createKindComparator, createTreeComparator, findText } from "./kinds.ts";
export type { ExistsRecord, HasRecord, TreeRecord } from "./kinds.ts";
export { createService } from "./service.ts";
export type { ConfirmResult, Service, ServiceDeps } from "./service.ts";

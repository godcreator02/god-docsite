/**
 * 判定层的唯一出口。**只用 `node:crypto`**——它不读文件、不起进程、不认识任何格式，
 * 看到的一切都是别人注进来的。
 *
 * types 是接口正本，marker 是记号语法，span / diff 是几个比较器共用的纯函数，service 是编排。
 * 这一层不许 import `../host/` 与 `../fumadocs/`（`tests/boundary.test.ts` 守着）。
 */

export { fileOf } from "./types.ts";
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
export { attrsOf, draftOf, formalOf, keyToTarget, parseAttrs, parseFormal, targetKey, toTarget, wordOf } from "./marker.ts";
export { fileText, hashSpan, lineCount, normalize, normalizeLines, sliceSpan } from "./span.ts";
export { mapRange, mappedSpan, parseHunks, renderDiff } from "./diff.ts";
export type { Hunk, Mapped } from "./diff.ts";
export { createHashComparator, findSpan, wantedSpan } from "./hash-comparator.ts";
export type { HashRecord } from "./hash-comparator.ts";
export { createExistsComparator, createHasComparator, createKindComparator, createTreeComparator, findText } from "./kinds.ts";
export type { ExistsRecord, HasRecord, TreeRecord } from "./kinds.ts";
export { createService } from "./service.ts";
export type { ConfirmResult, Service, ServiceDeps } from "./service.ts";

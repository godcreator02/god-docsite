/**
 * 钉码包 `@godcreator/docfirst-pin` 的唯一出口。**只用 `node:crypto`**——它不读文件、不起进程、
 * 不认识任何格式，看到的一切都是别人注进来的。
 *
 * types 是接口正本，marker 是记号语法，span / diff 是纯函数，compare 是比较器，service 是编排。
 * 这个包不依赖任何别的包，自己也只 import 自己（`tests/boundary.test.ts` 守着）。
 */

export { fileOf } from "./types.ts";
export type {
  ContentRecord,
  ExistsRecord,
  ExistsTarget,
  FileTarget,
  Format,
  HasRecord,
  HasTarget,
  History,
  Item,
  Judgement,
  Listing,
  MemoRecord,
  Reader,
  Reference,
  Snapshot,
  Span,
  SpanTarget,
  Status,
  Target,
  TreeRecord,
  TreeTarget,
} from "./types.ts";
export { attrsOf, draftOf, formalOf, parseAttrs, parseFormal, recordOf, targetKey, toTarget, wordOf } from "./marker.ts";
export { blobOf, fileText, hashNames, hashSpan, hashText, lineCount, normalize, normalizeLines, RECORD_HASH_LENGTH, sliceSpan } from "./span.ts";
export { mapRange, mappedSpan, parseHunks, renderDiff } from "./diff.ts";
export type { Hunk, Mapped } from "./diff.ts";
export { findSpan, findText, judge, snapshot } from "./compare.ts";
export { createService } from "./service.ts";
export type { ConfirmAction, ConfirmOptions, ConfirmResult, ConfirmStep, Service, ServiceDeps } from "./service.ts";

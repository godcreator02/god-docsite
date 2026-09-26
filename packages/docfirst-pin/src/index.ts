/**
 * 钉码包 `@godcreator/docfirst-pin` 的唯一出口。**只用 `node:crypto`**——它不读文件、不起进程、
 * 不接触文档文本，只收目标与记录，看到的一切都是别人传进来的。
 *
 * types 是接口正本，span / diff 是纯函数，compare 是比较器，pinner 是对外的核对与确认。
 * 这个包不依赖任何别的包，自己也只 import 自己（`tests/boundary.test.ts` 守着）。
 */

export { fileOf, REASON_TEXT } from "./types.ts";
export type {
  ContentRecord,
  FileTarget,
  HasRecord,
  HasTarget,
  History,
  Judgement,
  MemoRecord,
  Pin,
  RecordedPin,
  Reader,
  Reason,
  Snapshot,
  Span,
  SpanTarget,
  Status,
  Target,
  TreeRecord,
  TreeTarget,
  Verdict,
} from "./types.ts";
export { blobOf, fileText, hashNames, hashSpan, hashText, lineCount, normalize, normalizeLines, RECORD_HASH_LENGTH, sliceSpan } from "./span.ts";
export { mapRange, mappedSpan, parseHunks, renderDiff } from "./diff.ts";
export type { Hunk, Mapped } from "./diff.ts";
export { findSpan, findText, judge, snapshot } from "./compare.ts";
export { createPinner } from "./pinner.ts";
export type { ConfirmAction, ConfirmOptions, Pinner, PinnerDeps, Step } from "./pinner.ts";

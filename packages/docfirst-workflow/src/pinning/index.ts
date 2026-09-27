/**
 * 钉码编排：一个文件的核对与确认只在这里串起来——按文件挑格式，格式认出引用，每处剥成目标与记录交给钉码核心，
 * 结果按原来的顺序配回文件路径与行号；确认时把核心算出的新记录交回同一个格式写回。
 * 命令行、生成物摆放与站构建共用这一份。格式有两种：mdx 页面（`../mdx/`）与讲解组件的源码（`../code/`）。
 *
 * 这个目录认识 `../reference/`、`../mdx/`、`../code/` 与 `@godcreator/docfirst-pin`，不认识记号属性怎么写，
 * 也不认识 project 与 cli（`tests/boundary.test.ts` 守着）。
 */
import type { ConfirmAction, ConfirmOptions, Pin, Pinner, Step, Verdict } from "@godcreator/docfirst-pin";
import type { Format, Item, Listing, Reference, WrittenReference } from "../reference/index.ts";
import { mdxFormat } from "../mdx/index.ts";
import { codeFormat } from "../code/index.ts";

/** 确认时对一处引用做了什么；动作的含义见钉码核心的 `ConfirmAction` */
export interface ConfirmStep {
  item: Item;
  action: ConfirmAction;
  /** recorded / moved / accepted：写回之后的引用，还在原来那一行，带着记录 */
  written?: WrittenReference;
  /** refused 且不是因为红（钉不住）时的原因；红的原因看 item.reason */
  problem?: string;
}

export interface ConfirmResult {
  listing: Listing;
  text: string;
  changed: boolean;
  /** 跟 listing.items 一一对应、同序 */
  steps: ConfirmStep[];
}

export interface Pinning {
  /** 核对一个文件：认引用、出清单，不写任何东西 */
  checkDoc(doc: string, text: string): Listing;
  /** 确认一个文件：按清单逐处决定写不写回、写回成什么，交回改好的全文 */
  confirmDoc(doc: string, text: string, options: ConfirmOptions): ConfirmResult;
  /** 核对已经认好的引用：站构建时语法树上已经认过了，跳过认引用 */
  checkReferences(doc: string, references: Reference[]): Listing;
}

const FORMATS: readonly Format[] = [mdxFormat, codeFormat];

/** 这个文件归哪个格式：一个文件只能有一个格式认领，没有或不止一个都报错 */
export function formatOf(file: string): Format {
  const claimed = FORMATS.filter((format) => format.claims(file));
  if (claimed.length === 0) throw new Error(`${file}：没有格式认领这个文件——${FORMATS.map((f) => f.name).join("、")}都不认它`);
  if (claimed.length > 1) throw new Error(`${file}：${claimed.map((f) => f.name).join("、")}都认领了这个文件，一个文件只能归一个格式`);
  return claimed[0]!;
}

const pinOf = ({ target, record }: Reference): Pin => ({ target, record });

function itemOf(doc: string, reference: Reference, verdict: Verdict): Item {
  const item: Item = { doc, reference, current: verdict.current, status: verdict.status, lines: verdict.lines };
  if (verdict.reason !== undefined) item.reason = verdict.reason;
  if (verdict.diff !== undefined) item.diff = verdict.diff;
  if (verdict.old !== undefined) item.old = verdict.old;
  return item;
}

function confirmStepOf(item: Item, { action, written, problem }: Step): ConfirmStep {
  const step: ConfirmStep = { item, action };
  if (written !== undefined) step.written = { target: written.target, record: written.record, at: item.reference.at };
  if (problem !== undefined) step.problem = problem;
  return step;
}

/** 认引用；记号写坏了的报错只说到第几行，这里补上是哪个文件再抛 */
function referencesIn(format: Format, doc: string, text: string): Reference[] {
  try {
    return format.parse(text);
  } catch (err) {
    throw new Error(`${doc} ${(err as Error).message}`, { cause: err });
  }
}

export function createPinning(pinner: Pinner): Pinning {
  function listingOf(doc: string, references: Reference[]): { listing: Listing; verdicts: Verdict[] } {
    const verdicts = pinner.check(references.map(pinOf));
    return { listing: { doc, items: references.map((reference, i) => itemOf(doc, reference, verdicts[i]!)) }, verdicts };
  }

  return {
    checkDoc: (doc, text) => listingOf(doc, referencesIn(formatOf(doc), doc, text)).listing,
    checkReferences: (doc, references) => listingOf(doc, references).listing,
    confirmDoc(doc, text, options) {
      const format = formatOf(doc);
      const { listing, verdicts } = listingOf(doc, referencesIn(format, doc, text));
      const steps = pinner.confirm(verdicts, options).map((step, i) => confirmStepOf(listing.items[i]!, step));
      const written = steps.flatMap((step) => (step.written !== undefined ? [step.written] : []));
      const next = written.length > 0 ? format.write(text, written) : text;
      return { listing, text: next, changed: next !== text, steps };
    },
  };
}

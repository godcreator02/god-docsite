/**
 * 钉码编排：一篇文档的核对与确认只在这里串起来——mdx 格式认出引用，每处剥成目标与记录交给钉码核心，
 * 结果按原来的顺序配回文档路径与行号；确认时把核心算出的新记录交回 mdx 格式写回。
 * 命令行、生成物摆放与站构建共用这一份。
 *
 * 这个目录认识 `../reference/`、`../mdx/` 与 `@godcreator/docfirst-pin`，不认识记号属性怎么写，也不认识 project 与 cli（`tests/boundary.test.ts` 守着）。
 */
import type { ConfirmAction, ConfirmOptions, Pin, Pinner, Step, Verdict } from "@godcreator/docfirst-pin";
import type { Item, Listing, Reference, WrittenReference } from "../reference/index.ts";
import { parse, write } from "../mdx/index.ts";

/** 确认时对一处引用做了什么；动作的含义见钉码核心的 `ConfirmAction` */
export interface ConfirmStep {
  item: Item;
  action: ConfirmAction;
  /** recorded / moved / accepted：写回之后的引用，还在原来那一行，已经是正式记号 */
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
  /** 核对一篇：认引用、出清单，不写任何东西 */
  checkDoc(doc: string, text: string): Listing;
  /** 确认一篇：按清单逐处决定写不写回、写回成什么，交回改好的全文 */
  confirmDoc(doc: string, text: string, options: ConfirmOptions): ConfirmResult;
  /** 核对已经认好的引用：站构建时语法树上已经认过了，跳过认引用 */
  checkReferences(doc: string, references: Reference[]): Listing;
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

/** 认引用；记号写坏了的报错只说到第几行，这里补上是哪篇文档再抛 */
function referencesIn(doc: string, text: string): Reference[] {
  try {
    return parse(text);
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
    checkDoc: (doc, text) => listingOf(doc, referencesIn(doc, text)).listing,
    checkReferences: (doc, references) => listingOf(doc, references).listing,
    confirmDoc(doc, text, options) {
      const { listing, verdicts } = listingOf(doc, referencesIn(doc, text));
      const steps = pinner.confirm(verdicts, options).map((step, i) => confirmStepOf(listing.items[i]!, step));
      const written = steps.flatMap((step) => (step.written !== undefined ? [step.written] : []));
      const next = written.length > 0 ? write(text, written) : text;
      return { listing, text: next, changed: next !== text, steps };
    },
  };
}

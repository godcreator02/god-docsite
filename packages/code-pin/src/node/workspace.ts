/**
 * 给命令行用的核对与确认：一个项目根下，读文档、调 core、写回文档。
 * 钉上写的路径与文档路径都相对项目根、正斜杠。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDocPinning, createPinner, PIN_FORMATS } from "../core/index.ts";
import type { ConfirmOptions, DocCheck, DocConfirm, DocPinning, Pinner } from "../core/index.ts";
import { createGitHistory } from "./history.ts";
import { createReader } from "./reader.ts";

/** 读工作区、旧内容从 git 取的钉码核心 */
export function createDiskPinner(root: string): Pinner {
  return createPinner({ reader: createReader(root), history: createGitHistory(root) });
}

export interface PinWorkspace {
  root: string;
  pinner: Pinner;
  /** 只收全文、不碰磁盘的那一层：已经读好文档的调用方直接用它 */
  pinning: DocPinning;
  /** 核对一篇：读 <root>/<doc>，不写任何东西 */
  check(doc: string): DocCheck;
  /** 确认一篇：读、确认、有改动才写回 */
  confirm(doc: string, options: ConfirmOptions): DocConfirm;
}

export function createPinWorkspace(root: string): PinWorkspace {
  const pinner = createDiskPinner(root);
  const pinning = createDocPinning(pinner, PIN_FORMATS);
  const read = (doc: string): string => readFileSync(join(root, doc), "utf8");
  return {
    root,
    pinner,
    pinning,
    check: (doc) => pinning.checkDoc(doc, read(doc)),
    confirm(doc, options) {
      const done = pinning.confirmDoc(doc, read(doc), options);
      if (done.changed) writeFileSync(join(root, doc), done.text);
      return done;
    },
  };
}

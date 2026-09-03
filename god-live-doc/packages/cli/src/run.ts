/**
 * livedoc 的三个动作，编排在这儿。可执行那一头在 cli.ts——测试直接调 main，不用起子进程。
 * cwd 就是项目根（那里有 livedoc.config.mjs）。
 *   livedoc check                          核对：只读，红退 1
 *   livedoc confirm                        确认：出记录、清孤儿、写回文档；有钉不住的整篇拒，打印并退 1
 *                                          文档本身删了、挪了的，它的记录 check 算红、confirm 整个忘掉
 *   livedoc render --target human|ai       渲染：问格式包有没有对应的渲染函数，产物落 out/
 * 新引用不用命令：在文档里写一行核心定的草稿记号 @@livedoc ref src/greet.ts:2-3 @@，
 * check 认它、报未确认，confirm 换成该格式的正式记号。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { targetKey } from "@god-live-doc/core";
import type { Format, Item, Listing } from "@god-live-doc/core";
import { loadProject } from "@god-live-doc/project";

const MARK: Record<string, string> = { fresh: "🟢", changed: "🟡", missing: "🔴", unconfirmed: "⚪" };
const LABEL: Record<string, string> = {
  fresh: "新鲜",
  changed: "有变动，等作者复核",
  missing: "缺失，引用指向空气",
  unconfirmed: "未确认，等作者确认",
};
/** missing 的细分理由，说清楚是哪一种「指向空气」 */
const REASON: Record<string, string> = {
  vanished: "整段已被删光",
  "file-missing": "文件不在了",
  "blob-missing": "记忆里的 blob 不在对象库（浅克隆或历史重写过），重新确认一次",
};

export async function main(argv: string[]): Promise<number> {
  const [command = "check", ...rest] = argv;
  const target = rest.includes("--target") ? rest[rest.indexOf("--target") + 1] : "human";
  if (!["check", "confirm", "render"].includes(command)) {
    console.error(`不认识的命令：${command}——有 check / confirm / render`);
    return 2;
  }

  const project = await loadProject(process.cwd());
  let red = 0;
  const docs = project.docs();

  for (const doc of docs) {
    const text = project.read(doc);
    const format = project.service.formatFor(doc)!;

    if (command === "check") red += check(project, doc, text, format);
    else if (command === "confirm") red += confirm(project, doc, text);
    else red += await render(project, doc, text, format, target);
  }

  // 文档本身删了、挪了：它的记录上面那圈看不到，按文档清单一览。check 算红，confirm 整个忘掉
  if (command === "check") {
    for (const doc of project.service.strays(docs)) {
      console.log(`🔴 ${doc}  文档已不存在，记录簿里还留着它的记录——confirm 会清掉`);
      red += 1;
    }
  } else if (command === "confirm") {
    for (const doc of project.service.forget(docs)) console.log(`🧹 ${doc}  文档已不存在，记录已清`);
  }
  return red > 0 ? 1 : 0;
}

type Project = Awaited<ReturnType<typeof loadProject>>;

function reportItem(doc: string, item: Item): number {
  const why = item.reason !== undefined && REASON[item.reason] !== undefined ? `（${REASON[item.reason]}）` : "";
  console.log(`${MARK[item.status]} ${doc}  ${targetKey(item.reference.target)}  ${LABEL[item.status]}${why}`);
  return item.status === "missing" ? 1 : 0;
}

function check(project: Project, doc: string, text: string, format: Format): number {
  const listing: Listing = project.service.resolve(doc, text);
  let red = 0;
  for (const item of listing.items) red += reportItem(doc, item);
  for (const orphan of listing.orphans) {
    console.log(`🔴 ${doc}  ${targetKey(orphan.target)}  孤儿记录：文档里已经没有这处引用`);
    red += 1;
  }
  if (typeof format.lintComponents === "function") {
    for (const { name, line } of format.lintComponents(text, project.roster)) {
      console.log(`🔴 ${doc}  第 ${line} 行 <${name}>  名册外组件，livedoc.config.mjs 里没给它压平规则`);
      red += 1;
    }
  }
  return red;
}

function confirm(project: Project, doc: string, text: string): number {
  const { listing, text: next, changed, problems } = project.service.confirm(doc, text);
  if (problems.length > 0) {
    // 一处钉不住整篇拒：记录簿一条不写，文档一个字不改
    for (const problem of problems) console.log(`🔴 ${problem}`);
    console.log(`·  ${doc}  这篇整篇没确认——上面几处先处理掉`);
    return problems.length;
  }
  if (changed) project.write(doc, next);
  for (const item of listing.items) {
    const how = item.reference.extra?.draft === true ? "，草稿记号已换成正式记号" : changed ? "，文档已写回" : "";
    console.log(`✅ ${doc}  ${targetKey(item.reference.target)}  已确认${how}`);
  }
  for (const orphan of listing.orphans) console.log(`🧹 ${doc}  ${targetKey(orphan.target)}  孤儿记录已清`);
  return 0;
}

async function render(project: Project, doc: string, text: string, format: Format, target: string | undefined): Promise<number> {
  const fn = target === "ai" ? format.renderAi : format.renderHuman;
  if (typeof fn !== "function") {
    console.log(
      format.final === true
        ? `·  ${doc}  ${format.name} 的产物就是文档本身，人和 AI 都读它`
        : `·  ${doc}  ${format.name} 没有 ${target} 渲染`,
    );
    return 0;
  }
  const listing = project.service.resolve(doc, text);
  const outDir = join(project.root, project.config.out ?? "out");
  mkdirSync(outDir, { recursive: true });
  const outName = `${doc.split("/").pop()}.${target === "ai" ? "ai.md" : "html"}`;
  // 渲染函数吃文本和清单，外加项目上下文：有自己管线的格式（fumadocs）用 root + doc 自己去编译
  const out = await fn(text, listing, {
    root: project.root,
    doc,
    roster: project.roster,
    config: project.config as unknown as Record<string, unknown>,
  });
  writeFileSync(join(outDir, outName), out);
  console.log(`→  ${doc}  渲染成 ${target}：${project.config.out ?? "out"}/${outName}`);
  return 0;
}

/**
 * 读取器的目录树清单，在临时真 git 仓里跑：清单按 .gitignore 过滤。
 * 目录目标从目录自身起找仓（`locateDir`），目标恰是仓根时不能先跳一级——跳出去了 .gitignore 过滤就整个失效。
 * 忽略判定整棵树问一次 `status --ignored=matching`，那几条边角（目录里全是被忽略的文件、被忽略目录里
 * 强制加进来的文件、目标本身在被忽略的目录里）守着它跟逐项问 `check-ignore` 的口径一样。
 * 软链接（pnpm 那种 node_modules → 工作区包）按真实路径读。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { Target } from "../packages/docfirst-pin/src/index.ts";
import { fakeFormat, refLine } from "./fake-format.ts";
import { CODE, run, setupRepo } from "./repo.ts";

const FORMATS = [fakeFormat("fake", ".a")];
const DOC = "docs/a.a";
const tree = (dir: string, depth: number): string => `${refLine({ kind: "tree", dir, depth })}\n`;
const namesOf = (r: ReturnType<typeof setupRepo>, dir: string, depth: number): string[] => r.service.resolve(DOC, tree(dir, depth)).items[0]!.current!;

test("目录树、存在性、名字：清单按 .gitignore 过滤，改名红、多文件黄", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "dist/\n");
    r.write("src/dist/out.js", "x");
    r.write("src/util.ts", "export const a = 1;\n");
    r.commit("起结构");
    const refs: Target[] = [
      { kind: "tree", dir: "src", depth: 1 },
      { kind: "exists", path: "src/greet.ts", absent: false },
      { kind: "exists", path: "src/remove.ts", absent: true },
      { kind: "has", file: "src/greet.ts", text: "export function greet" },
    ];
    r.write(DOC, refs.map(refLine).join("\n\n"));
    r.confirm(DOC);
    const items = r.service.resolve(DOC, r.read(DOC)).items;
    assert.deepEqual(items.map((i) => i.status), ["fresh", "fresh", "fresh", "fresh"]);
    assert.deepEqual(items[0]!.current, ["greet.ts", "util.ts"], "dist/ 被忽略，不进清单");

    r.write("src/tag.ts", "export const t = 1;\n");
    r.write("src/remove.ts", "");
    r.write("src/greet.ts", CODE.replace("function greet", "function hello"));
    const after = r.service.resolve(DOC, r.read(DOC)).items;
    assert.deepEqual(after.map((i) => [i.status, i.reason]), [["changed", "changed"], ["fresh", undefined], ["missing", "appeared"], ["missing", "text-missing"]]);
    assert.deepEqual(after[0]!.current, ["greet.ts", "remove.ts", "tag.ts", "util.ts"]);
  } finally {
    r.teardown();
  }
});

test("目录目标就是仓根：.gitignore 照样过滤——仓从目录自身起找，不先跳一级", () => {
  // 定位跳一级（locate 的口径）时，仓根之上没有 .git 就回 null、忽略集空掉，
  // 树里冒出 node_modules/、lib/，还会随各台机器的目录布局漂
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "node_modules/\nlib/\n");
    r.write("node_modules/pkg/index.js", "x");
    r.write("lib/out.js", "x");
    r.commit("起结构");
    const names = namesOf(r, ".", 1);
    assert.deepEqual(names.filter((n) => n === "node_modules/" || n === "lib/"), [], "被忽略的两个目录不该进清单");
    assert.ok(names.includes("src/"), "没被忽略的照常在");
  } finally {
    r.teardown();
  }
});

test("目录目标是仓根、往下走几层：嵌套层的忽略项同样过滤，忽略的目录不往里走", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "node_modules/\nsrc/dist/\n");
    r.write("node_modules/pkg/index.js", "x");
    r.write("src/dist/out.js", "x");
    r.write("src/util.ts", "export const a = 1;\n");
    r.commit("起结构");
    const names = namesOf(r, ".", 3);
    assert.deepEqual(names.filter((n) => n.startsWith("node_modules")), [], "顶层忽略的目录不进清单，也不往里走");
    assert.deepEqual(names.filter((n) => n.startsWith("src/dist")), [], "嵌套那层的忽略目录一样过滤");
    assert.ok(names.includes("src/greet.ts") && names.includes("src/util.ts"), "src 下没被忽略的都在");
  } finally {
    r.teardown();
  }
});

test("目录本身没被忽略、里面全是被忽略的文件：目录照列，文件不列", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "*.log\n");
    r.commit("忽略日志");
    r.write("logs/a.log", "x");
    const names = namesOf(r, ".", 2);
    assert.ok(names.includes("logs/"), "目录本身不匹配忽略规则，照列");
    assert.ok(!names.includes("logs/a.log"), "里面的文件匹配 *.log，不列");
  } finally {
    r.teardown();
  }
});

test("被忽略的目录里有强制加进来的已跟踪文件：目录与那个文件照列", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "forced/\n");
    r.commit("忽略 forced");
    r.write("forced/keep.txt", "x");
    run(r.root, ["add", "-f", "forced/keep.txt"]);
    r.commit("强制加一个文件");
    const names = namesOf(r, ".", 2);
    assert.ok(names.includes("forced/") && names.includes("forced/keep.txt"), "已跟踪的不算忽略");
  } finally {
    r.teardown();
  }
});

test("目录目标本身落在被忽略的目录里：整棵都算被忽略，清单是空的", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "dist/\n");
    r.commit("忽略 dist");
    r.write("dist/sub/y.js", "x");
    assert.deepEqual(namesOf(r, "dist/sub", 1), []);
  } finally {
    r.teardown();
  }
});

test("软链接按真实路径读：node_modules 里指向工作区目录的链接，读得到内容、钉得住", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write(".gitignore", "node_modules/\n");
    r.write("lib/greet.ts", CODE);
    r.commit("起 lib");
    mkdirSync(join(r.root, "node_modules"));
    // Windows 上目录联接不用管理员权限，pnpm 摆的也是这种；别的平台退成普通目录软链
    symlinkSync(join(r.root, "lib"), join(r.root, "node_modules", "lib"), "junction");
    r.write(DOC, `${refLine({ kind: "span", file: "node_modules/lib/greet.ts", a: 2, b: 3 })}\n`);
    r.confirm(DOC);
    assert.deepEqual(r.statuses(DOC, r.read(DOC)), ["fresh"]);
    r.write("lib/greet.ts", `// 头一行\n${CODE.replace("hello", "hey")}`);
    const item = r.service.resolve(DOC, r.read(DOC)).items[0]!;
    assert.deepEqual([item.status, item.reason, item.lines], ["changed", "changed", [3, 4]], "按真实路径找到仓，旧内容取得到、跟得上 hunk");
  } finally {
    r.teardown();
  }
});

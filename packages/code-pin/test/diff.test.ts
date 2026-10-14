/**
 * 逐行对比：hunk 表与 `git diff -U0` 对拍，行段映射、给人看的对比都出自同一套算法。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffLines, diffText, hunksOf, mapRange, mappedSpan } from "../src/index.ts";
import type { Hunk } from "../src/index.ts";

/** git 给的 hunk 表：两份内容写成临时文件跑 `git diff --no-index -U0` */
function gitHunks(oldText: string, newText: string): Hunk[] {
  const dir = mkdtempSync(join(tmpdir(), "code-pin-diff-"));
  try {
    writeFileSync(join(dir, "old"), oldText);
    writeFileSync(join(dir, "new"), newText);
    let out = "";
    try {
      out = execFileSync("git", ["diff", "--no-index", "-U0", "--no-color", "--", "old", "new"], { cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      if (e.status !== 1) throw err;
      out = e.stdout ?? "";
    }
    return [...out.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map((m) => ({
      oldStart: Number(m[1]),
      oldLen: m[2] === undefined ? 1 : Number(m[2]),
      newStart: Number(m[3]),
      newLen: m[4] === undefined ? 1 : Number(m[4]),
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const BASE = ["// greet", "export function greet(name: string): string {", "  return `hello ${name}`;", "}", "", "export const VERSION = 1;", ""].join("\n");

const CASES: Record<string, string> = {
  没改: BASE,
  头上插两行: `// a\n// b\n${BASE}`,
  改一行: BASE.replace("hello", "hey"),
  删一段: BASE.replace("export function greet(name: string): string {\n  return `hello ${name}`;\n}\n", ""),
  末尾追加: `${BASE}export const NAME = 1;\n`,
  中间插又改: BASE.replace("// greet\n", "// greet\n// 新的说明\n").replace("VERSION = 1", "VERSION = 2"),
  全部换掉: "完全不同\n的内容\n",
};

for (const [name, now] of Object.entries(CASES)) {
  test(`hunk 表跟 git diff -U0 一样：${name}`, () => {
    assert.deepEqual(hunksOf(BASE.split("\n"), now.split("\n")), gitHunks(BASE, now));
  });
}

test("行段映射：上面插两行就平移；段内改了算碰到；整段删光是 vanished", () => {
  const insert = hunksOf(BASE.split("\n"), CASES["头上插两行"]!.split("\n"));
  assert.deepEqual(mappedSpan(mapRange(insert, 2, 3)), [4, 5]);
  const edit = hunksOf(BASE.split("\n"), CASES["改一行"]!.split("\n"));
  assert.deepEqual(mapRange(edit, 2, 3), { touched: true, start: 2, end: 3 });
  const drop = hunksOf(BASE.split("\n"), CASES["删一段"]!.split("\n"));
  assert.equal(mappedSpan(mapRange(drop, 2, 4)), null);
});

test("给人看的对比：先删后增，文本写法是两个字符的前缀", () => {
  const lines = diffLines(["a", "b", "c"], ["a", "B", "c", "d"]);
  assert.deepEqual(lines, [
    { kind: "same", text: "a" },
    { kind: "removed", text: "b" },
    { kind: "added", text: "B" },
    { kind: "same", text: "c" },
    { kind: "added", text: "d" },
  ]);
  assert.equal(diffText(lines), "  a\n- b\n+ B\n  c\n+ d");
});

/**
 * `hashText` 跟真 git 对照：自己算出来的 blob 名必须跟 `git hash-object --stdin` 逐字节相同。
 * 这条不成立，比较器会把没动过的内容判成变了——整站的绿灯全部变黄。
 */

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { test } from "vitest";
import { hashText } from "../src/index.ts";

/** git 自己怎么算。跑在临时目录里：算哈希不需要仓，也不往任何对象库写东西 */
function gitHashObject(text: string): string {
  return execFileSync("git", ["hash-object", "--stdin"], {
    cwd: tmpdir(),
    encoding: "utf8",
    input: text,
    timeout: 30_000,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/** 挑的都是「字节数不等于字符数」或「边界」的情形——哈希头里写的是字节数 */
const CASES: Record<string, string> = {
  空文本: "",
  一行不带换行: "hello",
  一行带换行: "hello\n",
  多行: "a\nb\nc\n",
  末尾连着几个空行: "x\n\n\n",
  中文: "钉住的是内容，不是行号\n",
  中英混排: 'export const 名字 = "值";\n',
  四字节字符: "🌱 一段带代理对的文本\n",
  制表符与回车: "a\tb\r\nc\n",
  只有一个换行: "\n",
};

for (const [name, text] of Object.entries(CASES)) {
  test(`hashText 跟 git hash-object 算得一样：${name}`, () => {
    assert.equal(hashText(text), gitHashObject(text));
  });
}

test("hashText 认字节数不是字符数", () => {
  const text = "中\n";
  assert.equal(hashText(text), gitHashObject(text));
  assert.notEqual(hashText(text), hashText("ab\n"));
});

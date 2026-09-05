/**
 * 站的轨迹接线测试：`livedoc.config.mjs` 配了 `trajectory: "cards"`，于是
 *   livedoc check              顺带跑卡校验——病卡逐条打印、算红退 1
 *   livedoc trajectory --json  出 buildTrajectory 的整份模型
 * 直接调 cli 的 main、不起子进程（跟工作区的 tests/cli.test.ts 一个路子），截 console.log
 * 看打印；cwd 就是站根，`node --test` 起在这儿，loadProject 读的就是本站那份配置。
 *
 * 红那条路要自己造病卡：cards/ 里那 107 张诗名 fixture 全是好卡。测试当场写一张、跑完就删，
 * 名字前缀也进了 .gitignore——崩在半路也脏不了工作区。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { main } from "@godcreator02/live-doc-cli";

/** 截住 console.log 跑一条命令，交回退出码与打印 */
async function cli(...args) {
  const said = [];
  const log = console.log;
  console.log = (...parts) => void said.push(parts.join(" "));
  try {
    const code = await main(args);
    return { code, out: said.join("\n") };
  } finally {
    console.log = log;
  }
}

const SICK_NAME = "zzsick-测试用病卡.md";
const SICK_PATH = join(process.cwd(), "cards", SICK_NAME);
/** born-at 写成中文、parent 里塞自己：形状病加一致性病各一条，两条都该被打出来 */
const SICK_TEXT = [
  "---",
  "born-at: 一月一号",
  "label: 测试用病卡",
  "parent:",
  '  - "zzsick-测试用病卡"',
  "---",
  "",
  "正文。",
  "",
].join("\n");

test("配了 trajectory 的站：check 顺带跑卡校验，病卡逐条打印、算红退 1", async () => {
  writeFileSync(SICK_PATH, SICK_TEXT);
  try {
    const red = await cli("check");
    assert.equal(red.code, 1, red.out);
    assert.match(red.out, /🔴 cards\/zzsick-测试用病卡\.md {2}born-at：/);
    assert.match(red.out, /🔴 cards\/zzsick-测试用病卡\.md {2}parent：/);
  } finally {
    rmSync(SICK_PATH, { force: true });
  }
});

test("cards/ 里的诗名 fixture 全是好卡：病卡撤掉，check 回绿退 0", async () => {
  const green = await cli("check");
  assert.equal(green.code, 0, green.out);
  assert.doesNotMatch(green.out, /🔴/);
});

test("livedoc trajectory --json：退 0，模型里至少一张盘", async () => {
  const result = await cli("trajectory", "--json");
  assert.equal(result.code, 0, result.out);
  const data = JSON.parse(result.out);
  assert.ok(data.disks.length >= 1, `cards/ 里有根卡，至少该出一张盘：${data.disks.length}`);
});

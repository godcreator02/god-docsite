// 用法：node measure-hunk-cache.mjs <cli.mjs> <项目根>
// 同一个项目各跑三次 docfirst check：先留着系统临时目录里的 hunk 磁盘缓存，再每次跑之前清掉它，比较用时。
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [cli, cwd] = process.argv.slice(2);
const HUNK_DIR = join(tmpdir(), "docfirst-cache", "hunks");
const timeCheck = () => {
  const start = performance.now();
  const r = spawnSync(process.execPath, [cli, "check"], { cwd, encoding: "utf8", timeout: 300_000 });
  if (r.status === null) throw new Error("check 超时");
  return Math.round(performance.now() - start);
};
timeCheck();
const warm = [timeCheck(), timeCheck(), timeCheck()];
const cold = [1, 2, 3].map(() => {
  rmSync(HUNK_DIR, { recursive: true, force: true });
  return timeCheck();
});
console.log(`磁盘缓存目录：${HUNK_DIR}`);
console.log(`留着磁盘缓存：${warm.join(" / ")} 毫秒`);
console.log(`每次先清掉：${cold.join(" / ")} 毫秒`);

// 用 --import 装进 docfirst 的进程：给每次 execFileSync 起的 git 计次、计时，进程退出时打一张表到 stderr。
// 只看子进程，不改被测代码。表头「总」是从装进来到进程退出的墙钟时间。
import cp from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

const stats = new Map();
const t0 = performance.now();
const orig = cp.execFileSync;
cp.execFileSync = function (file, args, opts) {
  const key = `${file} ${(args ?? []).filter((a) => !a.startsWith("HEAD:") && !/^[0-9a-f]{40}$/.test(a)).slice(0, 3).join(" ")}`;
  const s = performance.now();
  try {
    return orig.call(this, file, args, opts);
  } finally {
    const e = stats.get(key) ?? { n: 0, ms: 0 };
    e.n += 1;
    e.ms += performance.now() - s;
    stats.set(key, e);
  }
};
syncBuiltinESMExports();

process.on("exit", () => {
  const total = performance.now() - t0;
  let n = 0;
  let ms = 0;
  const rows = [...stats].sort((a, b) => b[1].ms - a[1].ms);
  for (const [, v] of rows) {
    n += v.n;
    ms += v.ms;
  }
  process.stderr.write(`== 总 ${total.toFixed(0)}ms；子进程 ${n} 次共 ${ms.toFixed(0)}ms ==\n`);
  for (const [k, v] of rows) process.stderr.write(`${String(v.n).padStart(5)} 次 ${v.ms.toFixed(0).padStart(7)}ms  ${k}\n`);
});

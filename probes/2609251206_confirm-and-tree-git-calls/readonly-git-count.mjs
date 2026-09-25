// 用 --import 装进 docfirst 的进程：给每次 git 调用计次、计时；把写记录簿、写文档的写盘换成空操作，
// 这样 confirm 也能真跑一遍量时间，仓里一个字不动（hunk 缓存与 diff 临时文件照常写，那是被测行为的一部分）。
// 进程退出时往 stderr 打一张表。
import fs from "node:fs";
import cp from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

const t0 = performance.now();
const blocked = [];
for (const name of ["writeFileSync", "renameSync"]) {
  const orig = fs[name];
  fs[name] = (path, ...rest) => {
    if (String(path).includes("docfirst-cache") || String(path).includes("docfirst-diff-")) return orig(path, ...rest);
    blocked.push(`${name} ${path}`);
  };
}
const spawns = new Map();
const origExec = cp.execFileSync;
cp.execFileSync = function (file, args, opts) {
  const key = `${file} ${(args ?? []).filter((a) => !a.startsWith("HEAD:")).slice(0, 2).join(" ")}`;
  const start = performance.now();
  try {
    return origExec.call(this, file, args, opts);
  } finally {
    const entry = spawns.get(key) ?? [0, 0];
    entry[0] += 1;
    entry[1] += performance.now() - start;
    spawns.set(key, entry);
  }
};
syncBuiltinESMExports();

process.on("exit", () => {
  let count = 0;
  let ms = 0;
  for (const [, v] of spawns) {
    count += v[0];
    ms += v[1];
  }
  const lines = [`== 墙钟 ${(performance.now() - t0).toFixed(0)}ms；git ${count} 次 ${ms.toFixed(0)}ms；拦下的写盘 ${blocked.length} 次`];
  for (const [k, v] of [...spawns].sort((a, b) => b[1][1] - a[1][1])) lines.push(`   ${String(v[0]).padStart(4)} 次 ${v[1].toFixed(0).padStart(6)}ms  ${k}`);
  for (const b of blocked) lines.push(`   拦下 ${b}`);
  process.stderr.write(`${lines.join("\n")}\n`);
});

// 用法：node compare-dumps.mjs <旧导出> <新导出>
// 除病卡清单外逐项比对，列出不同的卡目录与字段；病卡清单另列每个目录新增、消失的病。
import { readFileSync } from "node:fs";

const [oldFile, newFile] = process.argv.slice(2);
const a = JSON.parse(readFileSync(oldFile, "utf8"));
const b = JSON.parse(readFileSync(newFile, "utf8"));
const site = (dir) => dir.split(/[\\/]/).slice(-4, -3)[0] + (dir.includes("fixtures") ? "（fixture）" : "");
let same = true;
for (const dir of Object.keys(a)) {
  for (const key of Object.keys(a[dir])) {
    if (key === "sick") continue;
    if (JSON.stringify(a[dir][key]) !== JSON.stringify(b[dir][key])) {
      same = false;
      console.log(`不同：${site(dir)} 的 ${key}`);
    }
  }
  const flat = (sick) => sick.flatMap((f) => f.problems.map((p) => `${f.path}  ${p.field}：${p.reason}（${p.value}）`));
  const before = new Set(flat(a[dir].sick));
  const after = new Set(flat(b[dir].sick));
  const added = [...after].filter((x) => !before.has(x));
  const removed = [...before].filter((x) => !after.has(x));
  if (added.length || removed.length) {
    console.log(`病卡变化：${site(dir)}  新增 ${added.length}，消失 ${removed.length}`);
    for (const x of added) console.log(`  + ${x}`);
    for (const x of removed) console.log(`  - ${x}`);
  }
}
console.log(same ? "病卡清单以外逐项相同" : "病卡清单以外有不同");

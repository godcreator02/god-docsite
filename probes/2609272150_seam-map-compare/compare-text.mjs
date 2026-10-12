// 用法：node compare-text.mjs <旧 seam-map.ai.mjs> <新 seam-map.ai.mjs>
// 两份机读规则对每张图各生成一遍机读文字，逐段比较；段落函数原样交回文字，只比文字本身。
import { pathToFileURL } from "node:url";

const [oldPath, newPath] = process.argv.slice(2);
if (oldPath === undefined || newPath === undefined) {
  console.error("用法：node compare-text.mjs <旧 seam-map.ai.mjs> <新 seam-map.ai.mjs>");
  process.exit(2);
}

const MODULES = [undefined, "pin", "trajectory", "workflow", "fumadocs", "explainer-player", "plugin", "seam-map-plan"];
const helpers = { paragraph: (text) => text, attr: (node, key) => node[key] };

const oldRule = (await import(pathToFileURL(oldPath).href)).SeamMap;
const newRule = (await import(pathToFileURL(newPath).href)).SeamMap;

let differences = 0;
for (const module of MODULES) {
  const node = module === undefined ? {} : { module };
  const before = oldRule(node, helpers);
  const after = newRule(node, helpers);
  const name = module ?? "全局图";
  if (JSON.stringify(before) === JSON.stringify(after)) {
    console.log(`相同  ${name}：${after.length} 段，${after.join("").length} 字`);
    continue;
  }
  differences += 1;
  console.log(`不同  ${name}：旧 ${before.length} 段，新 ${after.length} 段`);
  for (let i = 0; i < Math.max(before.length, after.length); i += 1) {
    if (before[i] !== after[i]) console.log(`  第 ${i + 1} 段\n    旧：${before[i]}\n    新：${after[i]}`);
  }
}
process.exit(differences === 0 ? 0 : 1);

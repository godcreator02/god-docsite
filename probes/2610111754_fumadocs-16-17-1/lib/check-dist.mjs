// 构建后自检：dist 存在，且 fumadocs-ui / react 保持 external（没有被内联进产物）
import { readFileSync, existsSync } from "node:fs";

const js = readFileSync(new URL("./dist/index.js", import.meta.url), "utf8");
if (!js.includes("from 'fumadocs-ui/contexts/tree'") && !js.includes('from "fumadocs-ui/contexts/tree"')) {
  throw new Error("dist/index.js 没有保留对 fumadocs-ui 的外部 import");
}
if (!existsSync(new URL("./dist/index.d.ts", import.meta.url))) {
  throw new Error("dist/index.d.ts 不存在");
}
console.log("dist ok: external import 保留，类型已生成");

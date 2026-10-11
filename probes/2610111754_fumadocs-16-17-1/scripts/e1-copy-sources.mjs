// E-1：把 gwb-docfirst 的正本复制进实验站点（保持相对结构），并把独占一行的 {/* ref / tree */} 改写成 <Pin>/<PinTree>
// 认法与 renderAi 的 markerOf 对齐：只有独占一行的花括号注释（mdxFlowExpression）才是记号；
// 行内与代码块里的示例文字两条管线都原样保留，不改写
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const probeRoot = fileURLToPath(new URL("..", import.meta.url));
const docsSite = "D:/unitfolders/oz47p-docsite-kit/gwb-docfirst/docs-site";
const site = probeRoot + "site";

// 正本 → 实验站内的位置（对应 docfirst.config.mjs 的 outputs 键）
const targets = [];
const outputsDir = docsSite + "/content/docs/outputs";
for (const f of readdirSync(outputsDir)) {
  if (f.endsWith(".mdx")) targets.push([outputsDir + "/" + f, "content/docs/outputs/" + f]);
}
for (const f of readdirSync(outputsDir + "/skills")) {
  if (f.endsWith(".mdx")) targets.push([outputsDir + "/skills/" + f, "content/docs/outputs/skills/" + f]);
}
targets.push([docsSite + "/content/maintain/agents.mdx", "content/docs/maintain/agents.mdx"]);

const MARK = /^\{\/\*\s*(ref|tree)\s+([^*]+?)\s*\*\/\}\s*$/;
let rewritten = 0;
for (const [from, to] of targets) {
  const text = readFileSync(from, "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let fence = null; // 当前围栏（三个及以上反引号或波浪线）的标记，代码块内部的行不改写
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      if (openMatch && openMatch[1][0] === fence[0] && openMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (openMatch) {
      fence = openMatch[1];
      continue;
    }
    const m = MARK.exec(line);
    if (!m) continue;
    // 载荷形如 file="…" lines="…"（ref）或 dir="…" depth="2" glob="*.test.ts"（tree），属性原样搬进 JSX
    const attrs = m[2];
    lines[i] = m[1] === "ref" ? `<Pin ${attrs} />` : `<PinTree ${attrs} />`;
    rewritten++;
    console.log(`${to}:${i + 1} 改写为 ${m[1] === "ref" ? "Pin" : "PinTree"}`);
  }
  mkdirSync(site + "/" + to.slice(0, to.lastIndexOf("/")), { recursive: true });
  writeFileSync(site + "/" + to, lines.join("\n"));
  void copyFileSync;
}
console.log(`共 ${targets.length} 份正本，改写记号 ${rewritten} 处`);

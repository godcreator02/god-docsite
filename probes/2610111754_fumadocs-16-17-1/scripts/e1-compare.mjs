// E-1：新流水线输出（out/e8/）与 gwb-docfirst 现在的生成物逐字节比，两边都去掉 frontmatter，只比正文
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const probeRoot = fileURLToPath(new URL("..", import.meta.url));
const gwb = "D:/unitfolders/oz47p-docsite-kit/gwb-docfirst";
const skill = (name) => `${gwb}/plugins/docfirst/skills/${name}/SKILL.md`;

const pairs = [
  ["outputs__readme.mdx.md", `${gwb}/README.md`],
  ["maintain__agents.mdx.md", `${gwb}/AGENTS.md`],
  ["outputs__claude.mdx.md", `${gwb}/CLAUDE.md`],
  ["outputs__skills__docs-site.mdx.md", skill("docs-site")],
  ["outputs__skills__docs-writing.mdx.md", skill("docs-writing")],
  ["outputs__skills__trajectory.mdx.md", skill("trajectory")],
];

const stripFrontmatter = (text) => {
  let t = text.replace(/\r\n/g, "\n");
  if (t.startsWith("---\n")) {
    const end = t.indexOf("\n---\n", 4);
    if (end >= 0) t = t.slice(end + 5);
  }
  return t;
};

const classify = (line) => {
  if (line === "") return "空行与换行";
  if (/^#{1,6} .*\{#/.test(line)) return "标题 id";
  if (/!\[|<img /.test(line)) return "图片";
  if (/^```(npm|sh|bash)/.test(line) || /npm (i|install|add|dlx)/.test(line)) return "npm 代码块";
  if (/^(```|~~~)/.test(line)) return "代码块围栏";
  if (/^[\t ]*<\/?[A-Z][\w$]*/.test(line)) return "组件";
  return null;
};

const report = [];
for (const [newName, oldPath] of pairs) {
  const oldText = stripFrontmatter(readFileSync(oldPath, "utf8"));
  const newText = stripFrontmatter(readFileSync(`${probeRoot}out/e8/${newName}`, "utf8"));
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  report.push(`## ${newName}（旧 ${oldLines.length} 行 / 新 ${newLines.length} 行）`);
  if (oldText === newText) {
    report.push("正文逐字节一致");
    continue;
  }
  // 朴素 diff：LCS 太重，用对齐游标记录增删行
  let i = 0;
  let j = 0;
  let diffCount = 0;
  const diffs = [];
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
      continue;
    }
    // 向前看 5 行找重合点
    let oi = -1;
    let nj = -1;
    outer: for (let d = 1; d <= 5; d++) {
      for (let k = 0; k <= d; k++) {
        if (i + k < oldLines.length && j + d - k < newLines.length && oldLines[i + k] === newLines[j + d - k]) {
          oi = k;
          nj = d - k;
          break outer;
        }
      }
    }
    if (oi === -1) {
      diffs.push({ at: i, old: oldLines.slice(i, i + 1), new: newLines.slice(j, j + 1) });
      i++;
      j++;
    } else {
      if (oi > 0 || nj > 0) diffs.push({ at: i, old: oldLines.slice(i, i + oi), new: newLines.slice(j, j + nj) });
      i += oi;
      j += nj;
    }
    diffCount++;
    if (diffCount > 400) {
      diffs.push({ at: i, old: ["（差异过多，截断）"], new: [] });
      break;
    }
  }
  for (const d of diffs) {
    const kinds = new Set();
    for (const l of [...d.old, ...d.new]) {
      const k = classify(l);
      if (k) kinds.add(k);
    }
    report.push(
      `L${d.at + 1}${kinds.size > 0 ? `［${[...kinds].join("+")}］` : "［其他］"}\n  旧: ${JSON.stringify(d.old)}\n  新: ${JSON.stringify(d.new)}`,
    );
  }
}
const out = report.join("\n");
writeFileSync(`${probeRoot}out/e1-compare-report.txt`, out);
console.log(out.slice(0, 6000));

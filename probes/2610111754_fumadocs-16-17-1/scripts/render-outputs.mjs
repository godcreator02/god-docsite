// E-8：用 Vite 加载站点（middlewareMode），取每页导出的 _markdown 组件，renderToMarkdown 渲染成文字写到 out/
// 用法：node scripts/render-outputs.mjs <页面path...>（如 /e8.mdx）；不传参数渲染全部 docs 页
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const probeRoot = fileURLToPath(new URL("..", import.meta.url));
const siteDir = probeRoot + "site";
const outDir = probeRoot + "out/e8";
mkdirSync(outDir, { recursive: true });

// vite 装在 site/ 下，从 site 的 package.json 解析
const siteRequire = createRequire(siteDir + "/package.json");
const { createServer } = await import(pathToFileURL(siteRequire.resolve("vite")).href);

const t0 = Date.now();
const server = await createServer({
  root: siteDir,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const loadStart = Date.now();
const entry = await server.ssrLoadModule("/app/lib/e8-entry.ts");
const { renderPageMarkdown } = entry;

let paths = process.argv.slice(2);
if (paths.length === 0) {
  const source = await server.ssrLoadModule("/app/lib/source.ts");
  paths = source.source.getPages().map((p) => p.path);
}

for (const path of paths) {
  const pageStart = Date.now();
  const md = await renderPageMarkdown(path);
  const name = path.replace(/^\//, "").replace(/[\\/]/g, "__");
  writeFileSync(`${outDir}/${name}.md`, md);
  console.log(`${path} -> out/e8/${name}.md（${Date.now() - pageStart}ms，${md.length} 字符）`);
}

await server.close();
console.log(
  `共 ${paths.length} 页：Vite 启动 ${loadStart - t0}ms，加载与渲染 ${Date.now() - loadStart}ms，总耗时 ${Date.now() - t0}ms`,
);

// 变体 A：仿 fumadocs-mdx codegen 生成的相对 base 形态。
// fumadocs-mdx dist 的 createCodegen.generateViteGlobImport 产出
//   base: normalizeViteGlobPath(path.relative(outDir, baseDir))
// 在 Windows 上即 './../content' 这种相对 base。这是 import.meta.glob 的公开用法。
const files = import.meta.glob(['./**/*.txt'], {
  base: './../content',
  query: '?raw',
  import: 'default',
  eager: true,
});
const keys = Object.keys(files).sort();
window.__globKeys = keys;
const el = document.getElementById('glob-keys');
if (el) el.textContent = keys.length ? keys.join(' | ') : '(empty)';

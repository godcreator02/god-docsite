// 变体 B：与 A 唯一差异是 base 用根相对形式 '/content'
// （toAbsoluteGlob 走 posix.join(root, base) 分支，root 是 slash 后的 D:/... 绝对路径）
const files = import.meta.glob(['./**/*.txt'], {
  base: '/content',
  query: '?raw',
  import: 'default',
  eager: true,
});
const keys = Object.keys(files).sort();
window.__globKeys = keys;
const el = document.getElementById('glob-keys');
if (el) el.textContent = keys.length ? keys.join(' | ') : '(empty)';

// 变体 C：与 A 唯一差异是不用 base 选项，直接写相对 glob '../content/**/*.txt'
// （toAbsoluteGlob 走 glob.startsWith('../') 分支：posix.join(dirname(importer), glob)）
const files = import.meta.glob(['../content/**/*.txt'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const keys = Object.keys(files).sort();
window.__globKeys = keys;
const el = document.getElementById('glob-keys');
if (el) el.textContent = keys.length ? keys.join(' | ') : '(empty)';

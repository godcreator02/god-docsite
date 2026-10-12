// 变体 D：相对 base（同 A）+ 否定 glob '!./skip-*.txt'。
// 验证补丁对否定形式的相对 glob 同样生效：
// 初始键应含 initial-d.txt、不含 skip-initial-d.txt；
// 运行中新增的普通文件应被发现（补丁版），新增的 skip- 文件应被排除。
const files = import.meta.glob(['./**/*.txt', '!./skip-*.txt'], {
  base: './../content',
  query: '?raw',
  import: 'default',
  eager: true,
});
const keys = Object.keys(files).sort();
window.__globKeys = keys;
const el = document.getElementById('glob-keys');
if (el) el.textContent = keys.length ? keys.join(' | ') : '(empty)';

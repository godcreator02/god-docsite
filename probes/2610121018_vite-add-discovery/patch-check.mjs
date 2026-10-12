// 补丁改法验证：toAbsoluteGlob 相对 base 分支
//   现在：dir = posix.resolve(importerDir, base)   → Windows 上产出 "/cwd去盘符/D:/…" 假路径
//   改为：dir = posix.join(importerDir, base)      → 与 base[0]==='/' 分支、'../' 分支同构
// posix.join 不做 isAbsolute 判断，对已 normalizePath（正斜杠、盘符开头）的输入直接拼接并消 ./..
import { posix, win32 } from 'node:path';

const cases = [
  ['D:/unitfolders/x/site/src', './../content'],
  ['D:/unitfolders/x/site/src', '../content'],
  ['D:/unitfolders/x/site/.sources', './../content/docs'],
  ['D:/a/b/src', './../../c'],
  // 无 importer（虚拟模块）场景：toAbsoluteGlob 用 root 当锚点，
  // 原版 posix.resolve(root, base) 同样会拼 cwd 前缀产出假路径，补丁后 posix.join 正确
  ['D:/unitfolders/x/site', './content'],
  ['D:/unitfolders/x/site', './../shared/content'],
];

for (const [importerDir, base] of cases) {
  const resolved = posix.resolve(importerDir, base);
  const joined = posix.join(importerDir, base);
  const win32Ref = win32.resolve(importerDir, base).replaceAll('\\', '/');
  const ok = joined === win32Ref;
  console.log(`base=${base}`);
  console.log(`  posix.resolve → ${resolved}  ${resolved === win32Ref ? '' : '✗ 错'}`);
  console.log(`  posix.join    → ${joined}  ${ok ? '✓ 与 win32.resolve 一致' : '✗ 不一致'}`);
}

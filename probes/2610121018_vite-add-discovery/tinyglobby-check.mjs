// 补实验：transformGlobImport 初次扫描用 globsResolved（A 变体是 posix.resolve 产出的
// 假绝对路径 "/<cwd去盘符>/D:/.../content/**/*.txt"）调 tinyglobby。
// 问题：假 glob 为什么初始扫描还能找到文件？（解释「已有文件正常、新增失效」）
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vitePkgDir = path.dirname(require.resolve('vite/package.json'));
const { glob } = require(require.resolve('tinyglobby', { paths: [vitePkgDir] }));

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cases', 'variant-a').replaceAll('\\', '/');
const importerDir = `${root}/src`;
const { posix } = require('node:path');

const fakeGlob = posix.join(posix.resolve(importerDir, './../content'), '**/*.txt');
const realGlob = `${root}/content/**/*.txt`;
console.log('fakeGlob =', JSON.stringify(fakeGlob));
console.log('realGlob =', JSON.stringify(realGlob));

// vite transformGlobImport 的调用形态：cwd = getCommonBase(globsResolved) ?? root
// 这里分别以 root 与假前缀为 cwd 试一次，再试 fast-glob 对两种 pattern 的行为
for (const [label, pattern, cwd] of [
  ['fake + cwd=root', fakeGlob, root],
  ['fake + cwd=假前缀(截到最后一个静态段)', fakeGlob, fakeGlob.slice(0, fakeGlob.indexOf('**'))],
  ['real + cwd=root', realGlob, root],
]) {
  try {
    const files = await glob([pattern], {
      absolute: true,
      cwd,
      expandDirectories: false,
      caseSensitiveMatch: true,
      ignore: ['**/node_modules/**'],
      extglob: false,
    });
    console.log(`${label} ->`, JSON.stringify(files, null, 0));
  } catch (e) {
    console.log(`${label} -> 出错：${e.message}`);
  }
}

// Windows 上 node:path.posix.resolve 对「带盘符的正斜杠绝对路径」的处理对照。
// 对应 vite 8.3.4 dist/node/chunks/node.js:27967 的
//   dir = posix.resolve(importer ? globSafePath(dirname(importer)) : root, base)
// importer 经 vite 的 slash/normalizePath 后是 "D:/..." 正斜杠形式。
import { posix, win32 } from 'node:path';

const importerDir = 'D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610121018_vite-add-discovery/site/src';
const base = './../content'; // fumadocs-mdx codegen 生成的相对 base 形态

console.log('process.cwd() =', JSON.stringify(process.cwd()));
console.log('posix.resolve(importerDir, base) =', JSON.stringify(posix.resolve(importerDir, base)));
console.log('win32.resolve(importerDir, base) =', JSON.stringify(win32.resolve(importerDir, base)));
console.log('posix.isAbsolute(importerDir)   =', posix.isAbsolute(importerDir));
console.log('win32.isAbsolute(importerDir)   =', win32.isAbsolute(importerDir));

// 再验证后续步骤：posix.join(dir, "**/*.txt")（vite 用 glob[0]==="./" 分支时是 join(dir, glob.slice(2))）
const dir = posix.resolve(importerDir, base);
console.log('posix.join(dir, "**/*.txt")     =', JSON.stringify(posix.join(dir, '**/*.txt')));

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, readdirSync, realpathSync } from 'node:fs';
const root = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(root + 'site/package.json');
const versions = {};
for (const name of ['fumadocs-core', 'fumadocs-mdx', 'vite', 'react', 'react-router']) {
  let dir = dirname(realpathSync(require.resolve(name === 'fumadocs-core' ? name + '/mdx-plugins/stringifier' : name)));
  for (;;) {
    const path = join(dir, 'package.json');
    if (existsSync(path)) {
      const pkg = JSON.parse(readFileSync(path, 'utf8'));
      if (pkg.name === name) { versions[name] = { version: pkg.version, packageJson: path }; break; }
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`cannot locate ${name} package.json`);
    dir = parent;
  }
}
const files = [];
function walk(dir, relative = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = relative + entry.name;
    if (entry.isSymbolicLink() || path === 'out/vite-cache' || path === 'site/.react-router') continue;
    if (entry.isDirectory()) walk(join(dir, entry.name), path + '/');
    else files.push(path);
  }
}
const report = { node: process.version, versions, upstreamTag: 'fumadocs@16.17.1', upstreamCommit: 'd6cfc48d62aa9ea413f0fc5033617c0c923681ec', dependencyJunction: realpathSync(root + 'site/node_modules'), cacheDir: 'out/vite-cache', httpListening: false };
writeFileSync(root + 'out/environment.json', JSON.stringify(report, null, 2));
walk(root);
files.push('out/new-files.txt');
writeFileSync(root + 'out/new-files.txt', [...new Set(files)].sort().join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));

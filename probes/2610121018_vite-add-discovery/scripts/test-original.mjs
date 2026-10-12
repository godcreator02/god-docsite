// 原版基线复跑：临时移除本 probe 的 patchedDependencies → pnpm install（恢复原版
// vite 8.3.4）→ vitest run（测试探测到原版，套基线断言组：A 失败 / B、C 成功）→
// 无论成败 finally 恢复补丁配置并重装。
// 只改写本 probe 的 pnpm-workspace.yaml 与 pnpm-lock.yaml（最终原样恢复），
// 不碰全局 pnpm store、不碰本目录之外的任何文件。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const probeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wsPath = path.join(probeRoot, 'pnpm-workspace.yaml');
const originalYaml = fs.readFileSync(wsPath, 'utf8');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: probeRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 退出码 ${r.status}`);
}

const withoutPatch = originalYaml.replace(
  /\r?\npatchedDependencies:\r?\n  vite@8\.3\.4: patches\/vite@8\.3\.4\.patch\r?\n?/,
  '\n',
);
if (withoutPatch === originalYaml) throw new Error('pnpm-workspace.yaml 里没找到 patchedDependencies 段');

try {
  fs.writeFileSync(wsPath, withoutPatch);
  console.log('=== 临时移除补丁，恢复原版 vite 8.3.4 ===');
  run('pnpm', ['install']);
  console.log('=== 原版基线（预期：A 失败断言通过 / B、C 成功）===');
  run('pnpm', ['test']);
} finally {
  fs.writeFileSync(wsPath, originalYaml);
  console.log('=== 恢复补丁配置并重装 ===');
  run('pnpm', ['install']);
  console.log('补丁已恢复（patchedDependencies + lock + node_modules 均回到补丁版）');
}

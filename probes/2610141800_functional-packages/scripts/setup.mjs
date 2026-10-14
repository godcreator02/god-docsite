import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { probeDir, runLogged, siteDir } from './lib.mjs';

const variantsDir = path.join(probeDir, 'site-variants');
const tarballsDir = path.join(probeDir, 'tarballs');
const featurePackageNames = ['demo-content', 'demo-pages'];

function listFiles(dir, prefix = '') {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    return statSync(full).isDirectory() ? listFiles(full, relative) : [relative];
  });
}

export const collectionVariants = readdirSync(variantsDir);

// 把一种集合写法的文件覆盖进 site/；别的写法有、这种写法没有的文件（如 source.config.ts）从 site/ 删掉
export function applyCollectionsVariant(name) {
  if (!collectionVariants.includes(name)) throw new Error(`没有集合写法 ${name}，可选：${collectionVariants.join(', ')}`);
  const allOverlayFiles = new Set(collectionVariants.flatMap((variant) => listFiles(path.join(variantsDir, variant))));
  const variantFiles = new Set(listFiles(path.join(variantsDir, name)));
  for (const relative of allOverlayFiles) {
    const target = path.join(siteDir, relative);
    if (variantFiles.has(relative)) {
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(path.join(variantsDir, name, relative), target);
    } else if (existsSync(target)) {
      rmSync(target);
    }
  }
  rmSync(path.join(siteDir, '.source'), { recursive: true, force: true });
}

export function buildFeaturePackages(logName) {
  const result = runLogged('pnpm', ['--filter', './packages/*', 'build'], { cwd: probeDir, logName, timeoutMs: 300_000 });
  if (result.status !== 0) throw new Error(`功能包构建失败，见 ${result.logFile}`);
}

function writeSiteDependencies(specifiers) {
  const packageJsonPath = path.join(siteDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  for (const [name, specifier] of Object.entries(specifiers)) packageJson.dependencies[name] = specifier;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

// linked：workspace:* 链接（包的真实路径在 packages/ 下）；packed：pnpm pack 出 tarball 再按 file: 装（真实路径在 node_modules/.pnpm 下，模拟从 registry 装）
export function applyInstallMode(mode, logPrefix) {
  if (mode === 'linked') {
    writeSiteDependencies(Object.fromEntries(featurePackageNames.map((name) => [name, 'workspace:*'])));
  } else if (mode === 'packed') {
    rmSync(tarballsDir, { recursive: true, force: true });
    mkdirSync(tarballsDir, { recursive: true });
    for (const name of featurePackageNames) {
      const result = runLogged('pnpm', ['pack', '--pack-destination', tarballsDir], {
        cwd: path.join(probeDir, 'packages', name),
        logName: `${logPrefix}-pack-${name}.txt`,
        timeoutMs: 120_000,
      });
      if (result.status !== 0) throw new Error(`pnpm pack ${name} 失败，见 ${result.logFile}`);
    }
    writeSiteDependencies(Object.fromEntries(featurePackageNames.map((name) => [name, `file:../tarballs/${name}-0.0.0.tgz`])));
  } else {
    throw new Error(`没有装法 ${mode}，可选：linked、packed`);
  }
  const install = runLogged('pnpm', ['install'], { cwd: probeDir, logName: `${logPrefix}-install.txt`, timeoutMs: 600_000 });
  if (install.status !== 0) throw new Error(`pnpm install 失败，见 ${install.logFile}`);
  return describeInstalledFeaturePackages();
}

export function describeInstalledFeaturePackages() {
  return featurePackageNames.map((name) => {
    const linkPath = path.join(siteDir, 'node_modules', name);
    const realPath = existsSync(linkPath) ? path.relative(probeDir, realpathSync(linkPath)) : '(未安装)';
    return `${name} → ${realPath}`;
  });
}

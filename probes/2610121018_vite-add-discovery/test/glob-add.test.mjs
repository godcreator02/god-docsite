// 任务 U 核心实验：纯 Vite 8.3.4（无 Fumadocs / React Router / React），
// 区分「watcher add 事件是否收到」与「import.meta.glob 集合是否失效更新」。
// 三个变体唯一差异是 import.meta.glob 的 base 写法，各自独立 root、独立 content、
// 唯一新增文件名，串行执行。
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path, { posix, win32 } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'vite';
import { diagnosticsPlugin } from '../diag/diagnostics.mjs';

const probeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logsDir = path.join(probeRoot, 'logs');
await fs.mkdir(logsDir, { recursive: true });

// ---- 安装状态探测：区分 unpatched 基线与 patched 对照，两组断言不互相覆盖 ----
// 读已安装 vite 的 toAbsoluteGlob 相对 base 分支（dist/node/chunks/node.js:27967）：
//   原版：posix.resolve(importer…) → A 变体新增失效（基线：A 失败 / B、C 成功）
//   补丁：posix.join(importer…)    → 三变体全部成功（patches/vite@8.3.4.patch）
const require2 = createRequire(import.meta.url);
function detectVitePatchState() {
  const viteDir = path.dirname(require2.resolve('vite/package.json'));
  const file = path.join(viteDir, 'dist', 'node', 'chunks', 'node.js');
  const m = fsSync.readFileSync(file, 'utf8').match(/else dir = posix\.(resolve|join)\(importer/);
  if (!m) throw new Error(`在 ${file} 未找到 toAbsoluteGlob 相对 base 分支，无法探测安装状态`);
  return m[1] === 'join' ? 'patched' : 'unpatched';
}
const installState = detectVitePatchState();

// ---- 路径层证明：vite 8.3.4 toAbsoluteGlob 的相对 base 分支 ----
// dist/node/chunks/node.js:27965-27968：
//   if (base[0] === "/") dir = posix.join(root, base);
//   else dir = posix.resolve(importer ? globSafePath(dirname(importer)) : root, base);
// Windows 上 importer 经 slash 后是 "D:/..."；node:path 的 posix.isAbsolute("D:/...") 为
// false，posix.resolve 把它当相对路径处理，产出假绝对路径。
describe('路径层：toAbsoluteGlob 相对 base 分支在 Windows 的产出', () => {
  const root = path.join(probeRoot, 'cases', 'variant-a').replaceAll('\\', '/');
  const importerDir = `${root}/src`; // globSafePath(dirname(importer)) 的等价输入

  it('posix.resolve 产出不以盘符开头的假绝对路径，win32.resolve 正确', () => {
    expect(posix.isAbsolute(importerDir)).toBe(false);
    const posixDir = posix.resolve(importerDir, './../content');
    const win32Dir = win32.resolve(importerDir, './../content');
    expect(win32Dir.replaceAll('\\', '/')).toBe(`${root}/content`);
    expect(posixDir.startsWith('D:/')).toBe(false);
    expect(posixDir).not.toBe(`${root}/content`);
    expect(posixDir).toContain('D:/'); // cwd 前缀拼接后原路径以字面量形式嵌在中间
  });

  it('假 glob 匹配不了 watcher 事件文件路径（picomatch，vite 同款匹配器）', async () => {
    const require = createRequire(import.meta.url);
    const vitePkgDir = path.dirname(require.resolve('vite/package.json'));
    const pm = require(require.resolve('picomatch', { paths: [vitePkgDir] }));
    const eventFile = `${root}/content/initial-a.txt`; // watcher 事件里的文件（正斜杠、盘符开头）

    const badDir = posix.resolve(importerDir, './../content');
    const badGlob = posix.join(badDir, '**/*.txt');
    expect(pm(badGlob, { noextglob: true })(eventFile)).toBe(false); // A：匹配失败

    const globB = posix.join(root, '/content/**/*.txt'); // B 分支：posix.join(root, base)
    expect(globB.startsWith('D:/')).toBe(true);
    expect(pm(globB, { noextglob: true })(eventFile)).toBe(true);

    const globC = posix.join(importerDir, '../content/**/*.txt'); // C 分支
    expect(globC.startsWith('D:/')).toBe(true);
    expect(pm(globC, { noextglob: true })(eventFile)).toBe(true);
  });
});

const variants = [
  { id: 'variant-a', label: 'A 相对 base ./../content（fumadocs codegen 形态）', relativeBase: true },
  { id: 'variant-b', label: 'B 根相对 base /content' },
  { id: 'variant-c', label: 'C 无 base，直接 ../content/**/*.txt' },
  { id: 'variant-d', label: 'D 相对 base + 否定 glob !./skip-*.txt', relativeBase: true },
];

// eager glob 的 transform 替换产物形如
//   const files = /* #__PURE__ */ Object.assign({"./x.txt": __vite_glob_0_0});
// 提取其中的键，即页面 Object.keys(files) 渲染的内容。
function extractGlobKeys(code) {
  const m = code.match(/Object\.assign\(\{([\s\S]*?)\}\)/);
  if (!m) return null;
  return [...m[1].matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)].map((x) => JSON.parse(`"${x[1]}"`)).sort();
}

async function transformEntryModule(server) {
  const client = server.environments?.client;
  if (client && typeof client.transformRequest === 'function') {
    return client.transformRequest('/src/main.js', { kind: 'direct' });
  }
  return server.transformRequest('/src/main.js');
}

async function waitFor(predicate, { timeoutMs = 20000, stepMs = 250, label = 'condition' } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = predicate();
    if (last) return last;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`);
}

for (const v of variants) {
  describe(`变体 ${v.label}（安装状态：${installState === 'patched' ? '补丁版 vite（posix.join）' : '原版 vite 8.3.4（posix.resolve）'}）`, () => {
    const root = path.join(probeRoot, 'cases', v.id);
    const contentDir = path.join(root, 'content');
    const events = [];
    let server;
    let addedFile;

    beforeAll(async () => {
      // 清理上次运行残留的新增文件，保证初始状态确定
      for (const f of await fs.readdir(contentDir)) {
        if (f.startsWith('initial-') || f.startsWith('skip-initial-')) continue;
        await fs.rm(path.join(contentDir, f), { force: true });
      }
      server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        // middlewareMode：不经浏览器直接用 transformRequest 观察服务端行为。
        // HMR 保持开启（关掉会砍断被测的热更新链路）；ws 传输端口按变体错开，
        // 只影响传输，不影响 glob 匹配逻辑。
        server: { middlewareMode: true, hmr: { port: 5550 + variants.indexOf(v) } },
        plugins: [diagnosticsPlugin(events, { enforce: 'pre' }), diagnosticsPlugin(events, { enforce: 'post' })],
      });
    }, 60000);

    afterAll(async () => {
      await server?.close();
      await fs.writeFile(
        path.join(logsDir, `events-${v.id}.json`),
        JSON.stringify({ variant: v.id, addedFile, events }, null, 2),
      );
    });

    it('初始扫描：已有 txt 出现在 transform 产物键里', async () => {
      const result = await transformEntryModule(server);
      const keys = extractGlobKeys(result.code);
      expect(keys, `产物片段：${result.code.slice(0, 400)}`).not.toBeNull();
      // A/B（base 形态）键相对 base 目录；C（无 base）键相对 importer（src/），
      // 前缀是 '../content/'
      const initialKey = v.id === 'variant-c' ? '../content/initial-c.txt' : `./initial-${v.id.slice(-1)}.txt`;
      expect(keys).toContain(initialKey);
      // 变体 D：否定 glob 应把 skip-initial 排除在初始键之外
      if (v.id === 'variant-d') expect(keys).not.toContain('./skip-initial-d.txt');
    });

    it('运行中新增文件：watcher add、hotUpdate、产物键是否更新', async () => {
      const suffix = `${v.id}-${Date.now()}`;
      addedFile = path.join(contentDir, `added-${suffix}.txt`);
      await fs.writeFile(addedFile, `added-${suffix}\n`);
      // 变体 D 额外新增一个应被否定 glob 排除的文件
      let skippedFile;
      if (v.id === 'variant-d') {
        skippedFile = path.join(contentDir, `skip-added-${suffix}.txt`);
        await fs.writeFile(skippedFile, `skip-added-${suffix}\n`);
      }

      // 1) watcher 是否收到 add（真实磁盘写入触发 chokidar，非合成事件）
      const addEvent = await waitFor(
        () => events.find((e) => e.source === 'watcher' && e.type === 'add' && e.file.replaceAll('\\', '/') === addedFile.replaceAll('\\', '/')),
        { label: `watcher add ${addedFile}` },
      );
      expect(addEvent, 'watcher add 事件必须到达（否则失败在 watcher 层，与本实验假设无关）').toBeTruthy();

      // 2) hotUpdate 链路：vite 是否把 glob 使用模块（src/main.js）加入更新列表。
      //    给 3 秒窗口观察。watcher 的 add 在 vite 8 映射为 hotUpdate type 'create'；
      //    post 阶段（vite:import-glob 等核心插件之后）的 moduleIds 才是最终更新列表。
      await new Promise((r) => setTimeout(r, 3000));
      const postEvents = events.filter((e) => e.source === 'hotUpdate:post');
      const createEvents = postEvents.filter((e) => e.type === 'create' && e.file.replaceAll('\\', '/') === addedFile.replaceAll('\\', '/'));
      expect(createEvents.length, 'vite 必须对新增文件触发 hotUpdate（create）').toBeGreaterThan(0);
      const moduleUpdated = createEvents.some((e) =>
        (e.moduleIds ?? []).some((id) => id.replaceAll('\\', '/').endsWith('src/main.js')),
      );

      // 3) transform 产物是否失效更新：transformRequest 走 moduleGraph 缓存，
      //    模块被 invalidate 才会重新 transform 产出新键。
      const result = await transformEntryModule(server);
      const keys = extractGlobKeys(result.code);
      const addedKey = v.id === 'variant-c' ? `../content/added-${suffix}.txt` : `./added-${suffix}.txt`;
      const keyAppeared = (keys ?? []).includes(addedKey);

      // 断言组按探测到的安装状态自动选择，两组证据并存互不覆盖：
      //   unpatched 基线（vite 8.3.4 原版）：相对 base 类（A、D）失败——watcher add 到达但
      //     模块不进更新列表、产物键不更新；B/C 成功。2026-10-12 前三轮 + logs/vitest.log 即此组
      //   patched 对照（patches/vite@8.3.4.patch，posix.resolve→posix.join）：全部成功
      const relativeBaseVariant = v.relativeBase === true;
      if (installState === 'unpatched' && relativeBaseVariant) {
        expect(moduleUpdated, '原版相对 base：watcher add 已到，但 glob 使用模块未被加入 hotUpdate 更新列表').toBe(false);
        expect(keyAppeared, '原版相对 base：transform 产物键集合不包含新增文件').toBe(false);
      } else {
        expect(moduleUpdated, `${v.id}：glob 使用模块应被加入 hotUpdate 更新列表`).toBe(true);
        expect(keyAppeared, `${v.id}：transform 产物键集合应包含新增文件`).toBe(true);
      }
      // 变体 D：否定 glob 在两种状态下都不应放行 skip- 新增文件
      if (v.id === 'variant-d') {
        expect((keys ?? []).includes(`./skip-added-${suffix}.txt`), '否定 glob 应排除 skip- 新增文件').toBe(false);
      }
      console.log(`[${v.id}] 安装=${installState}，产物键=${JSON.stringify(keys)}，含新增=${keyAppeared}，模块被加入更新列表=${moduleUpdated}`);
      console.log(`[${v.id}] 产物键=${JSON.stringify(keys)}，含新增=${keyAppeared}，模块被加入更新列表=${moduleUpdated}`);
    }, 120000);
  });
}

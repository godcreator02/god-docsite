import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { demoCounterFile } from './lib.mjs';

const stepTimeoutMs = 20_000;

function watchPage(page, label, problems) {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`[${label} console.${message.type()}] ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[${label} pageerror] ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`[${label} http ${response.status()}] ${response.url()}`);
  });
}

async function waitForHydratedElement(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'));
    },
    selector,
    { timeout: stepTimeoutMs },
  );
}

async function textOf(page, selector) {
  return (await page.locator(selector).first().textContent({ timeout: stepTimeoutMs }))?.trim();
}

async function hasViteErrorOverlay(page) {
  return page.evaluate(() => document.querySelector('vite-error-overlay') !== null);
}

function readCounterFile() {
  return JSON.parse(readFileSync(demoCounterFile, 'utf8')).count;
}

// 每一项都记成 { name, pass, detail }，一项失败不中断后面的项
export async function runBrowserChecks(baseUrl) {
  const results = [];
  const problems = [];
  const record = (name, pass, detail) => results.push({ name, pass: Boolean(pass), detail });
  const attempt = async (name, body) => {
    try {
      await body();
    } catch (error) {
      record(name, false, `抛错：${error.message.split('\n')[0]}`);
    }
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const docsPage = await context.newPage();
    watchPage(docsPage, 'A', problems);

    await attempt('1-docs-ssr', async () => {
      const response = await docsPage.goto(`${baseUrl}/docs`, { waitUntil: 'load' });
      record('1-docs-ssr', response?.status() === 200, `GET /docs → ${response?.status()}`);
    });

    await attempt('1-remark-plugin', async () => {
      const count = await docsPage.locator('[data-demo-remark="applied"]').count();
      record('1-remark-plugin', count === 1, `[data-demo-remark] 个数 ${count}`);
    });

    await attempt('1-global-math', async () => {
      const count = await docsPage.locator('.katex').count();
      record('1-global-math', count >= 1, `.katex 个数 ${count}`);
    });

    await attempt('2-package-style', async () => {
      const color = await docsPage.locator('[data-demo-remark="applied"]').evaluate((element) => getComputedStyle(element).color);
      record('2-package-style', color === 'rgb(219, 39, 119)', `.demo-mark 颜色 ${color}`);
    });

    await attempt('2-mdx-component-hydrated', async () => {
      await waitForHydratedElement(docsPage, '[data-demo-counter-button]');
      await docsPage.click('[data-demo-counter-button]');
      await docsPage.click('[data-demo-counter-button]');
      await docsPage.waitForFunction(() => document.querySelector('[data-demo-counter-value]')?.textContent === '2', null, { timeout: stepTimeoutMs });
      const pathname = await textOf(docsPage, '[data-demo-counter-path]');
      const cjs = await textOf(docsPage, '[data-demo-counter-cjs]');
      record('2-mdx-component-hydrated', (pathname === '/docs' || pathname === '/docs/') && cjs === '2s', `点两下后为 2；usePathname=${pathname}；ms(1500)=${cjs}`);
    });

    await attempt('3-sidebar-entry', async () => {
      const sidebarLink = docsPage.locator('aside a[href="/demo"]', { hasText: '演示' });
      const count = await sidebarLink.count();
      record('3-sidebar-entry', count >= 1, `侧栏 a[href="/demo"]「演示」个数 ${count}`);
    });

    await attempt('4-client-nav-sidebar', async () => {
      await docsPage.evaluate(() => {
        window.__probeNoReloadMarker = 'kept';
      });
      await docsPage.locator('aside a[href="/demo"]', { hasText: '演示' }).first().click();
      await docsPage.waitForURL(`${baseUrl}/demo`, { timeout: stepTimeoutMs });
      await docsPage.waitForSelector('[data-demo-page][data-hydrated="yes"]', { timeout: stepTimeoutMs });
      const marker = await docsPage.evaluate(() => window.__probeNoReloadMarker);
      const overlay = await hasViteErrorOverlay(docsPage);
      const count = await textOf(docsPage, '[data-demo-count]');
      const pathname = await textOf(docsPage, '[data-demo-pathname]');
      record(
        '4-client-nav-sidebar',
        marker === 'kept' && !overlay && count === '0' && pathname === '/demo',
        `站内导航后 marker=${marker}（kept 说明没整页刷新）；报错层=${overlay}；计数=${count}；usePathname=${pathname}`,
      );
    });

    await attempt('6-sse-open', async () => {
      await docsPage.waitForFunction(() => document.querySelector('[data-demo-sse-state]')?.textContent === 'open', null, { timeout: stepTimeoutMs });
      record('6-sse-open', true, 'EventSource 已 open');
    });

    const directPage = await context.newPage();
    watchPage(directPage, 'B', problems);

    await attempt('4-direct-open', async () => {
      const response = await directPage.goto(`${baseUrl}/demo`, { waitUntil: 'load' });
      await directPage.waitForSelector('[data-demo-page][data-hydrated="yes"]', { timeout: stepTimeoutMs });
      const count = await textOf(directPage, '[data-demo-count]');
      record('4-direct-open', response?.status() === 200 && count === '0', `GET /demo → ${response?.status()}，计数=${count}`);
    });

    await attempt('4-fetcher-action', async () => {
      await waitForHydratedElement(directPage, '[data-demo-increment]');
      await directPage.click('[data-demo-increment]');
      await directPage.waitForFunction(() => document.querySelector('[data-demo-count]')?.textContent === '1', null, { timeout: stepTimeoutMs });
      const fileCount = readCounterFile();
      record('4-fetcher-action', fileCount === 1, `B 页 useFetcher 提交后页面计数 1，文件里 count=${fileCount}`);
    });

    await attempt('6-sse-push-from-other-page', async () => {
      await docsPage.waitForFunction(() => document.querySelector('[data-demo-pushed-count]')?.textContent === '1', null, { timeout: stepTimeoutMs });
      record('6-sse-push-from-other-page', true, 'A 页经 EventSource 收到 B 页 action 触发的推送 count=1');
    });

    await attempt('4-fetcher-action-again', async () => {
      await docsPage.click('[data-demo-increment]');
      await docsPage.waitForFunction(() => document.querySelector('[data-demo-count]')?.textContent === '2', null, { timeout: stepTimeoutMs });
      await docsPage.waitForFunction(() => document.querySelector('[data-demo-pushed-count]')?.textContent === '2', null, { timeout: stepTimeoutMs });
      record('4-fetcher-action-again', readCounterFile() === 2, `A 页再提交：页面计数 2、推送 2、文件 count=${readCounterFile()}`);
    });

    await attempt('4-client-nav-mdx-link', async () => {
      await docsPage.click('[data-demo-back]');
      await docsPage.waitForURL(`${baseUrl}/docs`, { timeout: stepTimeoutMs });
      await docsPage.waitForSelector('[data-demo-counter-button]', { timeout: stepTimeoutMs });
      await docsPage.locator('article a[href="/demo"]', { hasText: '去演示页' }).first().click();
      await docsPage.waitForURL(`${baseUrl}/demo`, { timeout: stepTimeoutMs });
      await docsPage.waitForSelector('[data-demo-page][data-hydrated="yes"]', { timeout: stepTimeoutMs });
      const marker = await docsPage.evaluate(() => window.__probeNoReloadMarker);
      const overlay = await hasViteErrorOverlay(docsPage);
      const count = await textOf(docsPage, '[data-demo-count]');
      record('4-client-nav-mdx-link', marker === 'kept' && !overlay && count === '2', `演示页→文档→正文链接→演示页：marker=${marker}；报错层=${overlay}；计数=${count}`);
    });
  } finally {
    await browser.close();
  }

  const frameworkProviderErrors = problems.filter((line) => line.includes('FrameworkProvider'));
  record('5-single-fumadocs-instance', frameworkProviderErrors.length === 0, `FrameworkProvider 报错 ${frameworkProviderErrors.length} 条`);
  // 浏览器关闭时 EventSource 断开不算问题；其余控制台报错、页面异常、4xx/5xx 都算
  const relevantProblems = problems.filter((line) => !line.includes('/demo/events') || !line.includes('ERR_'));
  record('console-clean', relevantProblems.length === 0, relevantProblems.length === 0 ? '无控制台报错、无页面异常、无 4xx/5xx' : relevantProblems.slice(0, 12).join('\n'));
  return { results, problems };
}

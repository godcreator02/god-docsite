import { createElement } from 'react';
import { jsxComponents, renderToMarkdown } from 'fumadocs-core/server';
import { getMDXComponents } from '@/components/mdx';
import { ComponentA } from '@/components/e8-a';
import { ComponentB } from '@/components/e8-b';
import { ComponentC } from '@/components/e8-c';
import { PinBlock, PinTreeBlock } from '@/components/e8-blocks';
import { docs } from './source';

/**
 * E-8：render-outputs.mjs 经 Vite ssrLoadModule 调它，取一页的 _markdown 组件渲染成 Markdown 文字。
 * 放在站点里、经 Vite 加载，react 与 fumadocs-core 都用站点那份实例。
 */
export async function renderPageMarkdown(path: string): Promise<string> {
  const page = docs.getPage(path);
  if (!page) throw new Error(`unknown page: ${path}`);
  const mod = await page.load();
  // async 集合的 body 模块把各导出包在 _exports 里（default、_markdown、toc…）
  const Markdown = (mod as { _exports?: Record<string, unknown> })._exports?._markdown;
  if (typeof Markdown !== 'function') {
    throw new Error(`${path} does not export _markdown as a component`);
  }
  const components = jsxComponents({
    ...getMDXComponents(),
    ComponentA,
    ComponentB,
    ComponentC,
    PinBlock,
    PinTreeBlock,
  });
  return renderToMarkdown(createElement(Markdown as never, { components }));
}

/** 生成正本时的组件清单：谁给了 Markdown 形式、谁没给，靠它点名 */
export function probeComponentNames(): string[] {
  return ['ComponentA', 'ComponentB', 'ComponentC', 'PinBlock', 'PinTreeBlock'];
}

/**
 * E-8：可靠找出没给 Markdown 形式的组件——输出里残留的大写 JSX 标签就是：
 * 组件给了 Markdown 形式（asMarkdown 返回文字）就不会以标签出现在输出里；
 * 没给（或给了仍返回 JSX）就原样保留 <Name>…</Name>。扫描输出点名即可
 */
export function findUnresolvedComponents(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(/^[\t ]*<\/?([A-Z][\w$]*)/gm)].map((m) => m[1]))];
}

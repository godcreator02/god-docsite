import { asMarkdown, jsxComponents, renderToMarkdown } from 'fumadocs-core/server';
import { getMDXComponents } from '@/components/mdx';
import { docs } from './source';
import { ComponentA } from '@/components/e8-a';
import { ComponentB } from '@/components/e8-b';
import { ComponentC } from '@/components/e8-c';
import { PinBlock, PinTreeBlock } from '@/components/e8-blocks';
export function Outer({ children }: any) { return <div>{children}</div>; }
export function Inner({ children }: any) { return <span>{children}</span>; }
export function RenamedImplementation() { return <div>ignored</div>; }
export function lowerImplementation() { return <div>ignored</div>; }
export function Good({ children }: any) { if (asMarkdown()) return children; return <div>{children}</div>; }
export function InlineProducer() { if (asMarkdown()) return <p>text <Inner /> tail</p>; return null; }
export function HiddenProducer() { if (asMarkdown()) return 'text <MissingInline /> tail'; return null; }
export function ThrowBefore() { throw new Error('before opt-in'); }
export function ThrowAfter() { asMarkdown(); throw new Error('after opt-in'); }
export async function renderAudit(path: string) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`missing ${path}`);
  const components = {
    ...getMDXComponents(), ComponentA, ComponentB, ComponentC, PinBlock, PinTreeBlock,
    Outer, Inner, Good, InlineProducer, HiddenProducer, ThrowBefore, ThrowAfter,
    Alias: RenamedImplementation, LowerAlias: lowerImplementation,
  };
  const text = await page.getText('processed', { components: jsxComponents(components) as never });
  const noWrapperText = await page.getText('processed', { components: components as never });
  const mod = await page.load();
  return { text, noWrapperIdentical: text === noWrapperText, structuredData: mod.structuredData, toc: mod.toc };
}

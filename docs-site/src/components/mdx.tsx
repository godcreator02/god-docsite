/**
 * 名册里给人看的那一半：docfirst.config.mjs 里声明压平表，这里给 React 表。
 * 表的类型由 registry.ts 的名单限定：少一个编译不过，多一个也编译不过。
 * 跟压平表是否一致，由 scripts/verify-roster.mjs 两边核对。
 * 先放 fumadocs 的默认表（标题栏、复制按钮都来自它），再把 pre 换成 @godcreator/docfirst-fumadocs 里会画状态点的 DocfirstPre；
 * Files / Folder / File 是 fumadocs 自己的文件树组件，目录树引用注入的就是它们。
 * 星轨盘不在这张表里：它是一条独立的整页路由 /trajectory，不是嵌在 mdx 里的组件。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { DocfirstPre } from '@godcreator/docfirst-fumadocs/pre';
import { Term } from '@godcreator/docfirst-fumadocs/term';
import type { ComponentName } from './registry';
import { Tabs, Tab } from './tabs/tabs';
import { PinJudge } from './pin/judge';
import { PinStory } from './pin/story';
import { RenderFlow } from './render-flow/render-flow';
import { SeamMap } from './seam-map/seam-map';

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>;
}

const table: Record<ComponentName, MDXComponents[string]> = {
  Note,
  Tabs,
  Tab,
  Files,
  Folder,
  File,
  Term,
  PinStory,
  PinJudge,
  SeamMap,
  RenderFlow,
};

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
    pre: DocfirstPre,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

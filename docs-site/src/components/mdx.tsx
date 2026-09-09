/**
 * 名册的人看那一半：格式包给机制，项目在 livedoc.config.mjs 里声明压平表，这里给 React 表。
 * 表的类型由 registry.ts 的名单钉死：少一个编译不过，多一个也编译不过。
 * 跟压平表齐不齐，由 scripts/verify-roster.mjs 两头对。
 * 底下铺 fumadocs 的默认表（标题栏、复制按钮都是它的），再把 pre 换成格式包那个会画状态点的；
 * Files / Folder / File 是 fumadocs 自己的文件树组件，目录树引用注入的就是它们。
 * 星轨盘不在这张表里：盘是一条独立的整页路由 /trajectory，不是塞进 mdx 的组件。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { LivedocPre } from '@godcreator02/livedoc/fumadocs/pre';
import { Term } from '@godcreator02/livedoc/fumadocs/term';
import type { ComponentName } from './registry';
import { Tabs, Tab } from './tabs/tabs';

type Loose = MDXComponents[string];

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>;
}

const table: Record<ComponentName, Loose> = {
  Note: Note as Loose,
  Tabs: Tabs as Loose,
  Tab: Tab as Loose,
  Files: Files as Loose,
  Folder: Folder as Loose,
  File: File as Loose,
  Term: Term as Loose,
};

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
    pre: LivedocPre as unknown as NonNullable<MDXComponents['pre']>,
  };
}

/**
 * 名册的人看那一半：机制在格式包，压平表在 livedoc.config.mjs，这里给 React 表。
 * Files / Folder / File 是 fumadocs 自己的文件树组件。
 * 星轨盘不在这张表里：盘是一条独立的整页路由 /trajectory，不是塞进 mdx 的组件。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import type { ComponentName } from './registry';

type Loose = MDXComponents[string];

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>;
}

const table: Record<ComponentName, Loose> = {
  Note: Note as Loose,
  Files: Files as Loose,
  Folder: Folder as Loose,
  File: File as Loose,
};

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
  };
}

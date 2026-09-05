/**
 * 名册的人看那一半：机制在格式包，压平表在 livedoc.config.mjs，这里给 React 表。
 * Files / Folder / File 是 fumadocs 自己的文件树组件；Trajectory 从 trajectory 包的
 * ./server 入口接（服务端组件：建模 + 渲 StarDisk + 报病列表）。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { Trajectory } from '@godcreator02/live-doc-trajectory/server';
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
  Trajectory: Trajectory as Loose,
};

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
  };
}

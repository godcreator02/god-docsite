'use client';
import type { ReactNode } from 'react';
import { asMarkdown } from 'fumadocs-core/server';

/** E-8 组件 B：与 A 写法相同，但文件第一行是 'use client'——React Router 非 RSC 模式下照常执行 */
export function ComponentB({ children }: { children?: ReactNode }) {
  if (asMarkdown()) {
    return '组件B的机读文字：client 组件也能给 Markdown 形式。';
  }
  return <div data-probe="component-b">{children}</div>;
}

/**
 * 正文里的两个小组件：提示框 Note，只有装饰作用的分隔线 Divider（名册里是 drop，机读文字里整个去掉）
 */
import type { ReactNode } from 'react';
import './prose.css';

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>;
}

export function Divider() {
  return <hr className="my-6 border-fd-border" />;
}

/**
 * 站里自定义的组件 Tabs / Tab 在站上的画面：不做交互，标签页渲成并排的小节。
 * 旁边的 tabs.ai.mjs 是它在生成物里转成什么文字的机读规则，两份放一起。
 */
import type { ReactNode } from 'react';
import './tabs.css';

export function Tabs({ children }: { children?: ReactNode }) {
  return <div className="tabs">{children}</div>;
}

export function Tab({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <section className="tab">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

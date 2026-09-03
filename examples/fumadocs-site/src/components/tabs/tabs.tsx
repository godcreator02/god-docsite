/**
 * 站里自定义的组件：人看那一半。旁边的 tabs.ai.mjs 是 AI 那一半，两份放一起。
 * 不做交互，标签页渲成并排的小节。
 */
import type { ReactNode } from 'react';

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

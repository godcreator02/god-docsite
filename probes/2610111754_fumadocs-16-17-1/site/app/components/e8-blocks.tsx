import type { ReactNode } from 'react';

/** probePin 生成的外层组件：网页显示时包住普通 code 节点 */
export function PinBlock({ children, title }: { children?: ReactNode; title?: string }) {
  return (
    <figure data-probe="pin-block" data-pin-title={title} className="rounded-lg border p-2">
      {children}
    </figure>
  );
}

/** probePin 处理 <PinTree> 时的外层组件 */
export function PinTreeBlock({ children, title }: { children?: ReactNode; title?: string }) {
  return (
    <figure data-probe="pin-tree-block" data-pin-title={title} className="rounded-lg border p-2">
      {children}
    </figure>
  );
}

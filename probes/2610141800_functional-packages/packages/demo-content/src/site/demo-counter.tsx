import { useState } from 'react';
import { usePathname } from 'fumadocs-core/framework';
import ms from 'ms';

// usePathname 要求外层有 fumadocs 的 FrameworkProvider：站点和功能包各拿到一份 fumadocs-core 时这里会抛错
// ms 是 CommonJS 包：功能包不经 Vite 预构建时，它必须以「demo-content > ms」进 optimizeDeps.include
export function DemoCounter({ label = '计数' }: { label?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  return (
    <div className="demo-counter" data-demo-counter="">
      <button type="button" data-demo-counter-button="" onClick={() => setCount((value) => value + 1)}>
        {label}：<span data-demo-counter-value="">{count}</span>
      </button>
      <span className="demo-counter-meta" data-demo-counter-path="">{pathname}</span>
      <span className="demo-counter-meta" data-demo-counter-cjs="">{ms(1500)}</span>
    </div>
  );
}

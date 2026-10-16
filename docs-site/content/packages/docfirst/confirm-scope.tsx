'use client';
/**
 * ConfirmScope：confirm 的五种写法各自的后果。上面终端摆命令与输出；下面三张小卡片是仓里的三篇页，
 * 状态点标这一篇这次被改写（写回）还是没动（不动）。数据都在 confirm-scope.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Dot, Pane, Terminal } from '@godcreator/explainer/site';
import { cases, pages } from './confirm-scope.data.mjs';
import './confirm-scope.css';

export function ConfirmScope(): JSX.Element {
  return (
    <CasePicker cases={cases} label="confirm 的五种写法">
      {(item) => (
        <div key={item.id} className="cs-case">
          <Terminal title="站目录" lines={[{ text: item.command, kind: 'cmd' }, ...item.lines]} />
          <div className="cs-cards">
            {pages.map((page, index) => {
              const written = item.written[index] ?? false;
              return (
                <Pane
                  key={page.doc}
                  title={page.doc}
                  icon="file"
                  role={written ? 'emerald' : 'slate'}
                  extra={
                    <span className="cs-verdict">
                      <Dot tone={written ? 'good' : 'pending'} />
                      {written ? '写回' : '不动'}
                    </span>
                  }
                >
                  <span className="cs-note">{page.note}（钉 {page.pin}）</span>
                </Pane>
              );
            })}
          </div>
        </div>
      )}
    </CasePicker>
  );
}

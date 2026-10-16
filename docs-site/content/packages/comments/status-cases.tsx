'use client';
/**
 * StatusCases：标为已解决、重新打开只改串头三项，别的原样写回；重复标拒绝。
 * 一张卡：标题是串头文件路径，里面 Diff 只摆 frontmatter 的状态行；
 * 正文那句「这一句要不要举个例子？」在 Diff 下面灰字原样摆着，表示没动；
 * 重复标的情况不摆 Diff，摆 bad 胶囊「409」与 action 回的那句原话。数据都在 status-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Diff, Pane, Pill } from '@godcreator/explainer/site';
import { cases, headPath, rejectedMessage } from './status-cases.data.mjs';
import { commentBody } from './example.data.mjs';
import './status-cases.css';

export function StatusCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="串头的状态：只改三项，重复标拒绝">
      {(item) => (
        <Pane key={item.id} title={headPath} icon="file" role="slate">
          {item.rejected ? (
            <div className="sc-reject">
              <Pill tone="bad" dot>
                409
              </Pill>
              <code className="sc-reject-message">{rejectedMessage}</code>
            </div>
          ) : (
            <Diff old={item.old ?? []} now={item.now ?? []} />
          )}
          <p className="sc-body">{commentBody}</p>
        </Pane>
      )}
    </CasePicker>
  );
}

'use client';
/**
 * ConfirmCases：核对的一种结论配确认的一个动作。左边一个状态点加结论与动作，右边摆标记那一行——
 * 写回的用 Diff 摆确认前后，不写的摆原行并标「不动」。数据都在 confirm-cases.data.mjs，动作名照 pinner.ts。
 */
import type { JSX } from 'react';
import { CasePicker, Diff, Dot, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './confirm-cases.data.mjs';
import type { ConfirmCase } from './confirm-cases.data.mjs';
import './confirm-cases.css';

function CaseView({ item }: { item: ConfirmCase }): JSX.Element {
  return (
    <div className="cf-case">
      <div className="cf-verdict">
        <Dot tone={item.tone} />
        <span className="cf-status">{item.statusWord}</span>
        <span className="cf-status-note">{item.statusNote}</span>
        <Pill role="amber">
          {item.action}：{item.actionWord}
        </Pill>
      </div>
      <Pane
        title="标记那一行"
        icon="terminal"
        role="violet"
        extra={item.writes ? <span className="cf-flow">确认前 → 确认后</span> : <Pill tone="pending">不动</Pill>}
      >
        {item.writes ? (
          <Diff old={[item.before!]} now={[item.after!]} />
        ) : (
          <div className="cf-kept">{item.line}</div>
        )}
      </Pane>
      <p className="cf-note">每处各自独立：一处钉不住只是那一处不动，同一篇里别的照常写回。</p>
    </div>
  );
}

export function ConfirmCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="核对的一种结论，配确认的一个动作">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

'use client';
/**
 * VerifyCases：只读的核对怎么判一份生成物。左右两块「正本会写出」与「磁盘上现在」，下面一个胶囊是核对交回的状态名。
 * 磁盘上那份只标与正本会写出的不同的地方：stale 时多出来的那一行带加入记号；CRLF 时行尾的 \r 写在行内容里。
 * 数据都在 verify-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './verify-cases.data.mjs';
import type { VerifyCase } from './verify-cases.data.mjs';
import './verify-cases.css';

function DiskPane({ item }: { item: VerifyCase }): JSX.Element {
  const { right } = item;
  return (
    <Pane
      title="磁盘上现在"
      icon="file"
      role="slate"
      extra={right.kind === 'lines' ? <Pill tone="pending">{right.crlf ? 'CRLF' : 'LF'}</Pill> : null}
    >
      {right.kind === 'lines' && <CodeLines lines={right.lines} added={right.added ?? []} />}
      {right.kind === 'missing' && <p className="vc-missing">（落点还没有文件）</p>}
    </Pane>
  );
}

function VerifyPanes({ item }: { item: VerifyCase }): JSX.Element {
  return (
    <div className="vc-case">
      <div className="vc-panes">
        <Pane title="正本会写出" icon="file" role="blue">
          <CodeLines lines={item.left.lines} />
        </Pane>
        <DiskPane item={item} />
      </div>
      <div className="vc-verdict">
        核对交回：<Pill tone={item.tone} dot>{item.status}</Pill>
      </div>
    </div>
  );
}

export function VerifyCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="核对怎么判一份生成物">
      {(item) => (
        <VerifyPanes key={item.id} item={item} />
      )}
    </CasePicker>
  );
}

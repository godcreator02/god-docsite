'use client';
/**
 * 「写入规则判一次写入」：选一种写入请求，左边是页面交来的内容和本机身份，右边是写入规则按代码里的先后逐道检查，
 * 下面是结果：写成的文件（新加的行、改了的行标出来）、删掉的文件，或者拒绝的原话。
 * 讲解文字与每种情况的数据都在 write-rule.data.mjs；机读版由 write-rule.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './write-rule.data.mjs';

type WriteCase = (typeof cases)[number];
type Check = WriteCase['checks'][number];

function checkState(check: Check): 'pass' | 'fail' | 'skip' {
  if (check.ok === null) return 'skip';
  return check.ok ? 'pass' : 'fail';
}

function Request({ item }: { item: WriteCase }): JSX.Element {
  const identity = (
    <Pill role="blue" dot>
      本机身份 {item.person}
    </Pill>
  );
  return (
    <Pane title={item.endpoint} icon="user" role="blue" extra={identity}>
      <CodeLines lines={item.body} />
    </Pane>
  );
}

function Checks({ item }: { item: WriteCase }): JSX.Element {
  return (
    <Pane title="写入规则" icon="server" role="emerald" extra={<code className="wr-src">collab-model/src/task-model/write.ts</code>}>
      <ol className="wr-checks">
        {item.checks.map((check) => {
          const state = checkState(check);
          return (
            <li key={check.name} className="wr-check" data-state={state}>
              {state === 'skip' ? <span className="wr-skip" aria-hidden="true" /> : <Dot tone={state === 'pass' ? 'good' : 'bad'} />}
              <span className="wr-check-name">{check.name}</span>
              <span className="wr-check-note">{check.note}</span>
            </li>
          );
        })}
      </ol>
    </Pane>
  );
}

function Outcome({ item }: { item: WriteCase }): JSX.Element {
  const outcome = item.outcome;
  if (outcome.kind === 'rejected') {
    return (
      <Pane title="WriteRejected" role="rose" extra={<Pill tone="bad">拒绝</Pill>}>
        <p className="wr-message">{outcome.message}</p>
        <p className="wr-after">{outcome.after}</p>
      </Pane>
    );
  }
  if (outcome.kind === 'deleted') {
    return (
      <Pane title={outcome.file} icon="file" role="rose" extra={<Pill tone="bad" dot>删掉</Pill>}>
        <div className="wr-deleted">
          <CodeLines lines={outcome.lines} />
        </div>
      </Pane>
    );
  }
  return (
    <Pane
      title={outcome.file}
      icon="file"
      role="emerald"
      extra={<Pill tone="good" dot>{outcome.kind === 'created' ? '新文件' : '改写'}</Pill>}
    >
      <CodeLines lines={outcome.lines} added={outcome.added} changed={outcome.changed} />
    </Pane>
  );
}

export function WriteRule(): JSX.Element {
  return (
    <CasePicker cases={cases} label="写入规则判一次写入">
      {(item) => (
        // 换情况时换 key，结果卡片重新挂载，新加行的闪动重放一次
        <div key={item.id} className="wr-stage @container">
          <div className="wr-top">
            <Request item={item} />
            <Checks item={item} />
          </div>
          <Outcome item={item} />
        </div>
      )}
    </CasePicker>
  );
}

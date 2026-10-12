'use client';
/**
 * 「两个人的改动在 git 里怎么合」：选一种情况，上面左右是 bob（已进 main）与 carol（本地 main 上）各改了什么，
 * 中间是 carol 提交审核时把 main 合进来的终端，下面是合并后 carol 工作区里的文件和数据模型包从中读出的东西。
 * 讲解文字与每种情况的数据都在 record-merge.data.mjs；机读版由 record-merge.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Diff, Dot, Pane, Pill, Terminal } from '@godcreator/docsite-explainer';
import type { Role, TerminalLine } from '@godcreator/docsite-explainer';
import { cases } from './record-merge.data.mjs';

type MergeCase = (typeof cases)[number];
type Change = MergeCase['mine'];

function ChangeView({ who, where, role, change }: { who: string; where: string; role: Role; change: Change }): JSX.Element {
  return (
    <Pane title={who} icon="user" role={role} extra={where}>
      {change.kind === 'new' ? (
        <div className="rm-new">
          <Pill tone="good">新文件</Pill>
          <code>{change.file}</code>
        </div>
      ) : (
        <div className="rm-edit">
          <div className="rm-edit-where">
            <code>{change.file}</code> 第 {change.line} 行
          </div>
          <Diff old={[change.old]} now={[change.now]} />
        </div>
      )}
    </Pane>
  );
}

function Workspace({ item }: { item: MergeCase }): JSX.Element {
  const file = item.file;
  if ('list' in file) {
    return (
      <Pane title={file.path} icon="folder" role="emerald" extra="carol 的工作区">
        <ul className="rm-list">
          {file.list.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </Pane>
    );
  }
  const conflicted = file.highlight !== null;
  return (
    <Pane
      title={file.path}
      icon="file"
      role="emerald"
      extra={conflicted ? <Pill tone="bad">留着冲突标记</Pill> : <Pill tone="good">自动合并</Pill>}
    >
      <CodeLines lines={file.lines} highlight={file.highlight} tone="bad" changed={file.changed} />
    </Pane>
  );
}

function ReadOutView({ item }: { item: MergeCase }): JSX.Element {
  return (
    <Pane title="数据模型包读出来" icon="server" role="slate" extra={<code className="rm-src">collabState</code>}>
      <ul className="rm-read">
        {item.readOut.map((entry) => (
          <li key={entry.text}>
            <Dot tone={entry.tone} />
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>
    </Pane>
  );
}

export function RecordMerge(): JSX.Element {
  return (
    <CasePicker cases={cases} label="两个人的改动在 git 里怎么合">
      {(item) => (
        <div key={item.id} className="rm-stage @container">
          <div className="rm-sides">
            <ChangeView who="bob" where="已经合进 main" role="blue" change={item.mine} />
            <ChangeView who="carol" where="本地 main 上刚提交，还没推送" role="emerald" change={item.theirs} />
          </div>
          <Terminal title="carol 提交审核（collab.submit）" lines={item.terminal as TerminalLine[]} />
          <div className="rm-after">
            <Workspace item={item} />
            <ReadOutView item={item} />
          </div>
        </div>
      )}
    </CasePicker>
  );
}

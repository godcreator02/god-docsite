'use client';
/**
 * ConflictCases：规范写法下两人同时改，git 实跑什么时候自动合上、什么时候报冲突。
 * 上面两张卡摆 bob 与 carol 各自改到的行（Diff）；下面一行结论胶囊加 git 实跑输出（Terminal）；
 * 冲突的情况再摆一行网站解码时报的那句。数据都在 conflict-cases.data.mjs（实跑结果，见那份文件头的说明）。
 */
import type { JSX } from 'react';
import { CasePicker, Diff, Dot, Pane, Pill, Terminal } from '@godcreator/explainer/site';
import { cases } from './conflict-cases.data.mjs';
import type { ConflictCase, SideChange } from './conflict-cases.data.mjs';
import './conflict-cases.css';

function SidePane({ title, note, role, change }: { title: string; note: string; role: 'blue' | 'violet'; change: SideChange }): JSX.Element {
  return (
    <Pane title={title} icon="file" role={role} extra={<span className="cc-note">{note}</span>}>
      {change.files.map((file) => (
        <div key={file.path} className="cc-file">
          <div className="cc-path">
            {file.path}
            {file.created ? '（新文件）' : ''}
          </div>
          <Diff old={file.old ?? []} now={file.now ?? []} />
        </div>
      ))}
    </Pane>
  );
}

function Verdict({ item }: { item: ConflictCase }): JSX.Element {
  return (
    <div className="cc-verdict" data-merged={item.merged}>
      {item.merged ? <Pill tone="good" dot>git 自动合上</Pill> : <Pill tone="bad" dot>git 报冲突</Pill>}
      <Terminal title="git merge carol" lines={item.gitLines} />
      {item.decodeLine === undefined ? null : (
        <div className="cc-decode">
          <Dot tone="bad" />
          <span>网站解码这条记录时报：{item.decodeLine}</span>
        </div>
      )}
    </div>
  );
}

export function ConflictCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="两人同时改，git 实跑的结果">
      {(item) => (
        <div key={item.id} className="cc-case">
          <div className="cc-sides">
            <SidePane title="bob-test 改的" note={item.bob.note} role="blue" change={item.bob} />
            <SidePane title="carol-test 改的" note={item.carol.note} role="violet" change={item.carol} />
          </div>
          <Verdict item={item} />
        </div>
      )}
    </CasePicker>
  );
}

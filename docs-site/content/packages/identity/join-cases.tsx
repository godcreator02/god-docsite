'use client';
/**
 * JoinCases：把自己加进名单（docsite.people.join）时 people.json 怎么变、什么时候拒绝。
 * 上面一张卡列这次带来的 id、名字与码；下面一张卡是 people.json：成功的情况用新旧行对照只摆变的那一行
 * （一项一行，git 里的改动只有那一行），不动文件与被拒的情况摆胶囊加原话。数据都在 join-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Diff, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './join-cases.data.mjs';
import type { JoinCase, JoinOutcome } from './join-cases.data.d.mts';
import './join-cases.css';

function JoinPane({ item }: { item: JoinCase }): JSX.Element {
  return (
    <Pane title="docsite.people.join" icon="terminal" role="cyan">
      <div className="jc-joining">
        <div>id: {item.joining.id}</div>
        <div>name: {item.joining.name}</div>
        <div>
          本机的码<span className="jc-dim">（设置 identity-code）</span>: {item.joining.code}
        </div>
        {item.joining.gitea === undefined ? null : <div>gitea: {item.joining.gitea}</div>}
      </div>
    </Pane>
  );
}

function OutcomePane({ outcome }: { outcome: JoinOutcome }): JSX.Element {
  return (
    <Pane title="people.json" icon="file" role="emerald">
      {outcome.kind === 'joined' ? (
        <>
          <Diff old={outcome.old} now={outcome.now} />
          <div className="jc-note">
            {outcome.old.length === 0 ? '新加的一项：名单多一行' : '那一行变，别的行不动'}
            <span className="jc-dim"> —— 一项一行，git 里的改动只有这一行</span>
          </div>
        </>
      ) : outcome.kind === 'unchanged' ? (
        <>
          <Pill tone="good" dot>
            不动文件
          </Pill>
          <div className="jc-note">名单没变，joinSitePeople 不写 people.json</div>
        </>
      ) : (
        <>
          <Pill tone="bad" dot>
            拒绝
          </Pill>
          <div className="jc-reason">{outcome.reason}</div>
        </>
      )}
    </Pane>
  );
}

export function JoinCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="把自己加进名单，六种情况各改了什么">
      {(item) => (
        <div key={item.id} className="jc-case">
          <div className="jc-panes">
            <JoinPane item={item} />
            <OutcomePane outcome={item.outcome} />
          </div>
        </div>
      )}
    </CasePicker>
  );
}

'use client';
/**
 * RecognizeCases：同一份名单，站点怎么跑、环境变量里有没有码、码在不在名单里，认出来的结果不同。
 * 从左到右三格：运行方式与环境变量 → 名单里找（命中的行高亮；发布版整格灰掉）→ 侧栏底部显示
 * （仿 IdentityBadge：认出人时头像加名字，只读时「只读」加原因原文）。数据都在 recognize-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { cases, envName, peopleLines } from './recognize-cases.data.mjs';
import type { RecognizeCase } from './recognize-cases.data.d.mts';
import './recognize-cases.css';

function MachinePane({ item }: { item: RecognizeCase }): JSX.Element {
  return (
    <Pane title="运行方式与环境变量" icon="terminal" role="slate">
      <div className="rc-machine">
        <div>运行方式: {item.machine.runMode}</div>
        <div>
          {item.machine.code === null ? `${envName} 没有设` : `${envName}=${item.machine.code}`}
          {item.machine.ignored ? <span className="rc-dim"> 不看</span> : null}
        </div>
      </div>
    </Pane>
  );
}

function ListPane({ item }: { item: RecognizeCase }): JSX.Element {
  return (
    <Pane
      title="名单里找"
      icon="file"
      role="emerald"
      extra={item.machine.ignored ? <Pill role="slate">发布版不看码</Pill> : undefined}
    >
      <div className="rc-list" data-dim={item.machine.ignored ? true : undefined}>
        <CodeLines
          lines={peopleLines}
          highlight={item.hitLine === null ? null : ([item.hitLine, item.hitLine] as const)}
          tone="info"
        />
      </div>
    </Pane>
  );
}

function BadgePane({ item }: { item: RecognizeCase }): JSX.Element {
  return (
    <Pane title="侧栏底部显示" icon="user" role="amber">
      {item.person === null ? (
        <div className="rc-readonly">
          <span className="rc-readonly-mark">只读</span>
          <span className="rc-reason">{item.reason}</span>
        </div>
      ) : (
        <div className="rc-badge">
          {/* 头像仿 Avatar：名字第一个字加由 id 算出的底色，这里写死按 hueOfId('zhou') 算出的颜色 */}
          <span className="rc-avatar" data-person={item.person.id}>
            {item.person.initial}
          </span>
          <span className="rc-badge-name">{item.person.name}</span>
        </div>
      )}
    </Pane>
  );
}

export function RecognizeCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="同一份名单，四种情况各认出谁">
      {(item) => (
        <div key={item.id} className="rc-case">
          <MachinePane item={item} />
          <ListPane item={item} />
          <BadgePane item={item} />
        </div>
      )}
    </CasePicker>
  );
}

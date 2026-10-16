'use client';
/**
 * PlacementCases：同一篇正本按三种落点写法写出的结果。左块是配置里那一项（outputs 数组的一项），
 * 右块是落点文件的标题与开头几行；点名了正本里没有的字段时，右块摆拒绝状态与原话。
 * 数据都在 placement-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { badRefusal, cases } from './placement-cases.data.mjs';
import type { PlacementCase } from './placement-cases.data.mjs';
import './placement-cases.css';

function PlacementPanes({ item }: { item: PlacementCase }): JSX.Element {
  return (
    <div className="pc-case">
      <Pane title="落点写法（outputs 里那一项）" icon="terminal" role="slate">
        <CodeLines lines={item.config} />
      </Pane>
      {item.artifact === null ? (
        <Pane title="BAD.md" icon="file" role="rose">
          <div className="pc-refusal">
            <Pill tone="bad" dot>{badRefusal.pill}</Pill>
            <span className="pc-why">不写——{badRefusal.why}</span>
          </div>
        </Pane>
      ) : (
        <Pane
          title={item.artifact.title}
          icon="file"
          role="emerald"
          extra={item.status === null ? null : <Pill tone={item.tone} dot>{item.status}</Pill>}
        >
          <CodeLines lines={item.artifact.lines} highlight={item.artifact.highlight} tone="pending" />
        </Pane>
      )}
    </div>
  );
}

export function PlacementCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="同一篇正本，三种落点写法">
      {(item) => (
        <PlacementPanes key={item.id} item={item} />
      )}
    </CasePicker>
  );
}

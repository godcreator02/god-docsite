'use client';
/**
 * RosterRules：三种名册规则把同一个组件写成什么，名册外的组件是什么下场。
 * 左块「正本里」摆 mdx，右块「生成物里」摆写出的 Markdown；unknown 的右块摆整篇拒绝的原话。
 * 数据都在 roster-rules.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { cases, unknownRefusal } from './roster-rules.data.mjs';
import type { RuleCase, RuleSegment } from './roster-rules.data.mjs';
import './roster-rules.css';

function SegmentPane({ title, role, segments }: { title: string; role: 'blue' | 'emerald' | 'rose'; segments: RuleSegment[] }): JSX.Element {
  return (
    <Pane title={title} icon="file" role={role}>
      {segments.map((segment, index) =>
        segment.note === undefined ? (
          <CodeLines key={index} lines={segment.lines ?? []} start={segment.start} />
        ) : (
          <p key={index} className="rr-note">{segment.note}</p>
        ),
      )}
    </Pane>
  );
}

function RulePanes({ item }: { item: RuleCase }): JSX.Element {
  return (
    <div className="rr-case">
      <SegmentPane title="正本里" role="blue" segments={item.left} />
      {item.right === null ? (
        <Pane title="生成物里" icon="file" role="rose">
          <div className="rr-refusal">
            <Pill tone="bad" dot>{unknownRefusal.pill}</Pill>
            <span className="rr-quote">{unknownRefusal.quote}</span>
          </div>
        </Pane>
      ) : (
        <SegmentPane title="生成物里" role="emerald" segments={item.right} />
      )}
    </div>
  );
}

export function RosterRules(): JSX.Element {
  return (
    <CasePicker cases={cases} label="名册规则把组件写成什么">
      {(item) => (
        <RulePanes key={item.id} item={item} />
      )}
    </CasePicker>
  );
}

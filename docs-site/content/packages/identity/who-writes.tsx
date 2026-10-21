'use client';
/**
 * WhoWrites：一次写入请求最后以谁的身份写、或者在哪一步被拒。上面三张卡片是这台机器、people.json 与写入请求，
 * 中间是判定的五步，下面是结论一行。数据都在 who-writes.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, codeField, peopleLines, stepNames } from './who-writes.data.mjs';
import type { StepState, WhoWritesCase } from './who-writes.data.mjs';
import './who-writes.css';

const stepTone: Record<StepState, Tone> = { pass: 'good', readonly: 'pending', reject: 'bad', skip: 'pending' };

function CaseView({ item }: { item: WhoWritesCase }): JSX.Element {
  return (
    <div className="ww-case">
      <div className="ww-cards">
        <Pane title="这台机器" icon="terminal" role="slate">
          <div className="ww-lines">
            <div>运行方式：{item.machine.runMode}</div>
            <div className="ww-env">
              {item.machine.code === null ? '没有托管方上下文' : `${codeField}: ${item.machine.code}`}
              {item.machine.ignored ? <span className="ww-dim"> 不看</span> : null}
            </div>
          </div>
        </Pane>
        <Pane
          title="people.json"
          icon="file"
          role="emerald"
          extra={item.asPointsAt === null ? undefined : <Pill role="amber">as 指向 {item.asPointsAt}</Pill>}
        >
          <CodeLines lines={peopleLines} highlight={item.hitLine === null ? null : ([item.hitLine, item.hitLine] as const)} tone="info" />
        </Pane>
        <Pane title="写入请求" icon="file" role="blue">
          <div className="ww-lines">
            <div>Origin: {item.request.origin}</div>
            <div>as: {item.request.as ?? '不写'}</div>
          </div>
        </Pane>
      </div>
      <Pane title="判定的五步" icon="terminal" role="violet">
        <ol className="ww-steps">
          {stepNames.map((name, index) => {
            const step = item.steps[index]!;
            return (
              <li key={name} data-state={step.state}>
                <Dot tone={stepTone[step.state]} />
                <span className="ww-step-name">
                  {index + 1}. {name}
                </span>
                <span className="ww-step-note">{step.note}</span>
              </li>
            );
          })}
        </ol>
      </Pane>
      <div className="ww-verdict">
        <Pill tone={item.outcome.http === 200 ? 'good' : 'bad'}>HTTP {item.outcome.http}</Pill>
        <Pill role="amber">{item.outcome.writes}</Pill>
        <span className="ww-detail">{item.outcome.detail}</span>
        <Pill role="slate">侧栏显示：{item.outcome.sidebar}</Pill>
      </div>
    </div>
  );
}

export function WhoWrites(): JSX.Element {
  return (
    <CasePicker cases={cases} label="一次写入以谁的身份，七种情况各在哪一步定论">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

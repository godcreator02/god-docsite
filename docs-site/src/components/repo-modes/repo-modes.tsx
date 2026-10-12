'use client';
/**
 * 「同一周在两个仓里干活」：同一周里 bob 的两个仓并排往前走。左边协作仓、右边别的仓 fpga-hil，各列出这一刻的分支、本地 main、
 * origin/main、合并请求、工作区与网页上看到的；比上一步变了的那一格标出来，这一步运行的命令放在终端里。
 * 讲解文字与每一步的数据都在 repo-modes.data.mjs，机读版由 repo-modes.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { Pane, Pill, Stepper, Terminal } from '@godcreator/docsite-explainer';
import type { Role } from '@godcreator/docsite-explainer';
import { fields, lanes, steps } from './repo-modes.data.mjs';

type Step = (typeof steps)[number];
type LaneId = 'collab' | 'plain';
type FieldKey = (typeof fields)[number]['key'];

function LaneView({ id, step, previous }: { id: LaneId; step: Step; previous: Step | undefined }): JSX.Element {
  const lane = lanes.find((each) => each.id === id)!;
  const now = step[id];
  const before = previous?.[id];
  return (
    <Pane title={lane.title} icon="git" role={lane.role as Role}>
      <div className="rm-lane">
        <div className="rm-note">{lane.note}</div>
        <dl className="rm-kv">
          {fields.map((field) => {
            const key = field.key as FieldKey;
            const changed = before !== undefined && before[key] !== now[key];
            return (
              <div key={field.key} className="rm-row" data-changed={changed ? true : undefined}>
                <dt>{field.label}</dt>
                <dd>{now[key]}</dd>
              </div>
            );
          })}
        </dl>
        <div className="rm-by">
          <Pill role={lane.role as Role} dot>
            {now.by}
          </Pill>
        </div>
        {now.cmd !== undefined && <Terminal title={`bob 的电脑 · ${id === 'collab' ? 'collab' : 'fpga-hil'}`} lines={now.cmd.map((text) => ({ text, kind: 'cmd' as const }))} />}
      </div>
    </Pane>
  );
}

export function RepoModes(): JSX.Element {
  return (
    <Stepper steps={steps} label="同一周里，协作仓和别的仓各发生了什么" interval={6000}>
      {(step, index) => (
        <div className="rm-stage @container">
          <div className="rm-when">
            <Pill tone="info">{step.when}</Pill>
          </div>
          {/* 每一步换 key，两条线重新挂载，变了的格子闪一下 */}
          <div key={index} className="rm-lanes">
            <LaneView id="collab" step={step} previous={steps[index - 1]} />
            <LaneView id="plain" step={step} previous={steps[index - 1]} />
          </div>
        </div>
      )}
    </Stepper>
  );
}

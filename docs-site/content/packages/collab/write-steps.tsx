'use client';
/**
 * WriteSteps：网站上改一条任务，从请求到磁盘走五步、在哪一步被拒。
 * 每步左边一张卡片摆这一步手里的东西（表单字段 / 判定 / 计划 / 问题 / 结果），行前状态点分两路：
 * good 是 carol-test 改 status 的那一路（走通），bad 是改 detail 的那一路（第 2 步停下）；右边一句说明。数据都在 write-steps.data.mjs。
 */
import type { JSX } from 'react';
import { Dot, Pane, Stepper } from '@godcreator/explainer/site';
import { steps } from './write-steps.data.mjs';
import type { StepLine } from './write-steps.data.mjs';
import './write-steps.css';

function Row({ line }: { line: StepLine }): JSX.Element {
  return (
    <div className="ws-row" data-tone={line.tone}>
      {line.tone === 'none' ? <span className="ws-dot-none" aria-hidden="true" /> : <Dot tone={line.tone} />}
      <span>{line.text}</span>
    </div>
  );
}

export function WriteSteps(): JSX.Element {
  return (
    <Stepper steps={steps} label="一次写入走几步：carol-test 改 godcreator 的任务">
      {(step) => (
        <div key={step.title} className="ws-stage">
          <Pane title={step.cardTitle} icon="terminal" role="blue">
            <div className="ws-lines">
              {step.lines.map((line) => (
                <Row key={line.text} line={line} />
              ))}
            </div>
          </Pane>
          <p className="ws-note">{step.note}</p>
        </div>
      )}
    </Stepper>
  );
}

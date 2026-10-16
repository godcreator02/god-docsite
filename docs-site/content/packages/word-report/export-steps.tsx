'use client';
/**
 * ExportSteps：一次导出的六步，以及锁与任务状态怎么变。
 * 每步左边一张卡片摆这一步手里的东西（指纹的几项、锁文件的报错、快照目录的树、命令行、收尾的条件）；
 * 右边两张小卡片一直是「锁」与「任务状态」，随步变化：锁 无 → starting（Node 写入）→ rendering（Python 接手）
 * → 释放，任务 无 → running → ready。数据都在 export-steps.data.mjs（原话钉在那一文件里）。
 */
import type { JSX } from 'react';
import { Dot, Pane, Stepper } from '@godcreator/explainer/site';
import { steps } from './export-steps.data.mjs';
import type { DotTone, JobCard, LockCard, StepLine } from './export-steps.data.mjs';
import './export-steps.css';

function Row({ line }: { line: StepLine }): JSX.Element {
  return (
    <div className="es-row" data-tone={line.tone}>
      {line.tone === 'none' ? <span className="es-dot-none" aria-hidden="true" /> : <Dot tone={line.tone} />}
      <span>{line.text}</span>
    </div>
  );
}

function StatusDot({ tone }: { tone: DotTone }): JSX.Element {
  return tone === 'none' ? <span className="es-dot-none" aria-hidden="true" /> : <Dot tone={tone} />;
}

function LockPane({ lock }: { lock: LockCard }): JSX.Element {
  return (
    <Pane title="锁" icon="file" role="cyan" extra={<StatusDot tone={lock.dot} />}>
      <div className="es-lock-phase">{lock.phase}</div>
      {lock.lines.length === 0 ? null : (
        <div className="es-lock-lines">
          {lock.lines.map((line) => (
            <code key={line}>{line}</code>
          ))}
        </div>
      )}
    </Pane>
  );
}

function JobPane({ job }: { job: JobCard }): JSX.Element {
  return (
    <Pane title="任务状态" icon="terminal" role="amber" extra={<StatusDot tone={job.dot} />}>
      <div className="es-job">{job.label}</div>
    </Pane>
  );
}

export function ExportSteps(): JSX.Element {
  return (
    <Stepper steps={steps} label="一次导出六步：锁与任务状态怎么变">
      {(step) => (
        <div key={step.title} className="es-stage">
          <Pane title={step.cardTitle} icon="file" role="blue">
            <div className="es-lines">
              {step.lines.map((line) => (
                <Row key={line.text} line={line} />
              ))}
            </div>
          </Pane>
          <div className="es-side">
            <LockPane lock={step.lock} />
            <JobPane job={step.job} />
          </div>
        </div>
      )}
    </Stepper>
  );
}

'use client';
/**
 * SubmitStops：一次 collab.submit 停在哪一步，停下以后 bob 的协作仓是什么样、网站提示栏里出现什么。
 * 每种情况自上而下三张卡片（bob 的改动、八步、仓里留下什么）再一行提示栏；数据都在 submit-stops.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Diff, Dot, Pane, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, ends, steps } from './submit-stops.data.mjs';
import type { FileChange, StepState, SubmitCase } from './submit-stops.data.mjs';
import './submit-stops.css';

const stepTone: Record<StepState, Tone> = { ok: 'good', bad: 'bad', skip: 'pending' };

function ChangedFile({ file }: { file: FileChange }): JSX.Element {
  return (
    <div className="ss-file">
      <div className="ss-file-title">{file.path}</div>
      {file.groups.map((group, index) => (
        <div key={index} className="ss-group">
          {group.title !== null ? (
            <div className="ss-group-title">
              {group.title}
              {group.pill !== undefined ? <Pill role="slate">{group.pill}</Pill> : null}
            </div>
          ) : null}
          <Diff old={group.old} now={group.now} />
        </div>
      ))}
    </div>
  );
}

function CaseView({ item }: { item: SubmitCase }): JSX.Element {
  const end = ends[item.end];
  return (
    <div className="ss-case">
      <Pane title="bob 的改动" icon="file" role="blue">
        {item.changes.files.map((file) => (
          <ChangedFile key={file.path} file={file} />
        ))}
        {item.changes.note !== null ? <p className="ss-changes-note">{item.changes.note}</p> : null}
      </Pane>
      <Pane title="collab.submit 的八步" icon="terminal" role="violet">
        <ol className="ss-steps">
          {steps.map((name, index) => {
            const step = item.steps[index]!;
            return (
              <li key={name} data-state={step.state}>
                <Dot tone={stepTone[step.state]} />
                <span className="ss-step-name">
                  {index + 1}. {name}
                </span>
                <span className="ss-step-note">{step.note}</span>
              </li>
            );
          })}
        </ol>
      </Pane>
      <Pane title="仓里留下什么" icon="git" role="slate">
        <div className="ss-end">
          <Pill tone={end.tone} dot>
            {end.text}
          </Pill>
        </div>
        <p className="ss-repo-note">{item.leftInRepo}</p>
        {item.error !== null ? <CodeLines lines={item.error} tone="bad" /> : null}
        {item.receipt !== null ? <CodeLines lines={item.receipt} tone="good" /> : null}
      </Pane>
      <div className="ss-notice">
        <span className="ss-notice-title">网站提示栏 · 协作仓</span>
        {item.noticeBar.pills.length === 0 ? (
          <span className="ss-notice-empty">没有新通知</span>
        ) : (
          item.noticeBar.pills.map((pill) => (
            <Pill key={pill} role="amber">
              {pill}
            </Pill>
          ))
        )}
        {item.noticeBar.note !== null ? <p className="ss-notice-note">{item.noticeBar.note}</p> : null}
      </div>
    </div>
  );
}

export function SubmitStops(): JSX.Element {
  return (
    <CasePicker cases={cases} label="一次 collab.submit 停在哪一步，仓里留下什么">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

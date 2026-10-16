'use client';
/**
 * NewProblems：newProblems(before, after) 交回的是差集，一屏摆完，不用动画。
 * 左卡 before（分叉点）两条；中卡 after（这次提交后）三行——与 before 相同的灰底、新的一条、已修好的划掉；
 * 右卡只列拦下的那一条（bad）。数据都在 new-problems.data.mjs。
 */
import type { JSX } from 'react';
import { Dot, Pane } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { after, blocked, fileNameProblem, formatProblem, legend, note, text } from './new-problems.data.mjs';
import type { ProblemKind } from './new-problems.data.mjs';
import './new-problems.css';

const kindTone: Record<ProblemKind, Tone> = { same: 'pending', new: 'bad', fixed: 'good' };

function ProblemRow({ file, message }: { file: string; message: string }): JSX.Element {
  return (
    <>
      <span className="np-file">{file}</span>
      <span className="np-message">{message}</span>
    </>
  );
}

export function NewProblems(): JSX.Element {
  return (
    <div className="dx np-board not-prose">
      <div className="np-legend">
        {legend.map((item) => (
          <span key={item.label} className="np-legend-item">
            <Dot tone={item.tone} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="np-panes">
        <Pane title="before（分叉点）" icon="git" role="slate">
          <div className="np-list">
            <div className="np-row" data-kind="same">
              <Dot tone="pending" />
              <ProblemRow {...fileNameProblem} />
            </div>
            <div className="np-row">
              <Dot tone="good" />
              <ProblemRow {...formatProblem} />
            </div>
          </div>
        </Pane>
        <Pane title="after（这次提交后）" icon="git" role="slate">
          <div className="np-list">
            {after.map((line) => (
              <div key={line.message} className="np-row" data-kind={line.kind}>
                <Dot tone={kindTone[line.kind]} />
                <ProblemRow file={line.file} message={line.message} />
              </div>
            ))}
          </div>
        </Pane>
        <Pane title="拦下：newProblems(before, after)" icon="terminal" role="rose">
          <div className="np-list">
            {blocked.map((problem) => (
              <div key={problem.message} className="np-row">
                <Dot tone="bad" />
                <ProblemRow {...problem} />
              </div>
            ))}
          </div>
        </Pane>
      </div>
      <p className="np-note">{note}</p>
      <p className="np-text">{text}</p>
    </div>
  );
}

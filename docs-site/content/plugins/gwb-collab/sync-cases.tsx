'use client';
/**
 * SyncCases：取回之后什么时候快进、什么时候不动，不动时网站提示栏里出现什么。
 * 左边一列判定格从上往下问（停下的那格 bad 色、之后的灰掉，都过了走到底部的 ff-only）；
 * 右边一张卡摆仓的样子（分支、HEAD 对 origin/main、工作区），下面一行提示栏与通知原文。
 * 数据都在 sync-cases.data.mjs（原因与通知原话的出处钉在那里）。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill } from '@godcreator/explainer/site';
import { cases, dependencyNote, gates, mergeCommand } from './sync-cases.data.mjs';
import type { GateAnswer, RepoRow, SyncCase } from './sync-cases.data.mjs';
import './sync-cases.css';

function GateBox({ question, hit }: { question: string; hit: GateAnswer }): JSX.Element {
  return (
    <div className="sc-gate" data-state={hit.state}>
      <span className="sc-gate-question">{question}</span>
      {hit.answer !== null ? <span className="sc-gate-answer">{hit.answer}</span> : null}
    </div>
  );
}

function RepoRowView({ row }: { row: RepoRow }): JSX.Element {
  return (
    <div className="sc-repo-row">
      <Dot tone={row.tone} />
      <span className="sc-repo-label">{row.label}</span>
      <span className="sc-repo-value">{row.value}</span>
    </div>
  );
}

function CaseView({ item }: { item: SyncCase }): JSX.Element {
  return (
    <div className="sc-case">
      <div className="sc-gates">
        {gates.map((gate, index) => (
          <GateBox key={gate.id} question={gate.question} hit={item.gates[index]!} />
        ))}
        <div className="sc-gate sc-merge" data-state={item.merge.state}>
          <span className="sc-gate-question">{mergeCommand}</span>
          {item.merge.note !== null ? <span className="sc-gate-answer">{item.merge.note}</span> : null}
        </div>
      </div>
      <div className="sc-result">
        <Pane title="仓的样子" icon="git" role="slate">
          <div className="sc-repo">
            {item.repo.map((row) => (
              <RepoRowView key={row.label} row={row} />
            ))}
          </div>
          {item.showDependencyNote === true ? <p className="sc-dep">{dependencyNote}</p> : null}
        </Pane>
        <div className="sc-notice">
          <span className="sc-notice-title">网站提示栏 · 协作仓</span>
          {item.noticeBar.pills.length === 0 ? (
            <span className="sc-notice-empty">没有新通知</span>
          ) : (
            item.noticeBar.pills.map((pill) => (
              <Pill key={pill} role="amber">
                {pill}
              </Pill>
            ))
          )}
          {item.noticeBar.note !== null ? <p className="sc-notice-note">{item.noticeBar.note}</p> : null}
          {item.noticeBar.original !== null ? <CodeLines lines={item.noticeBar.original} /> : null}
        </div>
      </div>
    </div>
  );
}

export function SyncCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="取回以后，自动同步停在哪一格">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

'use client';
/**
 * MergeCases：合并检查对一次合并请求下什么结论。上面是「topic 比 main 改了什么」（按文件摆改到的行，
 * 冲突时分 topic 与 main 两组）；中间是 checkMerge 的两条各走成什么样；下面是结论、退出码与 problems 原话。
 * 数据都在 merge-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Diff, Dot, Pane, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, checkNames, repo } from './merge-cases.data.mjs';
import type { CheckRow, CheckState, MergeCase, Verdict } from './merge-cases.data.mjs';
import './merge-cases.css';

const stateTone: Record<CheckState, Tone> = { pass: 'good', fail: 'bad', skipped: 'pending' };
const verdictTone: Record<Verdict, Tone> = { mergeable: 'good', conflict: 'bad', 'needs-review': 'warn' };
const verdictWord: Record<Verdict, string> = { mergeable: '能合并', conflict: '有冲突', 'needs-review': '要负责人提交' };

function Changes({ item }: { item: MergeCase }): JSX.Element {
  return (
    <Pane title="topic 比 main 改了什么" icon="file" role="blue">
      {item.changes.map((group, index) => (
        <div key={group.side ?? index} className="mc-group">
          {group.side !== undefined ? (
            <div className="mc-side">
              {group.side}
              {group.sideNote !== undefined ? <Pill role="slate">{group.sideNote}</Pill> : null}
            </div>
          ) : null}
          {group.files.map((file) => (
            <div key={file.path} className="mc-file">
              <div className="mc-path">
                {file.path}
                {file.created ? '（新文件）' : ''}
              </div>
              <Diff old={file.old ?? []} now={file.now ?? []} />
            </div>
          ))}
        </div>
      ))}
    </Pane>
  );
}

function CheckRowView({ row, index }: { row: CheckRow; index: number }): JSX.Element {
  return (
    <li data-state={row.state}>
      <div className="mc-check-line">
        <Dot tone={stateTone[row.state]} />
        <span className="mc-check-name">
          {index + 1}. {checkNames[index]}
        </span>
        <span className="mc-check-note">{row.note}</span>
      </div>
      {row.variants !== undefined ? (
        <ul className="mc-variants">
          {row.variants.map((variant) => (
            <li key={variant.label} data-state={variant.state}>
              <Dot tone={stateTone[variant.state]} />
              <span className="mc-variant-label">{variant.label}</span>
              <span className="mc-check-note">{variant.note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Conclusion({ item }: { item: MergeCase }): JSX.Element {
  return (
    <div className="mc-verdict">
      {item.verdicts.map((row) => (
        <div key={row.label ?? 'verdict'} className="mc-verdict-row">
          {row.label !== undefined ? <span className="mc-verdict-label">{row.label}</span> : null}
          <Pill tone={verdictTone[row.verdict]} dot>
            {verdictWord[row.verdict]}
          </Pill>
          <Pill role="slate">命令行退出码 {row.exitCode}</Pill>
          {row.problems.length === 0 ? (
            <span className="mc-problems">没有问题</span>
          ) : (
            row.problems.map((problem) => (
              <span key={problem} className="mc-problems">
                {problem}
              </span>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

export function MergeCases(): JSX.Element {
  const request = `base: ${repo.request.base} · head: ${repo.request.head} · author: ${repo.request.author}`;
  return (
    <CasePicker cases={cases} label="合并检查对一次合并请求下什么结论">
      {(item) => (
        <div key={item.id} className="mc-case">
          <Changes item={item} />
          <Pane title="checkMerge 的两条" icon="terminal" role="violet" extra={<span className="mc-request">{request}</span>}>
            <ol className="mc-checks">
              {item.checks.map((row, index) => (
                <CheckRowView key={index} row={row} index={index} />
              ))}
            </ol>
          </Pane>
          <Conclusion item={item} />
        </div>
      )}
    </CasePicker>
  );
}

'use client';
/**
 * 「提交门禁拦什么、什么算红」：每一步同时显示 git status、check 的输出与退出码、check 对这处引用的判定、门禁状态。
 * 讲解文字与每一步的数据都在 commit-gate.data.mjs，这里只负责画；步骤控制条、每一步的标题与说明由 Stepper 显示。
 * 机读版由 commit-gate.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { Diff, Dot, Pane, Pill, Stepper, Terminal } from '@godcreator/explainer-player';
import type { TerminalLine, Tone } from '@godcreator/explainer-player';
import { files, gateLabel, gateNote, notRed, redSources, steps } from './commit-gate.data.mjs';

type Step = (typeof steps)[number];
type Gate = Step['gate'];
type ProbeRow = NonNullable<Step['probe']>['rows'][number];

const gateTone: Record<Gate, Tone> = { blocked: 'bad', open: 'good', pending: 'pending' };
const answerText: Record<ProbeRow['answer'], string> = { yes: '是', no: '否', skip: '不问' };

/** porcelain 一行是「两位状态码 + 空格 + 路径」，路径从第 4 个字符起 */
const pathOfStatusLine = (line: string): string => line.slice(3);

function GitStatus({ repos }: { repos: Step['repos'] }): JSX.Element {
  return (
    <Pane title="git status --porcelain" role="slate" icon="git">
      {repos.map((repo) => (
        <div key={repo.path} className="cg-repo">
          <div className="cg-repo-head">
            <span className="cg-repo-path">{repo.path}</span>
            <span className="cg-repo-note">{repo.note}</span>
          </div>
          {repo.lines.length === 0 ? (
            <div className="cg-clean">没有输出：工作区与暂存区都跟 HEAD 一致</div>
          ) : (
            <div className="cg-porcelain">
              {repo.lines.map((line) => (
                <div
                  key={line}
                  className="cg-status-line"
                  data-role={repo.hit !== null && pathOfStatusLine(line) === repo.hit ? 'amber' : undefined}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Pane>
  );
}

function terminalLines(step: Step): TerminalLine[] {
  return [
    { text: step.command, kind: 'cmd' },
    ...step.output,
    { text: 'echo $?', kind: 'cmd' },
    { text: String(step.exit), kind: step.exit === 0 ? 'ok' : 'err' },
  ];
}

function Change({ change }: { change: NonNullable<Step['change']> }): JSX.Element {
  return (
    <Pane title={change.file} role={change.role} icon="file" extra={change.label}>
      <Diff old={change.old} now={change.now} />
    </Pane>
  );
}

function Probe({ probe, index }: { probe: NonNullable<Step['probe']>; index: number }): JSX.Element {
  return (
    <Pane title="check 对这处引用的判定" role="cyan" icon="terminal">
      <ol className="cg-probe">
        {probe.rows.map((row) => (
          <li key={row.ask} className="cg-ask">
            <span className="cg-answer" data-role={row.answer === 'yes' ? 'cyan' : 'slate'} data-skip={row.answer === 'skip' ? true : undefined}>
              {answerText[row.answer]}
            </span>
            <span className="cg-ask-q">{row.ask}</span>
            <span className="cg-ask-d">{row.detail}</span>
          </li>
        ))}
      </ol>
      {/* 每一步换 key，结论胶囊重新挂载，弹出动画重放一次 */}
      <Pill key={index} tone={probe.verdict.tone} dot>
        {probe.verdict.text}
      </Pill>
    </Pane>
  );
}

function RedSources(): JSX.Element {
  return (
    <Pane title="计入红的几类" role="rose">
      <ul className="cg-sources">
        {redSources.map((source) => (
          <li key={source.name} className="cg-source">
            <span className="cg-source-name">
              <Dot tone="bad" />
              {source.name}
            </span>
            <span className="cg-source-rule">{source.rule}</span>
          </li>
        ))}
      </ul>
      <div className="cg-not-red">
        <span className="cg-not-red-label">只打印、不计入</span>
        {notRed.map((item) => (
          <Pill key={item} role="slate">
            {item}
          </Pill>
        ))}
      </div>
    </Pane>
  );
}

/** 提交按钮的图标：锁（被拦）、对勾（通过）、时钟（等重跑 check）；笔画取自 Lucide（ISC 许可） */
function GateIcon({ gate }: { gate: Gate }): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {gate === 'blocked' ? (
        <>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      ) : gate === 'open' ? (
        <path d="M20 6 9 17l-5-5" />
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </>
      )}
    </svg>
  );
}

function GateBar({ gate, index }: { gate: Gate; index: number }): JSX.Element {
  const tone = gateTone[gate];
  return (
    <div className="cg-gate" data-tone={tone}>
      <div className="cg-gate-row">
        <span className="cg-commit" data-state={gate}>
          <GateIcon gate={gate} />
          git commit
        </span>
        <Pill key={index} tone={tone} dot>
          {gateLabel[gate]}
        </Pill>
      </div>
      <p className="cg-gate-note">{gateNote}</p>
    </div>
  );
}

function StepPicture({ step, index }: { step: Step; index: number }): JSX.Element {
  const side = [
    step.change !== null ? <Change key="change" change={step.change} /> : null,
    step.probe !== null ? <Probe key="probe" probe={step.probe} index={index} /> : null,
    step.sources ? <RedSources key="sources" /> : null,
  ].filter((part) => part !== null);
  return (
    <>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <GitStatus repos={step.repos} />
        <Terminal title={files.cwd} lines={terminalLines(step)} />
      </div>
      {side.length > 0 ? <div className={side.length > 1 ? 'grid gap-3 @2xl:grid-cols-2' : 'grid gap-3'}>{side}</div> : null}
      <GateBar gate={step.gate} index={index} />
    </>
  );
}

export function CommitGate(): JSX.Element {
  return (
    <Stepper steps={steps} label="提交门禁拦什么、什么算红">
      {(step, index) => <StepPicture step={step} index={index} />}
    </Stepper>
  );
}

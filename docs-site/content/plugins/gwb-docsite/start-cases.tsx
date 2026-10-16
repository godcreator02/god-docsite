'use client';
/**
 * StartCases：对一个站调一次 start 的八种情况。上面是 gwb-data 的 site-ports（前后各一行）、
 * 中间是 SiteHost.start 的五步（哪一步下结论、第 ④ 步启动的命令）、下面是交回与之后的状态。数据都在 start-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill, Terminal } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, envLine, refusalMessages, siteDir, stepNames } from './start-cases.data.mjs';
import type { Occupancy, SiteState, StartCase, StartStep } from './start-cases.data.mjs';
import './start-cases.css';

const stepNumbers = ['①', '②', '③', '④', '⑤'];

const occupancyTone: Record<Occupancy, Tone> = { free: 'good', taken: 'bad', none: 'pending' };
const occupancyWord: Record<Occupancy, string> = { free: '空着', taken: '被占了', none: '没记过' };
const stateTone: Record<SiteState, Tone> = { running: 'good', stopped: 'pending', failed: 'bad' };

function stepTone(step: StartStep): Tone {
  if (step.state === 'pass') return 'good';
  if (step.state === 'skip') return 'pending';
  return step.stopTone === 'reuse' ? 'info' : 'bad';
}

function PortsCard({ item }: { item: StartCase }): JSX.Element {
  return (
    <Pane title="gwb-data 的 site-ports" icon="file" role="blue">
      <div className="sc-ports">
        <div className="sc-ports-line">
          <span className="sc-ports-label">之前</span>
          <span className="sc-ports-value">{item.portsBefore.port ?? '—'}</span>
          <Pill tone={occupancyTone[item.portsBefore.occupancy]}>{occupancyWord[item.portsBefore.occupancy]}</Pill>
        </div>
        <div className="sc-ports-line">
          <span className="sc-ports-label">之后</span>
          <span className="sc-ports-value">{item.portsAfter.port ?? '—'}</span>
          <span className="sc-ports-note">{item.portsAfter.note}</span>
        </div>
      </div>
    </Pane>
  );
}

function StepsCard({ item }: { item: StartCase }): JSX.Element {
  return (
    <Pane title="SiteHost.start 的五步" icon="terminal" role="violet">
      <ol className="sc-steps">
        {stepNames.map((name, index) => {
          const step = item.steps[index]!;
          return (
            <li key={name} data-state={step.state}>
              <Dot tone={stepTone(step)} />
              <span className="sc-step-name">
                {stepNumbers[index]} {name}
              </span>
              <span className="sc-step-note">{step.state === 'skip' ? '没走到' : step.note}</span>
              {index === 3 && step.state === 'pass' && item.command !== null ? (
                <div className="sc-step-extra">
                  <Terminal title={siteDir} lines={[envLine, { text: item.command, kind: 'cmd' }]} />
                </div>
              ) : null}
              {index === 1 && item.refusals !== undefined ? (
                <div className="sc-step-extra">
                  <CodeLines lines={refusalMessages} tone="bad" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Pane>
  );
}

function Verdict({ item }: { item: StartCase }): JSX.Element {
  return (
    <div className="sc-verdict">
      <div className="sc-result">
        <Pill tone={item.result.error ? 'bad' : 'good'} dot>
          {item.result.error ? '报错' : '交回'}
        </Pill>
        <code className="sc-result-value">{item.result.value}</code>
      </div>
      {item.after.map((line, index) => (
        <div key={line.label ?? index} className="sc-after-line">
          {line.label !== undefined ? <span className="sc-after-label">{line.label}</span> : null}
          <Pill tone={stateTone[line.state]} dot>
            {line.state}
          </Pill>
          <span className="sc-after-detail">
            {line.url !== null ? `url ${line.url}` : ''}
            {line.error !== null ? `${line.url !== null ? '；' : ''}error：${line.error}` : ''}
            {line.note !== undefined ? `；${line.note}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function CaseView({ item }: { item: StartCase }): JSX.Element {
  return (
    <div className="sc-case">
      <PortsCard item={item} />
      <StepsCard item={item} />
      <Verdict item={item} />
    </div>
  );
}

export function StartCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="一次 start 的七种情况">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

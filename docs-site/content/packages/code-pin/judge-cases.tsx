'use client';
/**
 * JudgeCases：一处行段钉在六种改动下怎么判。左边是确认时的文件，右边是今天的文件，钉住的行段按结论着色；
 * 中间一条是判定的四步，哪一步下了结论；下面是结论与确认时的动作。数据都在 judge-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, confirmedLines, confirmedSpan, pinnedFile, stepNames } from './judge-cases.data.mjs';
import type { JudgeCase, Status, TrailState } from './judge-cases.data.mjs';
import './judge-cases.css';

const statusTone: Record<Status, Tone> = { fresh: 'good', changed: 'warn', missing: 'bad' };
const statusWord: Record<Status, string> = { fresh: '新鲜', changed: '有变动', missing: '缺失' };
const reasonWord: Record<string, string> = { changed: '内容变了', vanished: '整段已被删光', unlocated: '位置不明' };
const trailTone: Record<TrailState, Tone> = { yes: 'info', no: 'pending', skip: 'pending' };

function Trail({ item }: { item: JudgeCase }): JSX.Element {
  return (
    <ol className="jc-trail">
      {stepNames.map((name, index) => {
        const step = item.trail[index]!;
        return (
          <li key={name} data-state={step.state}>
            <Dot tone={trailTone[step.state]} />
            <span className="jc-step-name">
              {index + 1}. {name}
            </span>
            <span className="jc-step-note">{step.state === 'skip' ? '没走到' : step.note}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CaseView({ item }: { item: JudgeCase }): JSX.Element {
  const tone = statusTone[item.status];
  return (
    <div className="jc-case">
      <div className="jc-files">
        <Pane title={`确认时的 ${pinnedFile}`} icon="file" role="slate" extra={item.history ? <Pill tone="good">git 里取得到</Pill> : <Pill tone="pending">git 里取不到</Pill>}>
          <div data-history={item.history ? undefined : 'lost'} className="jc-old">
            <CodeLines lines={confirmedLines} highlight={confirmedSpan} tone="info" />
          </div>
        </Pane>
        <Pane title={`今天的 ${pinnedFile}`} icon="file" role="blue" extra={<Pill tone={tone} dot>{item.span === null ? '找不到对应的行' : `第 ${item.span[0]}–${item.span[1]} 行`}</Pill>}>
          <CodeLines lines={item.lines} highlight={item.span} tone={tone} />
        </Pane>
      </div>
      <Pane title="核对：行段判定的四步" icon="terminal" role="violet">
        <Trail item={item} />
      </Pane>
      <div className="jc-verdict">
        <Pill tone={tone} dot>
          {statusWord[item.status]}
          {item.reason === null || item.reason === 'changed' ? '' : `：${reasonWord[item.reason]}`}
        </Pill>
        <Pill role="amber">确认：{item.action}</Pill>
        <span className="jc-written">{item.written}</span>
      </div>
    </div>
  );
}

export function JudgeCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="一处行段钉在六种改动下怎么判">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

'use client';
/**
 * CommentRoundTrip：一条划字评论从划字到回到正文的整条路（六步）。三条横道自上而下：浏览器、站点服务端、磁盘；
 * 当前这一步在哪条横道做事，那条横道正常显示、放这一步的画，另两条调淡只留标题；横道之间的箭头写这一步跨横道传的东西。
 * 第 1 步画页面文字的字格与锚点 JSON，第 2 步画提交的请求，第 3 步画核对清单，第 4 步画文件树与整份串头，
 * 第 5 步画 loader 交给浏览器的那一串，第 6 步画正文与收件箱的一行。数据都在 round-trip.data.mjs（共用例子在 example.data.mjs）。
 */
import { Fragment, type JSX } from 'react';
import { CodeLines, Dot, Pane, Pill, Stepper, Terminal } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import {
  anchorLines,
  checks,
  checksNote,
  collectionNote,
  inboxRow,
  lanes,
  loaderAuthorLine,
  loaderAuthorPill,
  loaderLines,
  requestLines,
  steps,
  threadFileLines,
  threadTreeLines,
} from './round-trip.data.mjs';
import type { RoundTripStep } from './round-trip.data.mjs';
import { bodyBlocks, quoteSpan, snapshotChars, trustedOrigin } from './example.data.mjs';
import './round-trip.css';

/** 字格：页面文字画成一排字（字从 0 数），第 from 到 to 格（含两端）按 tone 高亮，marks 的格子下面标出它的位置 */
function TextCells({
  chars,
  from,
  to,
  tone,
  marks,
}: {
  chars: { char: string; atomic?: boolean }[];
  from: number;
  to: number;
  tone: Tone;
  marks: Record<number, number>;
}): JSX.Element {
  return (
    <div className="rt-cells" role="img" aria-label={`页面文字，共 ${chars.length} 个字，字从 0 数`}>
      {chars.map((item, index) => (
        <span key={index} className="rt-cell-unit">
          <span className="rt-cell" data-tone={tone} data-hl={index >= from && index <= to ? '' : undefined}>
            {item.char}
            {item.atomic ? <i className="rt-cell-tag">图片</i> : null}
          </span>
          {marks[index] !== undefined ? <i className="rt-cell-no">{marks[index]}</i> : null}
        </span>
      ))}
    </div>
  );
}

/** 第 6 步的正文：标题、三段，图片画一个小方块；被批的五个字铺划字的高亮 */
function BodyView(): JSX.Element {
  return (
    <div className="rt-doc">
      {bodyBlocks.map((block, index) => (
        <div key={index} className={block.kind === 'heading' ? 'rt-doc-heading' : 'rt-doc-para'}>
          {block.image ? <span className="rt-doc-img" role="img" aria-label="图片：整个算一个字" /> : null}
          <span data-hl={block.quoted ? '' : undefined}>{block.text}</span>
        </div>
      ))}
    </div>
  );
}

function StepView({ index }: { index: number }): JSX.Element {
  switch (index) {
    case 0:
      return (
        <div className="rt-anchor">
          <TextCells chars={snapshotChars} from={quoteSpan[0]} to={quoteSpan[1] - 1} tone="info" marks={{ [quoteSpan[0]]: quoteSpan[0], [quoteSpan[1]]: quoteSpan[1] }} />
          <CodeLines lines={anchorLines} />
        </div>
      );
    case 1:
      return <Terminal title={`页面发给 ${trustedOrigin}`} lines={requestLines} />;
    case 2:
      return (
        <div className="rt-checks">
          <ol>
            {checks.map((line) => (
              <li key={line}>
                <Dot tone="good" />
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="rt-dim-note">{checksNote}</p>
        </div>
      );
    case 3:
      return (
        <div className="rt-write">
          <pre className="rt-tree">{threadTreeLines.join('\n')}</pre>
          <CodeLines lines={threadFileLines} />
        </div>
      );
    case 4:
      return (
        <div className="rt-read">
          <p className="rt-dim-note">{collectionNote}</p>
          <CodeLines lines={loaderLines} highlight={[loaderAuthorLine, loaderAuthorLine]} tone="info" />
          <Pill tone="info">{loaderAuthorPill}</Pill>
        </div>
      );
    default:
      return (
        <div className="rt-body-view">
          <BodyView />
          <div className="rt-inbox-row">
            <span className="rt-avatar" aria-hidden="true">
              {inboxRow.avatar}
            </span>
            <span className="rt-inbox-name">{inboxRow.name}</span>
            <span className="rt-inbox-time">{inboxRow.time}</span>
            <span className="rt-inbox-note">{inboxRow.note}</span>
          </div>
        </div>
      );
  }
}

function Stage({ step, index }: { step: RoundTripStep; index: number }): JSX.Element {
  return (
    <div className="rt-stage">
      {lanes.map((lane, laneIndex) => (
        <Fragment key={lane.id}>
          {laneIndex > 0 ? (
            <div className="rt-flow" data-active={step.flow?.gap === laneIndex - 1 ? '' : undefined} data-dir={step.flow?.gap === laneIndex - 1 ? step.flow.dir : undefined}>
              {step.flow?.gap === laneIndex - 1 ? (
                <>
                  <span className="rt-flow-arrow" aria-hidden="true">
                    {step.flow.dir === 'down' ? '↓' : '↑'}
                  </span>
                  {step.flow.label ? <span className="rt-flow-label">{step.flow.label}</span> : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div className="rt-lane" data-dim={step.lane === lane.id ? undefined : ''}>
            <Pane title={lane.title} role={lane.role}>
              {step.lane === lane.id ? <StepView index={index} /> : null}
            </Pane>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function CommentRoundTrip(): JSX.Element {
  return (
    <Stepper steps={steps} label="一条划字评论从写到回到正文的整条路">
      {(step, index) => <Stage key={index} step={step} index={index} />}
    </Stepper>
  );
}

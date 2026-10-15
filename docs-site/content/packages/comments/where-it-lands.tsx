'use client';
/**
 * WhereItLands：同一条划字评论在正文的几种改动下落在哪（六种情况）。
 * 上面两张卡片：左边「评论存的快照」（第 15 到 19 格高亮），右边「今天的正文」（推算出的那段按结论着色）；
 * 中间「找落点」三步，走到哪一步下了结论；下面一行是落点、收件箱筛在哪一栏、引文行的原文。
 * 快照固定 slate、今天的正文固定 blue、找落点固定 violet。数据都在 where-it-lands.data.mjs（共用例子在 example.data.mjs）。
 */
import type { JSX } from 'react';
import { CasePicker, Dot, Pane, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, elementAnchorId, stepNames } from './where-it-lands.data.mjs';
import type { LandCase, TrailState } from './where-it-lands.data.mjs';
import { bodyBlocks, quoteSpan, snapshotChars } from './example.data.mjs';
import './where-it-lands.css';

const trailTone: Record<TrailState, Tone> = { yes: 'info', no: 'pending', skip: 'pending' };

const kindTone: Record<LandCase['kind'], Tone> = { text: 'good', hidden: 'pending', missing: 'bad' };

/** 字格：一排字（字从 0 数），from 到 to 格（含两端）按 tone 高亮，folded 的格子画虚线框并调淡，marks 的格子下标出位置 */
function TextCells({
  chars,
  from,
  to,
  tone,
  folded,
  marks,
}: {
  chars: { char: string; atomic?: boolean }[];
  from: number | null;
  to: number | null;
  tone: Tone;
  folded?: readonly [number, number];
  marks: Record<number, number>;
}): JSX.Element {
  return (
    <div className="wl-cells" role="img" aria-label={`文字，共 ${chars.length} 个字，字从 0 数`}>
      {chars.map((item, index) => (
        <span key={index} className="wl-cell-unit">
          <span
            className="wl-cell"
            data-tone={tone}
            data-hl={from !== null && to !== null && index >= from && index <= to ? '' : undefined}
            data-folded={folded !== undefined && index >= folded[0] && index <= folded[1] ? '' : undefined}
          >
            {item.char}
            {item.atomic ? <i className="wl-cell-tag">图片</i> : null}
          </span>
          {marks[index] !== undefined ? <i className="wl-cell-no">{marks[index]}</i> : null}
        </span>
      ))}
    </div>
  );
}

/** element-gone 的「今天的正文」：四块正文，标题那块画成虚线空位（这一页上已经没有它） */
function TodayBlocks(): JSX.Element {
  return (
    <div className="wl-doc">
      {bodyBlocks.map((block, index) => (
        <div key={index} className={block.kind === 'heading' ? 'wl-doc-heading' : 'wl-doc-para'} data-gone={block.kind === 'heading' ? '' : undefined}>
          {block.kind === 'heading' ? (
            <span className="wl-doc-gone">标题文字（已删）</span>
          ) : (
            <>
              {block.image ? <span className="wl-doc-img" role="img" aria-label="图片：整个算一个字" /> : null}
              <span>{block.text}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function SnapshotPane({ item }: { item: LandCase }): JSX.Element {
  return (
    <Pane title="评论存的快照" icon="file" role="slate">
      {item.id === 'element-gone' ? (
        <code className="wl-anchor-line">anchor: &quot;{elementAnchorId}&quot;</code>
      ) : (
        <TextCells chars={snapshotChars} from={quoteSpan[0]} to={quoteSpan[1] - 1} tone="info" marks={{ [quoteSpan[0]]: quoteSpan[0], [quoteSpan[1]]: quoteSpan[1] }} />
      )}
    </Pane>
  );
}

function TodayPane({ item }: { item: LandCase }): JSX.Element {
  const today = item.today;
  const extra =
    today.kind !== 'cells' || today.todayExtra === undefined ? null : (
      <Pill tone={item.id === 'hidden' ? 'pending' : 'bad'}>{today.todayExtra}</Pill>
    );
  return (
    <Pane title="今天的正文" icon="file" role="blue" extra={extra}>
      {today.kind === 'cells' ? (
        <TextCells
          chars={today.chars}
          from={today.highlight === null ? null : today.highlight[0]}
          to={today.highlight === null ? null : today.highlight[1]}
          tone={today.tone ?? 'good'}
          folded={today.folded}
          marks={{}}
        />
      ) : (
        <TodayBlocks />
      )}
    </Pane>
  );
}

function Trail({ item }: { item: LandCase }): JSX.Element {
  return (
    <ol className="wl-trail">
      {stepNames.map((name, index) => {
        const step = item.trail[index]!;
        return (
          <li key={name} data-state={step.state}>
            <Dot tone={trailTone[step.state]} />
            <span className="wl-step-name">
              {index + 1}. {name}
            </span>
            <span className="wl-step-note">{step.state === 'skip' ? '没走到' : step.note}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CaseView({ item }: { item: LandCase }): JSX.Element {
  return (
    <div className="wl-case">
      <div className="wl-cards">
        <SnapshotPane item={item} />
        <TodayPane item={item} />
      </div>
      <Pane title="找落点" icon="terminal" role="violet">
        <Trail item={item} />
      </Pane>
      <div className="wl-verdict">
        <Pill tone={item.kind === 'text' && item.changed ? 'warn' : kindTone[item.kind]} dot>
          落点：{item.kind}
        </Pill>
        <Pill role="amber">收件箱：{item.inbox}</Pill>
        <span className="wl-note">{item.note}</span>
      </div>
    </div>
  );
}

export function WhereItLands(): JSX.Element {
  return (
    <CasePicker cases={cases} label="同一条评论在正文的几种改动下落在哪">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

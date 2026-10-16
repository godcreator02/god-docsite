'use client';
/**
 * SiteStates：一个站的三种状态（running / stopped / failed）由哪些事件转换、哪些操作幂等。
 * 上面是状态图（SVG，三个圆角框、箭头上写事件；当前情况的那条箭头高亮，其余淡下去；
 * 没有状态转换的情况全部淡下去）；下面是这一次 docsite.site.list 里这个站的行。数据都在 site-states.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, diagram } from './site-states.data.mjs';
import type { StateCase, StateId } from './site-states.data.mjs';
import { siteDir } from './start-cases.data.mjs';
import './site-states.css';

const stateTone: Record<StateId, Tone> = { running: 'good', stopped: 'pending', failed: 'bad' };

function StateDiagramSvg({ item }: { item: StateCase }): JSX.Element {
  const hasLit = item.lit.length > 0;
  return (
    <svg
      className="ss-svg"
      viewBox={`0 0 ${diagram.view.w} ${diagram.view.h}`}
      role="img"
      aria-label={`状态图：这次落在这个状态——${item.states.to}`}
    >
      <defs>
        {(['info', 'bad'] as const).map((tone) => (
          <marker key={tone} id={`ss-arrow-${tone}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" className="ss-arrowhead" data-tone={tone} />
          </marker>
        ))}
      </defs>
      {diagram.edges.map((edge) => {
        const lit = item.lit.includes(edge.id);
        const dim = hasLit && !lit;
        return (
          <g key={edge.id} className="ss-edge" data-tone={edge.tone} data-lit={lit || undefined} data-dim={dim || undefined}>
            <path d={edge.d} markerEnd={`url(#ss-arrow-${edge.tone})`} />
            <text className="ss-edge-label" x={edge.labelAt[0]} y={edge.labelAt[1]} textAnchor="middle">
              {edge.label}
            </text>
            {edge.note !== undefined && edge.noteAt !== undefined ? (
              <text className="ss-edge-note" x={edge.noteAt[0]} y={edge.noteAt[1]} textAnchor="middle">
                {edge.note}
              </text>
            ) : null}
          </g>
        );
      })}
      {diagram.boxes.map((box) => (
        <g key={box.id} className="ss-box" data-state={box.id} data-lit={item.states.to === box.id || undefined}>
          <rect x={box.x} y={box.y} width={box.w} height={48} rx={10} />
          <text className="ss-box-label" x={box.x + box.w / 2} y={box.y + 29} textAnchor="middle">
            {box.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ListCard({ item }: { item: StateCase }): JSX.Element {
  return (
    <Pane title="docsite.site.list 里这个站的行" icon="terminal" role="slate">
      <div className="ss-list">
        <div className="ss-row">
          <span className="ss-key">dir</span>
          <span className="ss-value">{siteDir}</span>
        </div>
        <div className="ss-row">
          <span className="ss-key">state</span>
          <Pill tone={stateTone[item.list.state]} dot>
            {item.list.state}
          </Pill>
        </div>
        <div className="ss-row">
          <span className="ss-key">url</span>
          <span className="ss-value">{item.list.url ?? 'null'}</span>
        </div>
        <div className="ss-row">
          <span className="ss-key">error</span>
          <span className="ss-value" data-empty={item.list.error === null || undefined}>
            {item.list.error ?? 'null'}
          </span>
        </div>
        {item.thrown !== null ? (
          <div className="ss-row">
            <span className="ss-key">stop 抛出</span>
            <span className="ss-value ss-thrown">{item.thrown}</span>
          </div>
        ) : null}
      </div>
    </Pane>
  );
}

export function SiteStates(): JSX.Element {
  return (
    <CasePicker cases={cases} label="一个站的三种状态：哪些事件转换、哪些操作幂等">
      {(item) => (
        <div key={item.id} className="ss-case">
          <div className="ss-diagram">
            <StateDiagramSvg item={item} />
          </div>
          <ListCard item={item} />
        </div>
      )}
    </CasePicker>
  );
}

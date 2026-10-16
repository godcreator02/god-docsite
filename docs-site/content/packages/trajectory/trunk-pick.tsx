'use client';
/**
 * TrunkPick：取代与转向怎么连成树、主干怎么挑，五步——连成树、找起点、两条候选、比终点、淡出与领域序。
 * 左边是自画的 SVG（照 disk-placement.tsx 的写法，颜色只用 --dx-* 变量）：①→②→③→④ 与 ②→⑥ 是取代边（实线），
 * ④⇢⑤ 是转向边（虚线），⑦⑧⑨ 三颗孤星在右边单列；节点是带编号的小圆，下面写日期。
 * 每步右边一句说明。数据都在 trunk-pick.data.mjs。
 */
import type { JSX } from 'react';
import { Pill, Stepper } from '@godcreator/explainer/site';
import { candidates, domainOrder, edges, nodes, steps, verdicts } from './trunk-pick.data.mjs';
import type { TrunkEdge, TrunkNode } from './trunk-pick.data.mjs';
import './trunk-pick.css';

/** 节点坐标（viewBox 640×296）：上排 ①–④，下排 ⑥⑤，右列 ⑦⑧⑨ 孤星；标注摆在框内四角的空处，不压框线、节点与日期 */
const POS: Record<string, { x: number; y: number }> = {
  '①': { x: 64, y: 86 },
  '②': { x: 172, y: 86 },
  '③': { x: 280, y: 86 },
  '④': { x: 388, y: 86 },
  '⑥': { x: 266, y: 200 },
  '⑤': { x: 478, y: 200 },
  '⑦': { x: 596, y: 74 },
  '⑧': { x: 596, y: 144 },
  '⑨': { x: 596, y: 214 },
};
const NODE_R = 17;
/** 树的连通框（上下都留出了标注的空）与孤星分列的虚线 */
const TREE_RECT = { x: 30, y: 24, w: 482, h: 252 };
const DIVIDER = { x: 552, y0: 40, y1: 252 };

const posOf = (mark: string): { x: number; y: number } => POS[mark] as { x: number; y: number };
const keyOf = (e: TrunkEdge): string => `${e.from}→${e.to}`;
/** 每步里要重点描的边：候选（两条都描）、主干（加粗）；主干成员与被取代的节点另列 */
const CANDIDATES = ['①→②', '②→③', '③→④', '②→⑥'];
const TRUNK_EDGES = ['①→②', '②→⑥'];
const TRUNK_NODES = ['①', '②', '⑥'];
const SUPERSEDED = new Set(['①', '②', '③']);

/** 标注胶囊在 SVG 里的宽度：全角字符按 11、半角按 6.5 估 */
const tagWidth = (text: string): number => [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xff ? 11 : 6.5), 14);

function Tag({ x, y, text, tone }: { x: number; y: number; text: string; tone: string }): JSX.Element {
  const w = tagWidth(text);
  return (
    <g className={`tp-tag tp-tag-${tone}`} transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-11} width={w} height={20} rx={10} />
      <text y={3.5} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function edgeClassOf(edge: TrunkEdge, phase: number): string {
  const key = keyOf(edge);
  const base = `tp-edge tp-edge-${edge.kind}`;
  if (phase === 1 && edge.kind === 'pivot') return `${base} tp-edge-dim`;
  if (phase === 2 && CANDIDATES.includes(key)) return `${base} tp-cand`;
  if (phase === 3) return TRUNK_EDGES.includes(key) ? `${base} tp-trunk` : `${base} tp-dim`;
  if (phase === 4 && (SUPERSEDED.has(edge.from) || SUPERSEDED.has(edge.to))) return `${base} tp-dead`;
  return base;
}

const onTrunk = (mark: string): boolean => TRUNK_NODES.includes(mark);

function nodeClassOf(node: TrunkNode, phase: number): string {
  const domain = node.domain === '界面' ? 'violet' : 'blue';
  let cls = `tp-node tp-node-${domain}`;
  if (phase === 1 && node.mark === '①') cls += ' tp-node-start';
  if (phase === 3) cls += onTrunk(node.mark) ? ' tp-chosen' : ' tp-dim';
  if (phase === 4 && node.superseded) cls += ' tp-dead';
  return cls;
}

/** 编号在圆里、日期在圆下；第 1 步的起点与第 3 步的主干成员外加一圈描边 */
function Node({ node, phase }: { node: TrunkNode; phase: number }): JSX.Element {
  const p = posOf(node.mark);
  const dim = (phase === 4 && node.superseded) || (phase === 3 && !onTrunk(node.mark));
  const ring = (phase === 3 && onTrunk(node.mark)) || (phase === 1 && node.mark === '①');
  return (
    <g className={nodeClassOf(node, phase)}>
      <circle cx={p.x} cy={p.y} r={NODE_R} />
      {ring ? <circle cx={p.x} cy={p.y} r={NODE_R + 5} className="tp-ring" /> : null}
      <text x={p.x} y={p.y + 5} textAnchor="middle" className="tp-mark">
        {node.mark}
      </text>
      <text x={p.x} y={p.y + NODE_R + 15} textAnchor="middle" className={dim ? 'tp-date tp-date-dim' : 'tp-date'}>
        {node.date}
      </text>
    </g>
  );
}

function Stage({ phase }: { phase: number }): JSX.Element {
  const at = (mark: string): { x: number; y: number } => posOf(mark);
  return (
    <div className="tp-stage">
      <div className="tp-svg">
        <svg viewBox="0 0 640 296">
          <defs>
            <marker id="tp-arrow-supersede" viewBox="0 0 10 10" refX={8.5} refY={5} markerWidth={4.6} markerHeight={4.6} orient="auto">
              <path d="M0 0 L10 5 L0 10 Z" className="tp-arrow tp-arrow-supersede" />
            </marker>
            <marker id="tp-arrow-pivot" viewBox="0 0 10 10" refX={8.5} refY={5} markerWidth={4.6} markerHeight={4.6} orient="auto">
              <path d="M0 0 L10 5 L0 10 Z" className="tp-arrow tp-arrow-pivot" />
            </marker>
          </defs>
          {/* 第 1 步：①–⑥ 的连通框；之后淡成背景 */}
          <rect x={TREE_RECT.x} y={TREE_RECT.y} width={TREE_RECT.w} height={TREE_RECT.h} rx={14} className={phase === 0 ? 'tp-tree' : 'tp-tree tp-tree-off'} />
          <line x1={DIVIDER.x} y1={DIVIDER.y0} x2={DIVIDER.x} y2={DIVIDER.y1} className="tp-divider" />
          {phase === 0 ? (
            <>
              <text x={TREE_RECT.x + TREE_RECT.w - 14} y={TREE_RECT.y + 26} textAnchor="end" className="tp-zone">
                ①–⑥ 连成一棵树
              </text>
              <text x={596} y={24} textAnchor="middle" className="tp-zone">
                孤星
              </text>
            </>
          ) : null}
          {edges.map((e) => {
            const a = at(e.from);
            const b = at(e.to);
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const ux = (b.x - a.x) / len;
            const uy = (b.y - a.y) / len;
            return (
              <line
                key={keyOf(e)}
                x1={a.x + ux * (NODE_R + 7)}
                y1={a.y + uy * (NODE_R + 7)}
                x2={b.x - ux * (NODE_R + 16)}
                y2={b.y - uy * (NODE_R + 16)}
                className={edgeClassOf(e, phase)}
                markerEnd={`url(#tp-arrow-${e.kind})`}
              />
            );
          })}
          {nodes.map((n) => (
            <Node key={n.mark} node={n} phase={phase} />
          ))}
          {phase === 1 ? <Tag x={64} y={48} text="起点" tone="amber" /> : null}
          {phase === 2
            ? candidates.map((c) =>
                c.at === '④' ? (
                  <Tag key={c.at} x={388} y={48} text={c.text} tone="slate" />
                ) : (
                  <Tag key={c.at} x={266} y={254} text={c.text} tone="slate" />
                ),
              )
            : null}
          {phase === 3 ? (
            <>
              <Tag x={200} y={254} text={verdicts.trunk} tone="amber" />
              <Tag x={420} y={254} text={verdicts.subline} tone="slate" />
            </>
          ) : null}
        </svg>
      </div>
      {phase === 4 ? (
        <div className="tp-domains">
          {domainOrder.map((d, i) => (
            <span key={d.name} className="tp-domain-item">
              {i > 0 ? <span className="tp-domain-arrow">→</span> : null}
              <Pill role={d.name === '存储' ? 'blue' : 'violet'} dot>
                {d.name} · {d.first}
              </Pill>
            </span>
          ))}
        </div>
      ) : null}
      <p className="tp-note">{(steps[phase] as { note: string }).note}</p>
    </div>
  );
}

export function TrunkPick(): JSX.Element {
  return (
    <Stepper steps={steps} interval={7000} label="取代与转向连成树，主干怎么挑">
      {(_step, index): JSX.Element => <Stage key={index} phase={index} />}
    </Stepper>
  );
}

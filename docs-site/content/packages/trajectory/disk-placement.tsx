'use client';
/**
 * DiskPlacement：一组卡怎么排到星轨盘上，五步——分类、关系与主干（时间轴示意）、日期折半径、
 * 扇区装箱、槽与同日斜排的落点。左边是盘或示意图（文字标签用 HTML 叠在 SVG 上，缩窄也看得清），
 * 右边是这一步的表格。数据都在 disk-placement.data.mjs。
 */
import type { JSX, ReactNode } from 'react';
import { Pane, Pill, Stepper } from '@godcreator/explainer/site';
import {
  boxRows,
  candidates,
  candidatesNote,
  crossGapLabel,
  dateTags,
  dayRings,
  disk,
  diskBoxes,
  dodgeLabel,
  edges,
  files,
  filesNote,
  foldBand,
  packingNotes,
  places,
  radiusNote,
  radiusRows,
  seamLabel,
  steps,
  timelineCards,
  timelineNote,
  timelineTicks,
  widenBand,
} from './disk-placement.data.mjs';
import type { DiskBox, Place, TimelineCard } from './disk-placement.data.mjs';
import './disk-placement.css';

const RAD = Math.PI / 180;
/** 极坐标转直角：0° 指 12 点、顺时针增（照 layout.ts 的 polar） */
const polar = (deg: number, r: number): { x: number; y: number } => ({ x: r * Math.sin(deg * RAD), y: -r * Math.cos(deg * RAD) });
const pctOf = (v: number): string => `${((v + disk.halfSpan) / (disk.halfSpan * 2)) * 100}%`;
const domainColor = (domain: string): string => (domain === '存储' ? 'blue' : 'violet');
const placeOf = new Map(places.map((p) => [p.mark, p]));
const tlOf = new Map(timelineCards.map((c) => [c.mark, c]));

/* ---------- 盘的骨架 ---------- */

function DiskStage({ svg, tags }: { svg: ReactNode; tags: ReactNode }): JSX.Element {
  const s = disk.halfSpan;
  return (
    <div className="dp-disk">
      <svg viewBox={`${-s} ${-s} ${s * 2} ${s * 2}`}>{svg}</svg>
      <div className="dp-disk-tags">{tags}</div>
    </div>
  );
}

function DiskTag({ x, y, kind, children }: { x: number; y: number; kind?: string; children: ReactNode }): JSX.Element {
  return (
    <span className={`dp-tag${kind ? ` dp-tag-${kind}` : ''}`} style={{ left: pctOf(x), top: pctOf(y) }}>
      {children}
    </span>
  );
}

/** 箭头 marker：取代金黄、转向青、说明灰。prefix 避开同页两个 SVG 的 id 冲突 */
function ArrowDefs({ prefix }: { prefix: string }): JSX.Element {
  return (
    <defs>
      {(['supersede', 'pivot', 'note'] as const).map((kind) => (
        <marker key={kind} id={`${prefix}-${kind}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4.6" markerHeight="4.6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" className={`dp-arrow dp-arrow-${kind}`} />
        </marker>
      ))}
    </defs>
  );
}

/** 两个角度之间的弧（虚线标缝用） */
function arcPath(th0: number, th1: number, r: number): string {
  const a = polar(th0, r);
  const b = polar(th1, r);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${th1 - th0 > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/** 扇环：一块地在盘上占的角度 × 半径范围 */
function Annulus({ box, faint }: { box: DiskBox; faint?: boolean }): JSX.Element {
  const large = box.th1 - box.th0 > 180 ? 1 : 0;
  const o0 = polar(box.th0, box.rMax);
  const o1 = polar(box.th1, box.rMax);
  const i1 = polar(box.th1, box.rMin);
  const i0 = polar(box.th0, box.rMin);
  return (
    <path
      className={`dp-annulus dp-annulus-${domainColor(box.domain)}${faint ? ' dp-annulus-faint' : ''}`}
      d={`M ${o0.x} ${o0.y} A ${box.rMax} ${box.rMax} 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${box.rMin} ${box.rMin} 0 ${large} 0 ${i0.x} ${i0.y} Z`}
    />
  );
}

/** 卡记号：圆；证据卡是尖朝外的三角形（照 node-dom.ts 证据卡的形状） */
function Mark({ card }: { card: Place }): JSX.Element {
  const p = polar(card.angle, card.radius);
  const cls = `dp-mark dp-mark-${domainColor(card.domain)}${card.superseded ? ' dp-mark-dead' : ''}`;
  if (card.evidence) {
    const t = disk.markRadius * 1.25;
    return (
      <path
        className={cls}
        d={`M0 ${-t} L${t * 0.866} ${t * 0.5} L${-t * 0.866} ${t * 0.5} Z`}
        transform={`translate(${p.x} ${p.y}) rotate(${card.angle})`}
      />
    );
  }
  return <circle cx={p.x} cy={p.y} r={disk.markRadius} className={cls} />;
}

/** 盘上关系线：直线连两张卡（示意），两端缩进记号，marker 指向写着这条关系的卡 */
function DiskEdge({ edge, prefix }: { edge: (typeof edges)[number]; prefix: string }): JSX.Element {
  const from = placeOf.get(edge.from) as Place;
  const to = placeOf.get(edge.to) as Place;
  const a = polar(from.angle, from.radius);
  const b = polar(to.angle, to.radius);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return (
    <line
      x1={a.x + ux * (disk.markRadius + 12)}
      y1={a.y + uy * (disk.markRadius + 12)}
      x2={b.x - ux * (disk.markRadius + 22)}
      y2={b.y - uy * (disk.markRadius + 22)}
      className={`dp-edge dp-edge-${edge.kind}`}
      markerEnd={`url(#${prefix}-${edge.kind})`}
    />
  );
}

/* ---------- 第 1 步：分类 ---------- */

const verdictPill: Record<string, { tone?: 'good' | 'bad'; role?: 'slate'; text: string }> = {
  center: { role: 'slate', text: '盘心' },
  card: { tone: 'good', text: '上盘' },
  sick: { tone: 'bad', text: '病卡：born-at 写坏了' },
};

function StepClassify(): JSX.Element {
  return (
    <div className="dp-stage">
      <DiskStage svg={<circle r={disk.hubRadius} className="dp-hub" />} tags={<DiskTag x={0} y={0}>{disk.hubLabel}</DiskTag>} />
      <Pane title="trajectory/ 下 11 个文件" icon="folder">
        <ul className="dp-files">
          {files.map((f) => {
            const v = verdictPill[f.verdict] as { tone?: 'good' | 'bad'; role?: 'slate'; text: string };
            return (
              <li key={f.mark} className="dp-file">
                <span className="dp-file-mark">{f.mark}</span>
                <span className="dp-file-name">{f.name}</span>
                {v.tone !== undefined ? (
                  <Pill tone={v.tone}>{v.text}</Pill>
                ) : (
                  <Pill role={v.role}>{v.text}</Pill>
                )}
              </li>
            );
          })}
        </ul>
        <p className="dp-note">{filesNote}</p>
      </Pane>
    </div>
  );
}

/* ---------- 第 2 步：时间轴示意 ---------- */

const TL = { width: 820, height: 270, x0: 280, span: 450, dayMax: 51, rows: { spine: 55, subline: 130, isolated: 205 }, axisY: 246 };
const tlX = (day: number): number => TL.x0 + (day / TL.dayMax) * TL.span;

function TlNode({ card }: { card: TimelineCard }): JSX.Element {
  const x = tlX(card.day) + (card.dx ?? 0);
  const y = TL.rows[card.row];
  const cls = `dp-tl-node dp-tl-node-${card.row === 'isolated' ? 'violet' : 'blue'}${card.superseded ? ' dp-mark-dead' : ''}`;
  if (card.evidence) {
    const t = 13 * 1.25;
    return <path className={cls} d={`M0 ${-t} L${t * 0.866} ${t * 0.5} L${-t * 0.866} ${t * 0.5} Z`} transform={`translate(${x} ${y})`} />;
  }
  return <circle cx={x} cy={y} r={13} className={cls} />;
}

function StepRelate(): JSX.Element {
  return (
    <div className="dp-stage">
      <div className="dp-timeline">
        <svg viewBox={`0 0 ${TL.width} ${TL.height}`}>
          <ArrowDefs prefix="dp-tl-arrow" />
          <line x1={12} y1={92} x2={808} y2={92} className="dp-tl-rule" />
          <line x1={12} y1={167} x2={808} y2={167} className="dp-tl-rule" />
          <line x1={TL.x0} y1={TL.axisY} x2={730} y2={TL.axisY} className="dp-tl-axis" />
          {timelineTicks.map((t) => (
            <g key={t.label}>
              <line x1={tlX(t.day)} y1={TL.axisY - 5} x2={tlX(t.day)} y2={TL.axisY + 5} className="dp-tl-axis" />
              <text x={tlX(t.day)} y={TL.axisY + 26} className="dp-tl-tick" textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}
          <text x={0} y={62} className="dp-tl-row">主干</text>
          <text x={0} y={137} className="dp-tl-row">支线</text>
          <text x={0} y={212} className="dp-tl-row">孤星：一条关系都没有</text>
          <text x={TL.width} y={18} className="dp-tl-note" textAnchor="end">{timelineNote}</text>
          {edges.map((e) => {
            const a = tlOf.get(e.from) as TimelineCard;
            const b = tlOf.get(e.to) as TimelineCard;
            const ax = tlX(a.day) + (a.dx ?? 0);
            const bx = tlX(b.day) + (b.dx ?? 0);
            const ay = TL.rows[a.row];
            const by = TL.rows[b.row];
            const len = Math.hypot(bx - ax, by - ay);
            const ux = (bx - ax) / len;
            const uy = (by - ay) / len;
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={ax + ux * 17}
                y1={ay + uy * 17}
                x2={bx - ux * 24}
                y2={by - uy * 24}
                className={`dp-edge dp-edge-${e.kind} dp-tl-edge`}
                markerEnd={`url(#dp-tl-arrow-${e.kind})`}
              />
            );
          })}
          {timelineCards.filter((c) => c.onSpine).map((c) => (
            <circle key={`ring-${c.mark}`} cx={tlX(c.day) + (c.dx ?? 0)} cy={TL.rows[c.row]} r={17} className="dp-tl-chosen-ring" />
          ))}
          {timelineCards.map((c) => (
            <TlNode key={c.mark} card={c} />
          ))}
          {timelineCards.map((c) => (
            <text
              key={`label-${c.mark}`}
              x={tlX(c.day) + (c.dx ?? 0)}
              y={TL.rows[c.row] - 21}
              className={`dp-tl-mark${c.superseded ? ' dp-tl-mark-dead' : ''}`}
              textAnchor="middle"
            >
              {c.mark}
            </text>
          ))}
        </svg>
      </div>
      <Pane title="主干怎么挑" icon="git">
        <div className="dp-candidates">
          {candidates.map((c) => (
            <Pill key={c.text} tone={c.tone} dot={c.dot}>{c.text}</Pill>
          ))}
        </div>
        <p className="dp-note">{candidatesNote}</p>
      </Pane>
    </div>
  );
}

/* ---------- 第 3 步：日期 → 半径 ---------- */

function StepRadius(): JSX.Element {
  const foldMid = polar(90, (foldBand.from + foldBand.to) / 2);
  const widenMid = polar(180, (widenBand.from + widenBand.to) / 2);
  return (
    <div className="dp-stage">
      <DiskStage
        svg={
          <>
            <circle r={disk.hubRadius} className="dp-hub" />
            <circle r={(foldBand.from + foldBand.to) / 2} strokeWidth={foldBand.to - foldBand.from} className="dp-band dp-band-fold" />
            <circle r={(widenBand.from + widenBand.to) / 2} strokeWidth={widenBand.to - widenBand.from} className="dp-band dp-band-widen" />
            {dayRings.map((ring) => (
              <circle key={ring.date} r={ring.r} className="dp-ring" />
            ))}
            {dateTags.map((t) => (
              <line key={t.date} x1={0} y1={-t.r} x2={0} y2={-(t.r + 24)} className="dp-tick" />
            ))}
          </>
        }
        tags={
          <>
            <DiskTag x={0} y={0}>{disk.hubLabel}</DiskTag>
            {dateTags.map((t) => (
              <DiskTag key={t.date} x={0} y={-(t.r + 44)} kind="date">
                {t.date}
              </DiskTag>
            ))}
            <DiskTag x={foldMid.x} y={foldMid.y} kind="note">{foldBand.label}</DiskTag>
            <DiskTag x={widenMid.x} y={widenMid.y} kind="note">{widenBand.label}</DiskTag>
          </>
        }
      />
      <Pane title="有效天数与半径">
        <div className="dp-table-wrap">
          <table className="dp-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>有效天数</th>
                <th>半径</th>
              </tr>
            </thead>
            <tbody>
              {radiusRows.map((row) => (
                <tr key={row.date}>
                  <td className="dp-num">{row.date}</td>
                  <td className="dp-num">{row.eff}</td>
                  <td className="dp-num">{row.r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dp-note">{radiusNote}</p>
      </Pane>
    </div>
  );
}

/* ---------- 第 4 步：扇区 ---------- */

function StepSector(): JSX.Element {
  const crossGapPos = polar(198.87, 680);
  return (
    <div className="dp-stage">
      <DiskStage
        svg={
          <>
            <circle r={disk.hubRadius} className="dp-hub dp-hub-dim" />
            {diskBoxes.map((b) => (
              <Annulus key={b.name} box={b} />
            ))}
            <path d={arcPath(319.09, 400.91, 1155)} className="dp-seam-arc" />
          </>
        }
        tags={
          <>
            <DiskTag x={0} y={-1010} kind="note">{seamLabel}</DiskTag>
            <DiskTag x={crossGapPos.x} y={crossGapPos.y} kind="note">{crossGapLabel}</DiskTag>
          </>
        }
      />
      <Pane title="装箱">
        <div className="dp-table-wrap">
          <table className="dp-table">
            <thead>
              <tr>
                <th>块</th>
                <th>领域</th>
                <th>半径范围</th>
                <th>槽数</th>
                <th>几何平均半径</th>
                <th>槽宽</th>
                <th>内边距</th>
                <th>需要的角宽</th>
              </tr>
            </thead>
            <tbody>
              {boxRows.map((row) => (
                <tr key={row.block}>
                  <td>{row.block}</td>
                  <td>{row.domain}</td>
                  <td className="dp-num">{row.span}</td>
                  <td className="dp-num">{row.slots}</td>
                  <td className="dp-num">{row.meanR.toFixed(2)}</td>
                  <td className="dp-num">{row.slotDeg}</td>
                  <td className="dp-num">{row.padDeg}</td>
                  <td className="dp-num">{row.width}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {packingNotes.map((note) => (
          <p key={note} className="dp-note">
            {note}
          </p>
        ))}
      </Pane>
    </div>
  );
}

/* ---------- 第 5 步：落点 ---------- */

/** ⑧ 的标注与内退箭头放 12 点缝里：缝是两块之间唯一的大空档 */
const DODGE_NOTE_POS = polar(-25, 800);

function StepPlace(): JSX.Element {
  const card8 = placeOf.get('⑧') as Place;
  const dodgeFrom = polar(card8.angle, card8.radius - 23);
  const dodgeTo = polar(card8.angle, card8.radius - 71);
  return (
    <div className="dp-stage">
      <DiskStage
        svg={
          <>
            <ArrowDefs prefix="dp-disk-arrow" />
            <circle r={disk.hubRadius} className="dp-hub" />
            {diskBoxes.map((b) => (
              <Annulus key={b.name} box={b} faint />
            ))}
            {dayRings.map((ring) => (
              <circle key={ring.date} r={ring.r} className="dp-ring" />
            ))}
            {dateTags.map((t) => (
              <line key={t.date} x1={0} y1={-t.r} x2={0} y2={-(t.r + 24)} className="dp-tick" />
            ))}
            {edges.map((e) => (
              <DiskEdge key={`${e.from}-${e.to}`} edge={e} prefix="dp-disk-arrow" />
            ))}
            {places.map((p) => (
              <Mark key={p.mark} card={p} />
            ))}
            <line x1={dodgeFrom.x} y1={dodgeFrom.y} x2={dodgeTo.x} y2={dodgeTo.y} className="dp-edge dp-edge-note" markerEnd="url(#dp-disk-arrow-note)" />
          </>
        }
        tags={
          <>
            <DiskTag x={0} y={-45}>{disk.hubLabel}</DiskTag>
            {dateTags.map((t) => (
              <DiskTag key={t.date} x={0} y={-(t.r + 44)} kind="date">
                {t.date}
              </DiskTag>
            ))}
            {places.map((p) => {
              const t = polar(p.labelAngle, p.labelR);
              return (
                <DiskTag key={p.mark} x={t.x} y={t.y} kind="card">
                  {p.mark}
                </DiskTag>
              );
            })}
            <DiskTag x={DODGE_NOTE_POS.x} y={DODGE_NOTE_POS.y} kind="note">
              {dodgeLabel}
            </DiskTag>
          </>
        }
      />
      <Pane title="每张卡的落点">
        <div className="dp-table-wrap">
          <table className="dp-table">
            <thead>
              <tr>
                <th>卡</th>
                <th>槽</th>
                <th>角度</th>
                <th>半径</th>
              </tr>
            </thead>
            <tbody>
              {places.map((p) => (
                <tr key={p.mark} title={p.note === '' ? undefined : p.note}>
                  <td>{p.mark}</td>
                  <td>{p.slot}</td>
                  <td className="dp-num">{p.angle.toFixed(2)}°</td>
                  <td className="dp-num">{p.radius.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>
    </div>
  );
}

/* ---------- 外壳 ---------- */

export function DiskPlacement(): JSX.Element {
  return (
    <Stepper steps={steps} interval={6000} label="一组卡怎么排到星轨盘上">
      {(_step, index): JSX.Element => [<StepClassify key="0" />, <StepRelate key="1" />, <StepRadius key="2" />, <StepSector key="3" />, <StepPlace key="4" />][index]}
    </Stepper>
  );
}

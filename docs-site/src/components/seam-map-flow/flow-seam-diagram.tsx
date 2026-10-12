'use client';
/**
 * 数据流接缝图：在讲解组件包 SeamDiagram 的画法上，线表示「谁把什么交给谁」——线带方向箭头，线旁写送的是什么；
 * 可以替换的地方画成框边的半圆缺口（写一个字母），下面挂着能接上的实现，实现框边鼓出同字母的半圆凸起，
 * 已经写好的实现连实线，还没有、以后可以接的连虚线；具体接哪个由设置选。凸起、缺口的弧线跟所在的框同色，字母写在半圆里。
 * 框、能力方块、编号、入口、浮层与 SeamDiagram 一样：停着浮出说明，点击固定高亮。
 * 送什么、箭头朝哪、可替换的接口与它的实现写在布局表里（先在本站做原型，定下来以后并进 @godcreator/docsite-explainer）。
 */
import { useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent, ReactNode } from 'react';
import { Pill } from '@godcreator/docsite-explainer';
import type { Box, Icon } from '@godcreator/docsite-explainer';
import type { Seam, SeamGraph, SeamModule } from '@godcreator/docsite-explainer/seam-graph';

export type Side = 'top' | 'bottom';

/** 一条接缝怎么画：路径按送东西的方向走，arrows 是箭头画在哪头；payload 是线旁写的送什么 */
export interface FlowSeamPath {
  d: string;
  badge: [number, number];
  arrows: 'end' | 'both';
  payload?: { text: string; at: [number, number] };
}

/** 一个可以替换的接口：开在哪个模块框的哪条边，能接上的实现各在哪个框的哪条边；active 是已经写好的实现，false 是以后可以接的 */
export interface ReplaceablePort {
  letter: string;
  name: string;
  text: string;
  module: string;
  side: Side;
  at: number;
  payload: { text: string; at: [number, number] };
  adapters: { module: string; side: Side; at: number; active: boolean }[];
}

/**
 * 格式约定：一个模块不送东西，但定了几条线上送的东西长什么样（比如数据模型包定了推给站点的数据与记录文件的格式）。
 * 画成从它引出的淡点线，连到那几条接缝的编号或可替换接口送的东西上；seams、ports 是连到的接缝编号与接口字母
 */
export interface FormatContract {
  module: string;
  seams: string[];
  ports: string[];
  paths: string[];
  /** 点线接到一条线上的地方画一个实心点 */
  dots: [number, number][];
  labels: { text: string; at: [number, number] }[];
}

/** 一张数据流接缝图的坐标与图标。键都是图里的 id，缺一个画到它时报错 */
export interface FlowSeamLayout {
  view: { w: number; h: number };
  caps: Record<string, Box>;
  /** 模块外框；只有一个能力、名字也相同的框外模块写 null，不画外框 */
  groups: Record<string, Box | null>;
  seamPaths: Record<string, FlowSeamPath>;
  ports: ReplaceablePort[];
  contracts: FormatContract[];
  /** 画在框后面的浅底与标签，把几个框圈成一组（比如同一个项目文件夹里的仓），不是模块；vertical 时标签竖着写在左边沿里，线从上面穿进来也不压字 */
  regions: { box: Box; label: string; vertical?: boolean }[];
  entries: Record<string, { box: Box; arrow: [number, number, number, number] }>;
  moduleIcons: Record<string, Icon>;
  entryIcons: Record<string, Icon>;
}

const PORT_R = 13;
const CORNER = 12;
/** 半圆的弧线两端各多画这么长的直边接回框线：框是虚线时，弧的两头不会落进虚线的空白里 */
const SHOULDER = 7;
/** 字母写在半圆里：中心离框边这么远 */
const LETTER_INSET = 6;
/** 连到凸起的线停在圆顶上方这么远，箭头不顶着半圆 */
const ARROW_GAP = 6;

function layoutOf<T>(table: Record<string, T>, id: string, what: string): T {
  if (!(id in table)) throw new Error(`接缝图的布局表里没有${what}「${id}」：图的数据加了东西，布局表要跟着加`);
  return table[id]!;
}

/** 11.5 号字大概多宽：中文按全角，字母数字与符号按半角 */
const textWidth = (s: string) => [...s].reduce((w, ch) => w + (/[\u0000-ÿ]/.test(ch) ? 6.6 : 11.5), 0);

const outwardOf = (side: Side) => (side === 'top' ? -1 : 1);
const edgeYOf = (frame: Box, side: Side) => (side === 'top' ? frame.y : frame.y + frame.h);

type EdgeFeature = { side: Side; at: number; kind: 'knob' | 'notch' };

/** 模块框：圆角矩形；凸起往框外鼓，缺口往框里凹 */
function framePath(box: Box, features: EdgeFeature[]): string {
  const { x, y, w, h } = box;
  const b = y + h;
  const along = (side: Side, dir: 1 | -1) =>
    features
      .filter((f) => f.side === side)
      .sort((p, q) => dir * (p.at - q.at))
      .map((f) => {
        const bulge = (f.kind === 'knob' ? 1 : -1) * outwardOf(side);
        const sweep = (dir === 1) === (bulge === -1) ? 1 : 0;
        const [from, to] = dir === 1 ? [f.at - PORT_R, f.at + PORT_R] : [f.at + PORT_R, f.at - PORT_R];
        const edge = side === 'top' ? y : b;
        return `L${from},${edge} A${PORT_R},${PORT_R} 0 0 ${sweep} ${to},${edge} `;
      })
      .join('');
  return (
    `M${x + CORNER},${y} ${along('top', 1)}L${x + w - CORNER},${y} Q${x + w},${y} ${x + w},${y + CORNER} ` +
    `L${x + w},${b - CORNER} Q${x + w},${b} ${x + w - CORNER},${b} ${along('bottom', -1)}` +
    `L${x + CORNER},${b} Q${x},${b} ${x},${b - CORNER} L${x},${y + CORNER} Q${x},${y} ${x + CORNER},${y} Z`
  );
}

/** 半圆朝 dir（-1 上、1 下）：rim 是弧线加两端的直边，disc 是闭合的半圆块（凸起填色、接鼠标） */
function rimPath(at: number, y: number, dir: -1 | 1): string {
  const sweep = dir === -1 ? 1 : 0;
  return `M${at - PORT_R - SHOULDER},${y} H${at - PORT_R} A${PORT_R},${PORT_R} 0 0 ${sweep} ${at + PORT_R},${y} H${at + PORT_R + SHOULDER}`;
}
function discPath(at: number, y: number, dir: -1 | 1): string {
  const sweep = dir === -1 ? 1 : 0;
  return `M${at - PORT_R},${y} A${PORT_R},${PORT_R} 0 0 ${sweep} ${at + PORT_R},${y} Z`;
}

type Target = { kind: 'seam' | 'module'; id: string } | { kind: 'port'; letter: string };
interface Pointing {
  point: (target: Target | null) => void;
  pin: (target: Target) => void;
}
const keyOf = (t: Target) => (t.kind === 'port' ? `port:${t.letter}` : `${t.kind}:${t.id}`);
const sameTarget = (p: Target | null, q: Target): boolean => p !== null && keyOf(p) === keyOf(q);

function pointable(label: string, target: Target, pinned: boolean, { point, pin }: Pointing) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-pressed': pinned,
    onMouseEnter: () => point(target),
    onMouseLeave: () => point(null),
    onFocus: () => point(target),
    onBlur: () => point(null),
    onClick: () => pin(target),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      pin(target);
    },
  };
}

/** 落在这个模块框边上的缺口（它开的可替换接口）与凸起（它是某个接口的实现） */
function edgeMarksOf(layout: FlowSeamLayout, moduleId: string) {
  const notches = layout.ports.filter((p) => p.module === moduleId);
  const knobs = layout.ports.flatMap((p) => p.adapters.filter((a) => a.module === moduleId).map((a) => ({ port: p, adapter: a })));
  return { notches, knobs };
}

function Payload({ text, at }: { text: string; at: [number, number] }) {
  const w = textWidth(text) + 10;
  return (
    <g className="sf-payload">
      <rect x={at[0] - w / 2} y={at[1] - 12} width={w} height={16} rx={4} />
      <text x={at[0]} y={at[1]} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function ModuleGroup({
  graph,
  layout,
  module,
  focused,
  litCaps,
  litPorts,
  pinned,
  pointing,
}: {
  graph: SeamGraph;
  layout: FlowSeamLayout;
  module: SeamModule;
  focused: boolean;
  litCaps: Set<string> | null;
  litPorts: Set<string> | null;
  pinned: Target | null;
  pointing: Pointing;
}) {
  const frame = layoutOf(layout.groups, module.id, '模块');
  const FrameIcon = layoutOf(layout.moduleIcons, module.id, '模块图标');
  const { notches, knobs } = edgeMarksOf(layout, module.id);
  const portOn = (letter: string) => (litPorts === null ? undefined : litPorts.has(letter));
  const portTarget = (letter: string): Target => ({ kind: 'port', letter });
  const isAdapter = knobs.length > 0 && module.caps.length === 0;
  const dashed = isAdapter && knobs.every((k) => !k.adapter.active);
  return (
    <g className="sm-module" data-role={module.role ?? 'slate'} data-outside={module.outside} data-focus={focused} data-standby={dashed || undefined}>
      {frame === null ? null : (
        <>
          <path
            className="sm-frame"
            d={framePath(frame, [...notches.map((p) => ({ side: p.side, at: p.at, kind: 'notch' as const })), ...knobs.map((k) => ({ side: k.adapter.side, at: k.adapter.at, kind: 'knob' as const }))])}
            {...pointable(`模块 ${module.name}`, { kind: 'module', id: module.id }, focused, pointing)}
          />
          {isAdapter ? (
            <>
              <text className="sf-adapter-name" x={frame.x + frame.w / 2} y={frame.y + frame.h / 2 + 1} textAnchor="middle">
                {module.name}
              </text>
              <text className="sm-frame-pkg" x={frame.x + frame.w / 2} y={frame.y + frame.h / 2 + 18} textAnchor="middle">
                {module.pkg}
              </text>
            </>
          ) : (
            <>
              <FrameIcon className="sm-icon" x={frame.x + 10} y={frame.y + 7} width={14} height={14} strokeWidth={2} />
              <text x={frame.x + 30} y={frame.y + 18}>
                <tspan className="sm-frame-name">{module.name}</tspan>
                <tspan className="sm-frame-pkg" dx={8}>
                  {module.pkg}
                </tspan>
              </text>
            </>
          )}
        </>
      )}
      {module.caps.map((c) => {
        const box = layoutOf(layout.caps, c.id, '能力');
        const lit = litCaps === null ? undefined : litCaps.has(c.id);
        const cx = box.x + box.w / 2;
        // 没有外框的模块只有这一块能力方块，停在它上面看模块说明
        const asModule = frame === null ? pointable(`模块 ${module.name}`, { kind: 'module', id: module.id }, focused, pointing) : {};
        return (
          <g key={c.id} className="sm-cap" data-lit={lit} {...asModule}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} />
            <text className="sm-cap-name" x={cx} y={box.y + 20} textAnchor="middle">
              {c.name}
            </text>
            <text className="sm-cap-ident" x={cx} y={box.y + 37} textAnchor="middle">
              {c.ident}
            </text>
          </g>
        );
      })}
      {frame === null
        ? null
        : notches.map((p) => {
            const y = edgeYOf(frame, p.side);
            const inward = -outwardOf(p.side) as -1 | 1;
            return (
              <g key={`n-${p.letter}`} className="sf-port" data-kind="notch" data-on={portOn(p.letter)} {...pointable(`可替换的接口 ${p.letter} ${p.name}`, portTarget(p.letter), sameTarget(pinned, portTarget(p.letter)), pointing)}>
                <path className="sf-disc" d={discPath(p.at, y, inward)} />
                <path className="sf-rim" d={rimPath(p.at, y, inward)} />
                <text className="sf-letter" x={p.at} y={y + inward * LETTER_INSET} textAnchor="middle" dominantBaseline="central">
                  {p.letter}
                </text>
                <text className="sf-port-name" x={p.at} y={y + inward * (PORT_R + 10)} textAnchor="middle">
                  {p.name}
                </text>
              </g>
            );
          })}
      {frame === null
        ? null
        : knobs.map(({ port, adapter }) => {
            const y = edgeYOf(frame, adapter.side);
            const outward = outwardOf(adapter.side) as -1 | 1;
            const owner = graph.modules.find((m) => m.id === port.module)!;
            return (
              <g key={`k-${port.letter}`} className="sf-port" data-kind="knob" data-active={adapter.active} data-on={portOn(port.letter)} {...pointable(`接口 ${port.letter} 的实现 ${module.name}`, portTarget(port.letter), sameTarget(pinned, portTarget(port.letter)), pointing)}>
                <path className="sf-disc" d={discPath(adapter.at, y, outward)} />
                <path className="sf-rim" d={rimPath(adapter.at, y, outward)} />
                <text className="sf-letter" data-role={owner.role ?? 'slate'} x={adapter.at} y={y + outward * LETTER_INSET} textAnchor="middle" dominantBaseline="central">
                  {port.letter}
                </text>
              </g>
            );
          })}
    </g>
  );
}

function SeamWire({ layout, seam, on, pinned, pointing }: { layout: FlowSeamLayout; seam: Seam; on: boolean | undefined; pinned: boolean; pointing: Pointing }) {
  const { d, badge, arrows, payload } = layoutOf(layout.seamPaths, seam.id, '接缝');
  const [bx, by] = badge;
  return (
    <g className="sm-seam" data-on={on} data-via={seam.via}>
      <path d={d} markerEnd="url(#sf-arrow)" markerStart={arrows === 'both' ? 'url(#sf-arrow)' : undefined} />
      {payload === undefined ? null : <Payload text={payload.text} at={payload.at} />}
      <g className="sm-badge" {...pointable(`接缝 ${seam.label}`, { kind: 'seam', id: seam.id }, pinned, pointing)}>
        <circle className="sm-badge-hit" cx={bx} cy={by} r={13} />
        <circle className="sm-badge-ring" cx={bx} cy={by} r={9.5} />
        <text x={bx} y={by} textAnchor="middle" dominantBaseline="central">
          {seam.n}
        </text>
      </g>
    </g>
  );
}

/** 一个可替换接口的线：从缺口的开口连到每个实现的凸起，已有的实线、以后可以接的虚线 */
function PortWires({ layout, port, on }: { layout: FlowSeamLayout; port: ReplaceablePort; on: boolean | undefined }) {
  const from = layoutOf(layout.groups, port.module, '模块')!;
  const y0 = edgeYOf(from, port.side);
  const out0 = outwardOf(port.side);
  return (
    <g className="sf-port-wires" data-on={on}>
      {port.adapters.map((a) => {
        const frame = layoutOf(layout.groups, a.module, '模块')!;
        const out1 = outwardOf(a.side);
        const y1 = edgeYOf(frame, a.side) + out1 * (PORT_R + ARROW_GAP);
        const reach = Math.max(30, Math.abs(y1 - y0) / 2);
        return (
          <path
            key={a.module}
            className="sf-port-wire"
            data-active={a.active}
            d={`M${port.at},${y0} C${port.at},${y0 + out0 * reach} ${a.at},${y1 + out1 * reach} ${a.at},${y1}`}
            markerEnd="url(#sf-arrow)"
          />
        );
      })}
      <Payload text={port.payload.text} at={port.payload.at} />
    </g>
  );
}

function EntryArrow({ layout, id, name }: { layout: FlowSeamLayout; id: string; name: string }) {
  const { box, arrow } = layoutOf(layout.entries, id, '入口');
  const [x1, y1, x2, y2] = arrow;
  const EntryIcon = layoutOf(layout.entryIcons, id, '入口图标');
  return (
    <g className="sm-entry">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.h / 2} />
      <EntryIcon className="sm-icon" x={box.x + 12} y={box.y + box.h / 2 - 7} width={14} height={14} strokeWidth={1.8} />
      <text x={box.x + box.w / 2 + 9} y={box.y + box.h / 2} textAnchor="middle" dominantBaseline="central">
        {name}
      </text>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={`${x2},${y2} ${x2 - 4},${y2 - 7} ${x2 + 4},${y2 - 7}`} />
    </g>
  );
}

function Legend({ graph, hasPorts, hasContracts }: { graph: SeamGraph; hasPorts: boolean; hasContracts: boolean }) {
  const item = (mark: ReactNode, text: string) => (
    <span className="sm-legend-item">
      <svg width="30" height="16" aria-hidden="true">
        {mark}
      </svg>
      {text}
    </span>
  );
  return (
    <div className="sm-legend">
      {item(<rect x="2" y="2" width="26" height="12" rx="3" className="sm-lg-frame" />, graph.frameLabel)}
      {item(<rect x="4" y="3" width="22" height="10" rx="2" className="sm-lg-cap" />, '能力')}
      {item(
        <>
          <line x1="2" y1="8" x2="24" y2="8" className="sm-lg-code" />
          <path d="M23,4 L29,8 L23,12 z" className="sf-lg-head" />
        </>,
        '送过去的东西（线旁写着）',
      )}
      {item(<line x1="2" y1="8" x2="28" y2="8" className="sm-lg-disk" />, '读写磁盘上的文件')}
      {hasPorts ? item(<path d="M1,3 H9 A6,6 0 0 0 21,3 H29" className="sf-lg-notch" />, '可替换的接口（缺口）') : null}
      {hasPorts ? item(<path d="M1,14 H9 A6,6 0 0 1 21,14 H29" className="sf-lg-knob" />, '能接上的实现（凸起），实线是已有的、虚线是以后可以接的') : null}
      {hasContracts ? item(<line x1="2" y1="8" x2="28" y2="8" className="sf-lg-contract" />, '格式约定：谁定了这条线上送的东西长什么样') : null}
      <span className="sm-legend-hint">鼠标停在编号、字母或模块框上看说明，点击固定高亮</span>
    </div>
  );
}

function ModuleIcon({ layout, moduleId }: { layout: FlowSeamLayout; moduleId: string }) {
  const Glyph = layoutOf(layout.moduleIcons, moduleId, '模块图标');
  return <Glyph className="sm-inline-icon" width={13} height={13} strokeWidth={2} aria-hidden="true" />;
}

function SeamTip({ graph, layout, seam }: { graph: SeamGraph; layout: FlowSeamLayout; seam: Seam }) {
  const { arrows, payload } = layoutOf(layout.seamPaths, seam.id, '接缝');
  const end = (ids: string[]) =>
    ids.map((id) => {
      const owner = graph.moduleOfCap.get(id)!;
      return (
        <Pill key={id} role={owner.role ?? 'slate'}>
          <ModuleIcon layout={layout} moduleId={owner.id} />
          {graph.capById.get(id)!.name}
        </Pill>
      );
    });
  return (
    <>
      <div className="sm-tip-head">
        <b>{seam.label}</b>
        {payload === undefined ? null : <Pill tone="info">送：{payload.text}</Pill>}
      </div>
      <div className="sm-ends">
        {end(seam.a)}
        <span className="sm-arrow" aria-hidden="true">
          {arrows === 'both' ? '↔' : '→'}
        </span>
        {end(seam.b)}
      </div>
      <p className="sm-tip-text">{seam.text}</p>
      <code className="sm-iface">{seam.iface}</code>
    </>
  );
}

function PortTip({ graph, layout, port }: { graph: SeamGraph; layout: FlowSeamLayout; port: ReplaceablePort }) {
  const owner = graph.modules.find((m) => m.id === port.module)!;
  return (
    <>
      <div className="sm-tip-head">
        <b>
          {port.letter} · {port.name}
        </b>
        <Pill tone="info">送：{port.payload.text}</Pill>
      </div>
      <div className="sm-ends">
        <Pill role={owner.role ?? 'slate'}>
          <ModuleIcon layout={layout} moduleId={owner.id} />
          {owner.name}
        </Pill>
        <span className="sm-arrow" aria-hidden="true">
          →
        </span>
        {port.adapters.map((a) => {
          const m = graph.modules.find((each) => each.id === a.module)!;
          return (
            <Pill key={a.module} tone={a.active ? 'good' : 'pending'}>
              {m.name}
              {a.active ? '（已有）' : '（以后接）'}
            </Pill>
          );
        })}
      </div>
      <p className="sm-tip-text">{port.text}</p>
    </>
  );
}

function ModuleTip({ graph, layout, module }: { graph: SeamGraph; layout: FlowSeamLayout; module: SeamModule }) {
  const related = graph.seamsOfModule(module.id);
  const contract = layout.contracts.find((c) => c.module === module.id);
  const defines = contract === undefined ? [] : [...contract.seams.map((id) => graph.seams.find((s) => s.id === id)!.label), ...contract.ports.map((letter) => `${letter} ${layout.ports.find((p) => p.letter === letter)!.payload.text}`)];
  return (
    <>
      <div className="sm-tip-head" data-role={module.role ?? 'slate'}>
        <b className="sm-module-name">
          <ModuleIcon layout={layout} moduleId={module.id} />
          {module.name}
        </b>
        <code className="sm-module-pkg">{module.pkg}</code>
      </div>
      <p className="sm-tip-text">{module.blurb}</p>
      {related.length === 0 ? null : <p className="sm-related">相关接缝：{related.map((s) => s.label).join(' · ')}</p>}
      {defines.length === 0 ? null : <p className="sm-related">定了格式：{defines.join(' · ')}</p>}
    </>
  );
}

/** 格式约定的点线：从定格式的模块连到它定的那几条线；点这个模块时一起高亮 */
function ContractLines({ graph, contract, on }: { graph: SeamGraph; contract: FormatContract; on: boolean | undefined }) {
  const owner = graph.modules.find((m) => m.id === contract.module)!;
  return (
    <g className="sf-contract" data-role={owner.role ?? 'slate'} data-on={on}>
      {contract.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {contract.dots.map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} className="sf-contract-dot" cx={cx} cy={cy} r={3.5} />
      ))}
      {contract.labels.map((l) => (
        <g key={`${l.text}-${l.at.join(',')}`} className="sf-contract-label">
          <rect x={l.at[0] - textWidth(l.text) / 2 - 4} y={l.at[1] - 11} width={textWidth(l.text) + 8} height={15} rx={4} />
          <text x={l.at[0]} y={l.at[1]} textAnchor="middle">
            {l.text}
          </text>
        </g>
      ))}
    </g>
  );
}

/** 浮层：上半张图的东西放在它下面，下半张的放在上面；横向按比例平移，不伸出图外 */
function Tip({ graph, layout, target }: { graph: SeamGraph; layout: FlowSeamLayout; target: Target }) {
  let x: number;
  let top: number;
  let bottom: number;
  let content: ReactNode;
  if (target.kind === 'seam') {
    const [bx, by] = layoutOf(layout.seamPaths, target.id, '接缝').badge;
    [x, top, bottom] = [bx, by - 12, by + 12];
    content = <SeamTip graph={graph} layout={layout} seam={graph.seams.find((s) => s.id === target.id)!} />;
  } else if (target.kind === 'port') {
    const port = layout.ports.find((p) => p.letter === target.letter)!;
    const y = edgeYOf(layoutOf(layout.groups, port.module, '模块')!, port.side);
    [x, top, bottom] = [port.at, y - PORT_R, y + PORT_R];
    content = <PortTip graph={graph} layout={layout} port={port} />;
  } else {
    const module = graph.modules.find((m) => m.id === target.id)!;
    const box = layoutOf(layout.groups, module.id, '模块') ?? layoutOf(layout.caps, module.caps[0]!.id, '能力');
    [x, top, bottom] = [box.x + box.w / 2, box.y, box.y + box.h];
    content = <ModuleTip graph={graph} layout={layout} module={module} />;
  }
  const below = (top + bottom) / 2 < layout.view.h / 2;
  const across = (x / layout.view.w) * 100;
  const style: CSSProperties = {
    left: `${across}%`,
    top: `${((below ? bottom : top) / layout.view.h) * 100}%`,
    transform: `translate(${-across}%, ${below ? '8px' : 'calc(-100% - 8px)'})`,
  };
  return (
    <div className="sm-tip" style={style} role="tooltip">
      {content}
    </div>
  );
}

export function FlowSeamDiagram({ graph, layout }: { graph: SeamGraph; layout: FlowSeamLayout }): JSX.Element {
  const [shown, setShown] = useState<Target | null>(null);
  const [pinned, setPinned] = useState<Target | null>(null);
  const pointing: Pointing = {
    point: setShown,
    pin: (target) => setPinned((current) => (sameTarget(current, target) ? null : target)),
  };

  const focused = pinned?.kind === 'module' ? graph.modules.find((m) => m.id === pinned.id)! : null;
  const seam = pinned?.kind === 'seam' ? graph.seams.find((s) => s.id === pinned.id)! : null;
  const port = pinned?.kind === 'port' ? pinned.letter : null;
  // 点的是定格式的模块时，它定的那几条线与接口也算在高亮里
  const focusedContract = focused === null ? undefined : layout.contracts.find((c) => c.module === focused.id);
  const contractSeams = focusedContract === undefined ? [] : focusedContract.seams.map((id) => graph.seams.find((s) => s.id === id)!);
  const activeSeams = focused !== null ? [...graph.seamsOfModule(focused.id), ...contractSeams] : seam !== null ? [seam] : [];
  const activeIds = new Set(activeSeams.map((s) => s.id));
  const litPorts = pinned === null ? null : new Set(port !== null ? [port] : (focusedContract?.ports ?? []));
  const litCaps = pinned === null || port !== null ? null : new Set(activeSeams.flatMap((s) => [...s.a, ...s.b]));
  if (focused !== null && litCaps !== null) for (const c of focused.caps) litCaps.add(c.id);
  const seamOn = (s: Seam) => (pinned === null ? undefined : activeIds.has(s.id));
  const drawOrder = [...graph.seams].sort((p, q) => Number(activeIds.has(p.id)) - Number(activeIds.has(q.id)));

  return (
    <div className="dx seam-map seam-map-flow not-prose">
      <Legend graph={graph} hasPorts={layout.ports.length > 0} hasContracts={layout.contracts.length > 0} />
      <div className="sm-scroll">
        <div className="sm-canvas">
          <svg className="sm-svg" viewBox={`0 0 ${layout.view.w} ${layout.view.h}`} role="group" aria-label={graph.title}>
            <defs>
              <marker id="sf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className="sf-arrowhead" />
              </marker>
            </defs>
            {layout.regions.map((r) => {
              const [lx, ly] = [r.box.x + 18, r.box.y + r.box.h / 2];
              return (
                <g key={r.label} className="sf-region">
                  <rect x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} rx={16} />
                  {r.vertical === true ? (
                    <text x={lx} y={ly} transform={`rotate(-90 ${lx} ${ly})`} textAnchor="middle">
                      {r.label}
                    </text>
                  ) : (
                    <text x={r.box.x + 12} y={r.box.y + 18}>
                      {r.label}
                    </text>
                  )}
                </g>
              );
            })}
            {graph.entries.map((e) => (
              <EntryArrow key={e.id} layout={layout} id={e.id} name={e.name} />
            ))}
            {layout.ports.map((p) => (
              <PortWires key={p.letter} layout={layout} port={p} on={litPorts === null ? undefined : litPorts.has(p.letter)} />
            ))}
            {layout.contracts.map((c) => (
              <ContractLines key={c.module} graph={graph} contract={c} on={pinned === null ? undefined : focused?.id === c.module} />
            ))}
            {graph.modules.map((m) => (
              <ModuleGroup
                key={m.id}
                graph={graph}
                layout={layout}
                module={m}
                focused={focused?.id === m.id}
                litCaps={litCaps}
                litPorts={litPorts}
                pinned={pinned}
                pointing={pointing}
              />
            ))}
            {drawOrder.map((s) => (
              <SeamWire key={s.id} layout={layout} seam={s} on={seamOn(s)} pinned={seam?.id === s.id} pointing={pointing} />
            ))}
          </svg>
          {shown === null ? null : <Tip graph={graph} layout={layout} target={shown} />}
        </div>
      </div>
    </div>
  );
}

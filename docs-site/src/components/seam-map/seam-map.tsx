'use client';
/**
 * 系统地图的接缝图：虚线框是模块（docfirst 的每个包与工作台插件，每个包一种角色色），框里的方块是能力，
 * 跨模块的线带编号，就是接缝；实线是代码调用，虚线是读写磁盘上的文件；框外是使用方的站、使用方的仓、fumadocs 本体与外面进来的入口。
 * 两件事互相独立：鼠标停在编号或模块框上（或键盘聚焦到它）浮出说明，挪开就收起；
 * 点击（或回车、空格）固定高亮关系——点编号高亮这条接缝和两端的能力，点模块框高亮跟它有关的接缝，再点一次取消。
 * 内容全在 seam-map.data.mjs，这里只有布局与交互；机读版由 seam-map.ai.mjs 读同一份数据生成。
 */
import { useState } from 'react';
import type { ComponentType, CSSProperties, KeyboardEvent, ReactNode, SVGProps } from 'react';
import { Pill } from '@godcreator/docs-explain';
import { Bot, FolderGit2, Globe, Hammer, Layers, Orbit, Pin, Plug, Puzzle, SquareTerminal, Workflow } from 'lucide-react';
import { capById, entries, moduleOfCap, modules, seams, seamsOfModule } from './seam-map.data.mjs';

type Seam = (typeof seams)[number];
type Module = (typeof modules)[number];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 画布的坐标范围，浮层位置按它换算成百分比 */
const VIEW_W = 1100;
const VIEW_H = 750;

const CAP_H = 48;
const cap = (x: number, y: number, w: number): Box => ({ x, y, w, h: CAP_H });

/** 能力方块的位置：按依赖方向从上往下，工作台插件与框外的东西在最上和最下两行 */
const CAP_BOX: Record<string, Box> = {
  'fumadocs-core': cap(180, 82, 180),
  skills: cap(394, 82, 110),
  create: cap(516, 82, 170),
  wiring: cap(734, 82, 332),

  remark: cap(194, 222, 137),
  markdown: cap(341, 222, 137),
  pre: cap(488, 222, 137),
  roster: cap(635, 222, 137),
  cardset: cap(782, 222, 137),
  'disk-server': cap(929, 222, 137),

  cli: cap(194, 372, 106),
  mdx: cap(310, 372, 106),
  project: cap(426, 372, 120),
  io: cap(556, 372, 120),
  placement: cap(686, 372, 100),
  'card-dir': cap(796, 372, 90),

  marker: cap(194, 522, 136),
  service: cap(340, 522, 130),
  compare: cap(550, 522, 96),

  model: cap(714, 522, 120),
  thumbs: cap(844, 522, 100),
  disk: cap(954, 522, 112),

  root: cap(400, 676, 240),
  source: cap(650, 676, 160),
  outputs: cap(830, 676, 236),
};

/** 模块的外框；只有一个能力、名字也相同的框外模块（fumadocs 本体）不画外框 */
const GROUP_BOX: Record<string, Box | null> = {
  plugin: { x: 380, y: 50, w: 320, h: 94 },
  'fumadocs-core': null,
  site: { x: 720, y: 50, w: 360, h: 94 },
  fumadocs: { x: 180, y: 190, w: 900, h: 94 },
  workflow: { x: 180, y: 340, w: 720, h: 94 },
  pin: { x: 180, y: 490, w: 480, h: 94 },
  trajectory: { x: 700, y: 490, w: 380, h: 94 },
  repo: { x: 180, y: 646, w: 900, h: 90 },
};

/**
 * 每条接缝的走线与编号圆点。线停在框边上（6、7、8）表示接这个包里的几处能力，是哪几处看高亮。
 * 5 的另两端（建模、缩略图）与 8 落在项目根的那一端没有单独画线，指到编号时照样高亮。
 */
const SEAM_PATH: Record<string, { d: string; badge: [number, number] }> = {
  '1': { d: 'M320,420 V522', badge: [320, 462] },
  '2': { d: 'M600,420 V522', badge: [600, 462] },
  '3': { d: 'M450,420 V522', badge: [450, 462] },
  '4': { d: 'M815,420 V522', badge: [815, 462] },
  '5': { d: 'M1030,270 V522', badge: [1030, 400] },
  '6': { d: 'M600,284 V340', badge: [600, 312] },
  '7': { d: 'M265,190 V130', badge: [265, 160] },
  '8': { d: 'M905,190 V130', badge: [905, 160] },
  '9': { d: 'M520,420 V676', badge: [520, 612] },
  '10': { d: 'M668,420 V676', badge: [668, 612] },
  '11': { d: 'M692,420 V626 H900 V676', badge: [800, 626] },
  '12': { d: 'M686,106 H734', badge: [710, 106] },
};

/** 外面进来的入口：外面的方块与指向入口的箭头（起点、终点） */
const ENTRY_LAYOUT: Record<string, { box: Box; arrow: [number, number, number, number] }> = {
  agent: { box: { x: 440, y: 6, w: 200, h: 26 }, arrow: [540, 32, 540, 50] },
  next: { box: { x: 20, y: 222, w: 130, h: 48 }, arrow: [150, 246, 194, 246] },
  human: { box: { x: 20, y: 372, w: 130, h: 48 }, arrow: [150, 396, 194, 396] },
};

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/** 入口与各模块的图标：只是外观，跟内容无关，所以放在画面这边而不是数据文件里 */
const ENTRY_ICON: Record<string, Icon> = { agent: Bot, next: Hammer, human: SquareTerminal };
const MODULE_ICON: Record<string, Icon> = {
  plugin: Puzzle,
  site: Globe,
  fumadocs: Plug,
  'fumadocs-core': Layers,
  workflow: Workflow,
  pin: Pin,
  trajectory: Orbit,
  repo: FolderGit2,
};

function layoutOf<T>(table: Record<string, T>, id: string, what: string): T {
  if (!(id in table)) throw new Error(`接缝图的布局表里没有${what}「${id}」：seam-map.data.mjs 加了东西，seam-map.tsx 的布局表要跟着加`);
  return table[id]!;
}

/** 浮层里跟在模块名前的小图标 */
function ModuleIcon({ moduleId }: { moduleId: string }) {
  const Glyph = layoutOf(MODULE_ICON, moduleId, '模块图标');
  return <Glyph className="sm-inline-icon" width={13} height={13} strokeWidth={2} aria-hidden="true" />;
}

/** 浮层指着的东西：一条接缝或一个模块 */
interface Target {
  kind: 'seam' | 'module';
  id: string;
}
/** point 管浮层（停着就显示），pin 管高亮（点一下固定、再点取消） */
interface Pointing {
  point: (target: Target | null) => void;
  pin: (target: Target) => void;
}

const sameTarget = (p: Target | null, q: Target): boolean => p !== null && p.kind === q.kind && p.id === q.id;

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

/** lit 为 undefined 表示什么都没指着：不高亮也不淡化 */
function CapBlock({ id, lit }: { id: string; lit: boolean | undefined }) {
  const box = layoutOf(CAP_BOX, id, '能力');
  const capability = capById.get(id)!;
  const cx = box.x + box.w / 2;
  return (
    <g className="sm-cap" data-lit={lit}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} />
      <text className="sm-cap-name" x={cx} y={box.y + 20} textAnchor="middle">
        {capability.name}
      </text>
      <text className="sm-cap-ident" x={cx} y={box.y + 37} textAnchor="middle">
        {capability.ident}
      </text>
    </g>
  );
}

function ModuleGroup({ module, focused, litCaps, pointing }: { module: Module; focused: boolean; litCaps: Set<string> | null; pointing: Pointing }) {
  const frame = layoutOf(GROUP_BOX, module.id, '模块');
  const FrameIcon = layoutOf(MODULE_ICON, module.id, '模块图标');
  return (
    <g
      className="sm-module"
      data-role={module.role ?? 'slate'}
      data-outside={module.outside}
      data-focus={focused}
      {...pointable(`模块 ${module.name}`, { kind: 'module', id: module.id }, focused, pointing)}
    >
      {frame === null ? null : (
        <>
          <rect className="sm-frame" x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={12} />
          <FrameIcon className="sm-icon" x={frame.x + 10} y={frame.y + 7} width={14} height={14} strokeWidth={2} />
          <text x={frame.x + 30} y={frame.y + 18}>
            <tspan className="sm-frame-name">{module.name}</tspan>
            <tspan className="sm-frame-pkg" dx={8}>
              {module.pkg}
            </tspan>
          </text>
        </>
      )}
      {module.caps.map((c) => (
        <CapBlock key={c.id} id={c.id} lit={litCaps === null ? undefined : litCaps.has(c.id)} />
      ))}
    </g>
  );
}

/** on 为 undefined 表示什么都没指着：不高亮也不淡化 */
function SeamLine({ seam, on, pinned, pointing }: { seam: Seam; on: boolean | undefined; pinned: boolean; pointing: Pointing }) {
  const { d, badge } = layoutOf(SEAM_PATH, seam.id, '接缝');
  const [bx, by] = badge;
  return (
    <g className="sm-seam" data-on={on} data-via={seam.via}>
      <path d={d} />
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

function Entry({ id, name }: { id: string; name: string }) {
  const { box, arrow } = layoutOf(ENTRY_LAYOUT, id, '入口');
  const [x1, y1, x2, y2] = arrow;
  const head = y1 === y2 ? `${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}` : `${x2},${y2} ${x2 - 4},${y2 - 7} ${x2 + 4},${y2 - 7}`;
  const EntryIcon = layoutOf(ENTRY_ICON, id, '入口图标');
  const cx = box.x + box.w / 2;
  // 高的入口块图标在上、字在下；矮的一行块图标在字左边
  const tall = box.h >= 40;
  return (
    <g className="sm-entry">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={tall ? 14 : box.h / 2} />
      {tall ? (
        <>
          <EntryIcon className="sm-icon" x={cx - 8} y={box.y + 7} width={16} height={16} strokeWidth={1.8} />
          <text x={cx} y={box.y + 35} textAnchor="middle" dominantBaseline="central">
            {name}
          </text>
        </>
      ) : (
        <>
          <EntryIcon className="sm-icon" x={box.x + 12} y={box.y + box.h / 2 - 7} width={14} height={14} strokeWidth={1.8} />
          <text x={cx + 9} y={box.y + box.h / 2} textAnchor="middle" dominantBaseline="central">
            {name}
          </text>
        </>
      )}
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={head} />
    </g>
  );
}

/** 图例：每种元素的意思，末尾一句怎么看说明 */
function Legend() {
  const item = (mark: ReactNode, text: string) => (
    <span className="sm-legend-item">
      <svg width="26" height="14" aria-hidden="true">
        {mark}
      </svg>
      {text}
    </span>
  );
  return (
    <div className="sm-legend">
      {item(<rect x="1" y="1" width="24" height="12" rx="3" className="sm-lg-frame" />, '模块（包）')}
      {item(<rect x="3" y="2" width="20" height="10" rx="2" className="sm-lg-cap" />, '能力')}
      {item(<line x1="1" y1="7" x2="25" y2="7" className="sm-lg-code" />, '代码调用')}
      {item(<line x1="1" y1="7" x2="25" y2="7" className="sm-lg-disk" />, '读写磁盘上的文件')}
      {item(
        <>
          <circle cx="13" cy="7" r="6" className="sm-lg-badge" />
          <text x="13" y="7" textAnchor="middle" dominantBaseline="central" className="sm-lg-badge-n">
            n
          </text>
        </>,
        '接缝编号',
      )}
      {item(<rect x="2" y="2" width="22" height="10" rx="5" className="sm-lg-entry" />, '从外面进来的入口')}
      <span className="sm-legend-hint">鼠标停在编号或模块框上看说明，点击固定高亮它连着谁</span>
    </div>
  );
}

function SeamTip({ seam }: { seam: Seam }) {
  const end = (ids: string[]) =>
    ids.map((id) => {
      const owner = moduleOfCap.get(id)!;
      return (
        <Pill key={id} role={owner.role ?? 'slate'}>
          <ModuleIcon moduleId={owner.id} />
          {capById.get(id)!.name}
        </Pill>
      );
    });
  return (
    <>
      <div className="sm-tip-head">
        <b>{seam.label}</b>
        <Pill tone={seam.convention ? 'warn' : 'info'}>{seam.convention ? '约定，没有代码接口' : '代码接口'}</Pill>
      </div>
      <div className="sm-ends">
        {end(seam.a)}
        <span className="sm-arrow" aria-hidden="true">
          ↔
        </span>
        {end(seam.b)}
      </div>
      <p className="sm-tip-text">{seam.text}</p>
      <code className="sm-iface">{seam.iface}</code>
    </>
  );
}

function ModuleTip({ module }: { module: Module }) {
  return (
    <>
      <div className="sm-tip-head" data-role={module.role ?? 'slate'}>
        <b className="sm-module-name">
          <ModuleIcon moduleId={module.id} />
          {module.name}
        </b>
        <code className="sm-module-pkg">{module.pkg}</code>
      </div>
      <p className="sm-tip-text">{module.blurb}</p>
      <p className="sm-related">相关接缝：{seamsOfModule(module.id).map((s) => s.label).join(' · ')}</p>
    </>
  );
}

/** 浮层挂在哪儿：横向位置，以及上下两条边（浮层放在下边之下或上边之上） */
function anchorOf(target: Target): { x: number; top: number; bottom: number } {
  if (target.kind === 'seam') {
    const [bx, by] = layoutOf(SEAM_PATH, target.id, '接缝').badge;
    return { x: bx, top: by - 12, bottom: by + 12 };
  }
  const module = modules.find((m) => m.id === target.id)!;
  const box = layoutOf(GROUP_BOX, module.id, '模块') ?? layoutOf(CAP_BOX, module.caps[0]!.id, '能力');
  return { x: box.x + box.w / 2, top: box.y, bottom: box.y + box.h };
}

/**
 * 浮层：上半张图的东西，浮层放在它下面；下半张的放在上面。横向按锚点在图里的比例平移，
 * 锚点在最左时浮层左边对齐、在最右时右边对齐，所以不会伸出图外。
 */
function Tip({ target }: { target: Target }) {
  const { x, top, bottom } = anchorOf(target);
  const below = (top + bottom) / 2 < VIEW_H / 2;
  const across = (x / VIEW_W) * 100;
  const style: CSSProperties = {
    left: `${across}%`,
    top: `${((below ? bottom : top) / VIEW_H) * 100}%`,
    transform: `translate(${-across}%, ${below ? '8px' : 'calc(-100% - 8px)'})`,
  };
  const content =
    target.kind === 'seam' ? <SeamTip seam={seams.find((s) => s.id === target.id)!} /> : <ModuleTip module={modules.find((m) => m.id === target.id)!} />;
  return (
    <div className="sm-tip" style={style} role="tooltip">
      {content}
    </div>
  );
}

export function SeamMap() {
  /** 浮层显示的是鼠标停着的那个；高亮的是点击固定的那个，两者互不影响 */
  const [shown, setShown] = useState<Target | null>(null);
  const [pinned, setPinned] = useState<Target | null>(null);
  const pointing: Pointing = {
    point: setShown,
    pin: (target) => setPinned((current) => (sameTarget(current, target) ? null : target)),
  };

  const focused = pinned?.kind === 'module' ? modules.find((m) => m.id === pinned.id)! : null;
  const seam = pinned?.kind === 'seam' ? seams.find((s) => s.id === pinned.id)! : null;
  const active = focused !== null ? seamsOfModule(focused.id) : seam !== null ? [seam] : [];
  const nothingPinned = pinned === null;
  const activeIds = new Set(active.map((s) => s.id));
  const litCaps = nothingPinned ? null : new Set(active.flatMap((s) => [...s.a, ...s.b]));
  if (focused !== null && litCaps !== null) for (const c of focused.caps) litCaps.add(c.id);
  // 高亮的接缝画在最后，压在别的线上面
  const drawOrder = [...seams].sort((p, q) => Number(activeIds.has(p.id)) - Number(activeIds.has(q.id)));

  return (
    <div className="dx seam-map not-prose">
      <Legend />
      <div className="sm-scroll">
        <div className="sm-canvas">
          <svg className="sm-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label="docfirst 的模块、能力与接缝">
            {entries.map((e) => (
              <Entry key={e.id} id={e.id} name={e.name} />
            ))}
            {modules.map((m) => (
              <ModuleGroup key={m.id} module={m} focused={focused?.id === m.id} litCaps={litCaps} pointing={pointing} />
            ))}
            {drawOrder.map((s) => (
              <SeamLine key={s.id} seam={s} on={nothingPinned ? undefined : activeIds.has(s.id)} pinned={seam?.id === s.id} pointing={pointing} />
            ))}
          </svg>
          {shown === null ? null : <Tip target={shown} />}
        </div>
      </div>
    </div>
  );
}

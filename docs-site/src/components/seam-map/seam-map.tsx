'use client';
/**
 * 系统地图的接缝图：虚线框是模块（四个包加工作台插件，每个包一种角色色），框里的方块是能力，
 * 跨模块的线带编号，就是接缝；实线是代码调用，虚线是读写磁盘上的文件；框外是使用方的站、使用方的仓、fumadocs 本体与三条入口。
 * 点编号（图上的圆点或上面的胶囊）高亮这条接缝和两端的能力；点一个模块，高亮跟它有关的接缝。
 * 内容全在 seam-map.data.mjs，这里只有布局与交互；机读版由 seam-map.ai.mjs 读同一份数据生成。
 */
import { useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { CasePicker, Pill } from '@godcreator/docs-explain';
import { capById, entries, moduleOfCap, modules, seams, seamsOfModule } from './seam-map.data.mjs';

type Seam = (typeof seams)[number];
type Module = (typeof modules)[number];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
 * 每条接缝的走线与编号圆点。线停在框边上（6、7、8）表示接这个包里的几处能力，是哪几处点编号看高亮。
 * 5 的另两端（建模、缩略图）与 8 落在项目根的那一端没有单独画线，点编号时照样高亮。
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

/** 三条入口：外面的方块与指向入口的箭头（起点、终点） */
const ENTRY_LAYOUT: Record<string, { box: Box; arrow: [number, number, number, number] }> = {
  agent: { box: { x: 440, y: 6, w: 200, h: 26 }, arrow: [540, 32, 540, 50] },
  next: { box: { x: 20, y: 222, w: 130, h: 48 }, arrow: [150, 246, 194, 246] },
  human: { box: { x: 20, y: 372, w: 130, h: 48 }, arrow: [150, 396, 194, 396] },
};

function layoutOf<T>(table: Record<string, T>, id: string, what: string): T {
  if (!(id in table)) throw new Error(`接缝图的布局表里没有${what}「${id}」：seam-map.data.mjs 加了东西，seam-map.tsx 的布局表要跟着加`);
  return table[id]!;
}

/** 键盘上回车、空格与点击是同一个动作 */
function pressable(label: string, action: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: action,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      action();
    },
  };
}

function CapBlock({ id, lit }: { id: string; lit: boolean }) {
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

function ModuleGroup({ module, focused, litCaps, onPick }: { module: Module; focused: boolean; litCaps: Set<string>; onPick: () => void }) {
  const frame = layoutOf(GROUP_BOX, module.id, '模块');
  return (
    <g
      className="sm-module"
      data-role={module.role ?? 'slate'}
      data-outside={module.outside}
      data-focus={focused}
      aria-pressed={focused}
      {...pressable(`模块 ${module.name}`, onPick)}
    >
      {frame === null ? null : (
        <>
          <rect className="sm-frame" x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={12} />
          <text x={frame.x + 12} y={frame.y + 18}>
            <tspan className="sm-frame-name">{module.name}</tspan>
            <tspan className="sm-frame-pkg" dx={8}>
              {module.pkg}
            </tspan>
          </text>
        </>
      )}
      {module.caps.map((c) => (
        <CapBlock key={c.id} id={c.id} lit={litCaps.has(c.id)} />
      ))}
    </g>
  );
}

function SeamLine({ seam, on, onPick }: { seam: Seam; on: boolean; onPick: () => void }) {
  const { d, badge } = layoutOf(SEAM_PATH, seam.id, '接缝');
  const [bx, by] = badge;
  return (
    <g className="sm-seam" data-on={on} data-via={seam.via}>
      <path d={d} />
      <g className="sm-badge" aria-pressed={on} {...pressable(`接缝 ${seam.label}`, onPick)}>
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
  return (
    <g className="sm-entry">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.h / 2} />
      <text x={box.x + box.w / 2} y={box.y + box.h / 2} textAnchor="middle" dominantBaseline="central">
        {name}
      </text>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={head} />
    </g>
  );
}

/** 图例：每种元素的意思 */
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
    </div>
  );
}

function SeamDetail({ seam }: { seam: Seam }) {
  const end = (ids: string[]) =>
    ids.map((id) => {
      const owner = moduleOfCap.get(id)!;
      return (
        <Pill key={id} role={owner.role ?? 'slate'}>
          {capById.get(id)!.name}
        </Pill>
      );
    });
  return (
    <div className="sm-detail">
      <div className="sm-ends">
        {end(seam.a)}
        <span className="sm-arrow" aria-hidden="true">
          ↔
        </span>
        {end(seam.b)}
        <Pill tone={seam.convention ? 'warn' : 'info'}>{seam.convention ? '约定，没有代码接口' : '代码接口'}</Pill>
      </div>
      <code className="sm-iface">{seam.iface}</code>
    </div>
  );
}

function ModuleDetail({ module, onSeam }: { module: Module; onSeam: (id: string) => void }) {
  const related = seamsOfModule(module.id);
  return (
    <div className="sm-detail" data-role={module.role ?? 'slate'}>
      <p className="sm-module-text">
        <b className="sm-module-name">{module.name}</b>
        <code className="sm-module-pkg">{module.pkg}</code>
        {module.blurb}
      </p>
      <div className="sm-ends">
        <span className="sm-related">相关接缝 {related.length} 条：</span>
        {related.map((s) => (
          <button key={s.id} type="button" className="sm-seam-chip" onClick={() => onSeam(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stage({
  seam,
  focusModule,
  onSeam,
  onModule,
}: {
  seam: Seam;
  focusModule: string | null;
  onSeam: (id: string) => void;
  onModule: (id: string) => void;
}) {
  const focused = focusModule === null ? null : modules.find((m) => m.id === focusModule)!;
  const active = focused === null ? [seam] : seamsOfModule(focused.id);
  const activeIds = new Set(active.map((s) => s.id));
  const litCaps = new Set(active.flatMap((s) => [...s.a, ...s.b]));
  if (focused !== null) for (const c of focused.caps) litCaps.add(c.id);
  // 高亮的接缝画在最后，压在别的线上面
  const drawOrder = [...seams].sort((p, q) => Number(activeIds.has(p.id)) - Number(activeIds.has(q.id)));

  return (
    <>
      <Legend />
      <div className="sm-scroll">
        <svg className="sm-svg" viewBox="0 0 1100 750" role="group" aria-label="docfirst 的模块、能力与十二条接缝">
          {entries.map((e) => (
            <Entry key={e.id} id={e.id} name={e.name} />
          ))}
          {modules.map((m) => (
            <ModuleGroup key={m.id} module={m} focused={focused?.id === m.id} litCaps={litCaps} onPick={() => onModule(m.id)} />
          ))}
          {drawOrder.map((s) => (
            <SeamLine key={s.id} seam={s} on={activeIds.has(s.id)} onPick={() => onSeam(s.id)} />
          ))}
        </svg>
      </div>
      {focused === null ? <SeamDetail seam={seam} /> : <ModuleDetail module={focused} onSeam={onSeam} />}
    </>
  );
}

export function SeamMap() {
  const [seamId, setSeamId] = useState('3');
  const [focusModule, setFocusModule] = useState<string | null>(null);
  const pickSeam = (id: string) => {
    setSeamId(id);
    setFocusModule(null);
  };
  const toggleModule = (id: string) => setFocusModule((current) => (current === id ? null : id));

  return (
    <div className="seam-map not-prose">
      <CasePicker cases={seams} value={seamId} onChange={pickSeam} label="十二条接缝">
        {(seam) => <Stage seam={seam} focusModule={focusModule} onSeam={pickSeam} onModule={toggleModule} />}
      </CasePicker>
    </div>
  );
}

'use client';
/**
 * 边界规则图：包、工作台插件、站与 workflow 包里的目录画成一张依赖图，平时的灰色箭头是允许的依赖方向。
 * 选一类边界规则（tests/boundary.test.ts 文件头注释里的一类约束），它守着的允许方向实线高亮，
 * 禁止的方向画成红色虚线并在线中间打叉；图下面列出这一类禁止什么、违反时哪几条 test 失败。
 * 内容全在 boundary-rules.data.mjs，这里只有布局与交互；机读版由 boundary-rules.ai.mjs 读同一份数据生成。
 */
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { CasePicker, Pane } from '@godcreator/explainer-player';
import { Globe, Hash, Layers, Orbit, Package, PanelsTopLeft, Pin, Plug, Puzzle, Workflow } from 'lucide-react';
import { allowedByKey, allowedEdges, edgeText, nodeById, nodes, parseEdge, rules } from './boundary-rules.data.mjs';

type Rule = (typeof rules)[number];
type BoundaryNode = (typeof nodes)[number];
type Point = [number, number];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const VIEW_W = 1020;
const VIEW_H = 670;

/** 节点的位置：按依赖方向从上往下，站与插件在最上面，node:crypto 与别的模块在最下面，宿主是右边一整列 */
const NODE_BOX: Record<string, Box> = {
  plugin: { x: 20, y: 20, w: 180, h: 52 },
  site: { x: 380, y: 20, w: 320, h: 52 },
  explain: { x: 230, y: 140, w: 190, h: 52 },
  fumadocs: { x: 500, y: 140, w: 300, h: 52 },
  host: { x: 850, y: 250, w: 160, h: 302 },
  workflow: { x: 290, y: 240, w: 410, h: 210 },
  project: { x: 470, y: 276, w: 100, h: 36 },
  cli: { x: 604, y: 276, w: 80, h: 36 },
  mdx: { x: 306, y: 334, w: 100, h: 36 },
  pinning: { x: 470, y: 334, w: 100, h: 36 },
  marker: { x: 306, y: 392, w: 90, h: 36 },
  reference: { x: 420, y: 392, w: 90, h: 36 },
  code: { x: 534, y: 392, w: 90, h: 36 },
  cards: { x: 604, y: 334, w: 80, h: 36 },
  node: { x: 316, y: 276, w: 120, h: 36 },
  pin: { x: 230, y: 500, w: 200, h: 52 },
  trajectory: { x: 560, y: 500, w: 200, h: 52 },
  crypto: { x: 230, y: 610, w: 150, h: 44 },
  others: { x: 400, y: 610, w: 360, h: 44 },
};

/**
 * 每条边的折线（起点到终点），key 与数据里的写法相同。同一对节点上允许与禁止两条线各走各的，
 * 平时不画的禁止线只在选中它那一类规则时出现。线穿过两行节点之间的空隙或两侧的空列，不压在节点上。
 */
const EDGE_ROUTE: Record<string, Point[]> = {
  // 允许的边
  'site>fumadocs': [[620, 72], [620, 140]],
  'site>workflow': [[460, 72], [460, 240]],
  'site>explain': [[400, 72], [340, 140]],
  'site>trajectory': [[700, 46], [830, 46], [830, 514], [760, 514]],
  'fumadocs>workflow': [[600, 192], [600, 240]],
  'fumadocs>pin': [[520, 192], [520, 216], [255, 216], [255, 500]],
  'fumadocs>trajectory': [[740, 192], [740, 500]],
  'fumadocs>host': [[800, 166], [900, 166], [900, 250]],
  'workflow>pin': [[300, 450], [300, 500]],
  'workflow>trajectory': [[640, 450], [640, 500]],
  'trajectory>host': [[760, 532], [850, 532]],
  'explain>host': [[325, 140], [325, 106], [960, 106], [960, 250]],
  'pin>crypto': [[300, 552], [300, 610]],
  'marker>pin': [[330, 428], [330, 500]],
  'reference>pin': [[425, 428], [425, 500]],
  'cli>project': [[604, 290], [570, 290]],
  'project>pinning': [[510, 312], [510, 334]],
  'pinning>mdx': [[470, 348], [406, 348]],
  'mdx>marker': [[346, 370], [346, 392]],
  'mdx>reference': [[390, 370], [390, 381], [465, 381], [465, 392]],
  'pinning>code': [[555, 370], [555, 392]],
  'code>reference': [[534, 404], [510, 404]],
  'code>marker': [[579, 428], [579, 440], [351, 440], [351, 428]],
  'cli>cards': [[664, 312], [664, 334]],
  'project>node': [[470, 288], [436, 288]],
  'cli>node': [[644, 276], [644, 262], [376, 262], [376, 276]],
  'cards>marker': [[670, 370], [670, 446], [341, 446], [341, 428]],
  // 包与包的方向
  'pin~trajectory': [[430, 526], [560, 526]],
  'pin>workflow': [[380, 500], [380, 450]],
  'pin>fumadocs': [[270, 500], [270, 230], [510, 230], [510, 192]],
  'trajectory>workflow': [[680, 500], [680, 450]],
  'trajectory>fumadocs': [[755, 500], [755, 192]],
  'workflow>fumadocs': [[660, 240], [660, 192]],
  'explain~pin': [[240, 192], [240, 500]],
  'explain~trajectory': [[230, 166], [212, 166], [212, 578], [620, 578], [620, 552]],
  'explain~workflow': [[380, 192], [380, 240]],
  'explain~fumadocs': [[420, 166], [500, 166]],
  // 通用包独立
  'pin>others': [[410, 552], [460, 610]],
  'trajectory>others': [[600, 552], [600, 610]],
  // workflow 目录方向
  'marker~reference': [[396, 410], [420, 410]],
  'marker>mdx:back': [[370, 392], [370, 370]],
  'reference>code:back': [[510, 418], [534, 418]],
  'mdx~code': [[400, 370], [400, 386], [600, 386], [600, 392]],
  'code>pinning:back': [[590, 392], [590, 370]],
  'mdx>pinning:back': [[406, 360], [470, 360]],
  'mdx>project': [[396, 334], [396, 322], [490, 322], [490, 312]],
  'pinning>project:back': [[540, 334], [540, 312]],
  'project>cli:back': [[570, 302], [604, 302]],
  'pinning>cli': [[570, 346], [590, 346], [590, 322], [624, 322], [624, 312]],
  'cards>pinning': [[604, 362], [570, 362]],
  'cards>cli:back': [[644, 334], [644, 312]],
  'node>project:back': [[436, 304], [470, 304]],
  'mdx>node': [[346, 334], [346, 312]],
  'workflow>host': [[700, 300], [850, 300]],
  // 宿主只能是 peer
  'fumadocs>host:bundled': [[800, 180], [880, 180], [880, 250]],
  // 包不认识插件
  'fumadocs>plugin': [[540, 140], [540, 90], [170, 90], [170, 72]],
  'explain>plugin': [[250, 140], [150, 72]],
  'workflow>plugin': [[290, 280], [110, 280], [110, 72]],
  'pin>plugin': [[230, 540], [90, 540], [90, 72]],
  'trajectory>plugin': [[700, 552], [700, 594], [70, 594], [70, 72]],
  // 讲解播放器的两个入口
  'explain>others': [[230, 180], [198, 180], [198, 662], [580, 662], [580, 654]],
  'plugin>explain': [[150, 72], [250, 140]],
};

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** 各节点的图标，包与 seam-map.tsx 的 MODULE_ICON 用同一个；只是外观，所以放在画面这边 */
const NODE_ICON: Record<string, Icon> = {
  plugin: Puzzle,
  site: Globe,
  explain: PanelsTopLeft,
  fumadocs: Plug,
  workflow: Workflow,
  pin: Pin,
  trajectory: Orbit,
  host: Layers,
  crypto: Hash,
  others: Package,
};

function layoutOf<T>(table: Record<string, T>, id: string, what: string): T {
  if (!(id in table)) throw new Error(`边界规则图的布局表里没有${what}「${id}」：boundary-rules.data.mjs 加了东西，boundary-rules.tsx 的布局表要跟着加`);
  return table[id]!;
}

/** 折线在拐角处用半径 r 的圆角连起来 */
function roundedPath(points: Point[], r = 6): string {
  const [first, ...rest] = points;
  let d = `M${first![0]},${first![1]}`;
  for (let i = 0; i < rest.length; i++) {
    const [x, y] = rest[i]!;
    const next = rest[i + 1];
    if (next === undefined) {
      d += ` L${x},${y}`;
      break;
    }
    const [px, py] = i === 0 ? first! : rest[i - 1]!;
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(next[0] - x, next[1] - y);
    const cut = Math.min(r, inLen / 2, outLen / 2);
    const ax = x - ((x - px) / inLen) * cut;
    const ay = y - ((y - py) / inLen) * cut;
    const bx = x + ((next[0] - x) / outLen) * cut;
    const by = y + ((next[1] - y) / outLen) * cut;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  }
  return d;
}

/** 箭头：尖端在 tip，方向从 from 指向 tip */
function arrowHead(from: Point, tip: Point): string {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const baseX = tip[0] - ux * 8;
  const baseY = tip[1] - uy * 8;
  return `${tip[0]},${tip[1]} ${baseX - uy * 4},${baseY + ux * 4} ${baseX + uy * 4},${baseY - ux * 4}`;
}

/** 折线按长度的中点，禁止线的叉画在这里 */
function midpoint(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  let remaining = lengths.reduce((sum, l) => sum + l, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    const segment = lengths[i]!;
    if (remaining <= segment) {
      const [ax, ay] = points[i]!;
      const [bx, by] = points[i + 1]!;
      const t = remaining / segment;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    remaining -= segment;
  }
  return points[points.length - 1]!;
}

type EdgeState = 'guarded' | 'idle' | 'forbidden';

function Edge({ edgeKey, state, title }: { edgeKey: string; state: EdgeState; title: string }) {
  const { both } = parseEdge(edgeKey);
  const points = layoutOf(EDGE_ROUTE, edgeKey, '边');
  const last = points.length - 1;
  const [mx, my] = midpoint(points);
  return (
    <g className="br-edge" data-state={state}>
      <title>{title}</title>
      <path d={roundedPath(points)} />
      <polygon points={arrowHead(points[last - 1]!, points[last]!)} />
      {both ? <polygon points={arrowHead(points[1]!, points[0]!)} /> : null}
      {state === 'forbidden' ? (
        <g className="br-cross">
          <circle cx={mx} cy={my} r={7} />
          <path d={`M${mx - 3},${my - 3} L${mx + 3},${my + 3} M${mx + 3},${my - 3} L${mx - 3},${my + 3}`} />
        </g>
      ) : null}
    </g>
  );
}

/** lit 为 true 是这一类规则涉及的节点，false 的淡下去 */
function NodeBox({ node, lit }: { node: BoundaryNode; lit: boolean }) {
  const box = layoutOf(NODE_BOX, node.id, '节点');
  const Glyph = layoutOf(NODE_ICON, node.id, '节点图标');
  return (
    <g className="br-node" data-role={node.role ?? 'slate'} data-outside={node.role === null} data-lit={lit}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} />
      <Glyph className="br-icon" x={box.x + 10} y={box.y + 11} width={14} height={14} strokeWidth={2} />
      <text className="br-node-name" x={box.x + 30} y={box.y + 22}>
        {node.name}
      </text>
      <text className="br-node-ident" x={box.x + 30} y={box.y + 39}>
        {node.ident}
      </text>
    </g>
  );
}

/** workflow 包画成虚线框，里面是它的几个目录 */
function WorkflowGroup({ node, lit, dirs, litIds }: { node: BoundaryNode; lit: boolean; dirs: BoundaryNode[]; litIds: Set<string> }) {
  const frame = layoutOf(NODE_BOX, node.id, '节点');
  const Glyph = layoutOf(NODE_ICON, node.id, '节点图标');
  return (
    <g className="br-group" data-role={node.role ?? 'slate'} data-lit={lit}>
      <rect className="br-frame" x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={12} />
      <Glyph className="br-icon" x={frame.x + 10} y={frame.y + 8} width={14} height={14} strokeWidth={2} />
      <text x={frame.x + 30} y={frame.y + 19}>
        <tspan className="br-node-name">{node.name}</tspan>
        <tspan className="br-node-ident" dx={8}>
          {node.ident}
        </tspan>
      </text>
      {dirs.map((dir) => {
        const box = layoutOf(NODE_BOX, dir.id, '目录');
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        return (
          <g key={dir.id} className="br-dir" data-lit={litIds.has(dir.id) || litIds.has(node.id)}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={7} />
            <text className="br-dir-name" x={cx} y={cy - 4} textAnchor="middle">
              {dir.name}
            </text>
            <text className="br-dir-ident" x={cx} y={cy + 11} textAnchor="middle">
              {dir.ident}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Legend() {
  const item = (mark: ReactNode, text: string) => (
    <span className="br-legend-item">
      <svg width="30" height="14" aria-hidden="true">
        {mark}
      </svg>
      {text}
    </span>
  );
  return (
    <div className="br-legend">
      {item(<line x1="1" y1="7" x2="29" y2="7" className="br-lg-idle" />, '允许的依赖')}
      {item(<line x1="1" y1="7" x2="29" y2="7" className="br-lg-guarded" />, '这一类守着的允许方向')}
      {item(
        <>
          <line x1="1" y1="7" x2="29" y2="7" className="br-lg-forbidden" />
          <circle cx="15" cy="7" r="5" className="br-lg-cross" />
        </>,
        '这一类禁止的方向',
      )}
      {item(<rect x="3" y="2" width="24" height="10" rx="3" className="br-lg-frame" />, '包里的目录')}
    </div>
  );
}

function EdgeChip({ edgeKey, forbidden }: { edgeKey: string; forbidden: boolean }) {
  return (
    <code className="br-chip" data-forbidden={forbidden}>
      {edgeText(edgeKey)}
    </code>
  );
}

/** 图下面的两张卡：这一类禁止什么，违反时哪几条 test 失败 */
function Details({ rule }: { rule: Rule }) {
  return (
    <div className="br-details">
      <Pane title="这一类禁止什么" role="rose">
        {rule.allowed.length === 0 ? null : (
          <div className="br-row">
            <span className="br-row-label">守着的允许方向</span>
            <span className="br-chips">
              {rule.allowed.map((key) => (
                <EdgeChip key={key} edgeKey={key} forbidden={false} />
              ))}
            </span>
          </div>
        )}
        {rule.forbidden.map((item) => (
          <div key={item.edges.join(' ')} className="br-row">
            <span className="br-chips">
              {item.edges.map((key) => (
                <EdgeChip key={key} edgeKey={key} forbidden />
              ))}
            </span>
            <span className="br-what">{item.what}</span>
          </div>
        ))}
      </Pane>
      <Pane title="违反时失败的 test" role="slate" icon="file" extra="tests/boundary.test.ts">
        <ul className="br-tests">
          {rule.tests.map((t) => (
            <li key={t.name}>
              <code className="br-test-name">{t.name}</code>
              <span className="br-test-checks">{t.checks}</span>
            </li>
          ))}
        </ul>
      </Pane>
    </div>
  );
}

function Picture({ rule }: { rule: Rule }) {
  const guarded = new Set(rule.allowed);
  const forbiddenKeys = rule.forbidden.flatMap((item) => item.edges);
  const litIds = new Set([...rule.allowed, ...forbiddenKeys].flatMap((key) => {
    const { from, to } = parseEdge(key);
    return [from, to];
  }));
  const dirs = nodes.filter((n) => n.parent === 'workflow');
  const workflow = nodeById.get('workflow')!;
  const groupLit = litIds.has('workflow') || dirs.some((d) => litIds.has(d.id));
  // 高亮的边画在后面，压在灰色的边上面；禁止的边最后画
  const drawOrder = [...allowedEdges].sort((p, q) => Number(guarded.has(p.key)) - Number(guarded.has(q.key)));

  return (
    <>
      <Legend />
      <div className="br-scroll">
        <svg className="br-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`依赖图：${rule.label}`}>
          <WorkflowGroup node={workflow} lit={groupLit} dirs={dirs} litIds={litIds} />
          {nodes
            .filter((n) => n.parent === null && n.id !== 'workflow')
            .map((n) => (
              <NodeBox key={n.id} node={n} lit={litIds.has(n.id)} />
            ))}
          {drawOrder.map((edge) => (
            <Edge
              key={edge.key}
              edgeKey={edge.key}
              state={guarded.has(edge.key) ? 'guarded' : 'idle'}
              title={`允许 ${edgeText(edge.key)}：${allowedByKey.get(edge.key)!.kind}`}
            />
          ))}
          {forbiddenKeys.map((key) => (
            <Edge key={key} edgeKey={key} state="forbidden" title={`禁止 ${edgeText(key)}`} />
          ))}
        </svg>
      </div>
      <Details rule={rule} />
    </>
  );
}

export function BoundaryRules() {
  return (
    <div className="boundary-rules not-prose">
      <CasePicker cases={rules} label="选一类边界规则">
        {(rule) => <Picture rule={rule} />}
      </CasePicker>
    </div>
  );
}

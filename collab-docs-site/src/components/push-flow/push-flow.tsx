'use client';
/**
 * 「实时推送」讲解动画：bob 提交以后，他的评论怎么在二十秒上下出现在 carol 的网站上。
 * 上面五个地点（bob 的电脑、Gitea、NAS 执行器、ntfy、carol 的电脑）和它们之间的线，线上标明走的是什么；消息与请求是沿线走的点和气泡。
 * 画面是 (段号, 本段进度) → 画面 的纯函数，拖到哪一刻都画得出来。讲解文字与数字都在 push-flow.data.mjs，机读版由 push-flow.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { Timeline } from '@godcreator/docfirst-explainer';
import type { Role, TimelineFrame } from '@godcreator/docfirst-explainer';
import { chapters, checkSteps, debounceSeconds, messages, siteComments } from './push-flow.data.mjs';

type PushChapter = (typeof chapters)[number];
type ChapterId = PushChapter['id'];
type Frame = TimelineFrame<PushChapter>;
type Point = readonly [number, number];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
/** 进度 p 在 [from, to] 里走到了哪儿，0–1 */
const ramp = (p: number, from: number, to: number): number => clamp01((p - from) / (to - from));
const ease = (value: number): number => value * value * (3 - 2 * value);

const order = chapters.map((chapter) => chapter.id);

/** 某一段的进度：过去的段是 1，没到的段是 0，当前段是本段进度 */
function phaseOf(frame: Frame, id: ChapterId): number {
  const at = order.indexOf(id);
  if (frame.index > at) return 1;
  if (frame.index < at) return 0;
  return frame.progress;
}

const lerp = (from: Point, to: Point, t: number): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];

/** 五个地点，颜色在整页里固定：bob 蓝、carol 绿、Gitea 青、执行器琥珀、ntfy 紫 */
const nodes = {
  bob: { x: 16, y: 24, w: 196, h: 104, role: 'blue', title: 'bob 的电脑', sub: 'gwb-collab' },
  gitea: { x: 290, y: 24, w: 196, h: 104, role: 'cyan', title: 'Gitea', sub: '组织 hybrid-mmc' },
  runner: { x: 564, y: 24, w: 180, h: 104, role: 'amber', title: 'NAS 上的执行器', sub: 'collab-bot' },
  ntfy: { x: 290, y: 226, w: 196, h: 84, role: 'violet', title: 'ntfy', sub: 'NAS · topic collab-hybrid-mmc' },
  carol: { x: 544, y: 186, w: 200, h: 170, role: 'emerald', title: 'carol 的电脑', sub: 'gwb-collab · 网站' },
} as const;
type NodeId = keyof typeof nodes;

/** 线：两端、标在哪、写什么；dashed 是只在取回时才走的那条 */
const edges = {
  push: { from: [212, 64], to: [290, 64], label: 'git push', labelAt: [251, 56], role: 'blue' },
  task: { from: [486, 64], to: [564, 64], label: '派任务 · 合并', labelAt: [525, 56], role: 'amber' },
  hook: { from: [388, 128], to: [388, 226], label: 'webhook（NAS 内网）', labelAt: [396, 182], role: 'cyan' },
  toCarol: { from: [486, 276], to: [544, 276], label: '长连接', labelAt: [515, 268], role: 'violet' },
  toBob: { from: [290, 276], to: [114, 128], label: '长连接（经 Lucky 28377）', labelAt: [128, 214], role: 'violet' },
  fetch: { from: [470, 128], to: [600, 186], label: 'git fetch', labelAt: [556, 150], role: 'emerald' },
} as const;
type EdgeId = keyof typeof edges;

/** 这一刻哪几条线在用（加粗、上色） */
function activeEdges(frame: Frame): Set<EdgeId> {
  const p = frame.progress;
  switch (frame.chapter.id) {
    case 'submit':
      return new Set(p > 0.15 && p < 0.85 ? ['push'] : []);
    case 'opened':
      return new Set<EdgeId>([...(p < 0.45 ? (['hook', 'task'] as const) : []), ...(p >= 0.35 && p < 0.75 ? (['toCarol', 'toBob'] as const) : [])]);
    case 'runner':
      return new Set(p > 0.45 && p < 0.65 ? ['toCarol', 'toBob'] : []);
    case 'merged':
      return new Set<EdgeId>([...(p < 0.35 ? (['task'] as const) : []), ...(p >= 0.3 ? (['hook'] as const) : [])]);
    case 'deliver':
      return new Set(p < 0.4 ? ['toCarol', 'toBob'] : []);
    case 'check':
      return new Set(p < 0.35 ? ['fetch'] : []);
  }
}

/** 沿线走的东西：一个点或一个写着字的气泡，t 是走到了哪儿（0 起点、1 终点） */
type Traveler = { key: string; edge: EdgeId; t: number; text?: string; reverse?: boolean };

function travelers(frame: Frame): Traveler[] {
  const p = frame.progress;
  const along = (key: string, edge: EdgeId, from: number, to: number, extra: Partial<Traveler> = {}): Traveler[] =>
    p >= from && p <= to ? [{ key, edge, t: ease(ramp(p, from, to)), ...extra }] : [];
  switch (frame.chapter.id) {
    case 'submit':
      return along('push', 'push', 0.15, 0.85, { text: 'refs/for/main' });
    case 'opened':
      return [
        ...along('opened-hook', 'hook', 0, 0.35, { text: messages.opened }),
        ...along('opened-carol', 'toCarol', 0.35, 0.7, { text: messages.opened }),
        ...along('opened-bob', 'toBob', 0.35, 0.7),
        ...along('task', 'task', 0.05, 0.45),
      ];
    case 'runner':
      return [...along('keepalive-carol', 'toCarol', 0.45, 0.65, { text: '保活' }), ...along('keepalive-bob', 'toBob', 0.45, 0.65)];
    case 'merged':
      return [
        ...along('merge', 'task', 0, 0.35, { reverse: true, text: '合并 #7' }),
        ...along('push-hook', 'hook', 0.35, 0.8, { text: messages.push }),
        ...along('closed-hook', 'hook', 0.5, 0.95, { text: messages.closed }),
      ];
    case 'deliver':
      return [
        ...along('push-carol', 'toCarol', 0, 0.3, { text: '2 条' }),
        ...along('push-bob', 'toBob', 0, 0.3),
      ];
    case 'check':
      return along('fetch', 'fetch', 0.02, 0.35, { reverse: true, text: 'main' });
  }
}

/** 每个地点里写的几行状态：此刻在做什么、手里是什么 */
function nodeLines(frame: Frame): Record<NodeId, string[]> {
  const submitted = phaseOf(frame, 'submit') > 0.85;
  const merged = phaseOf(frame, 'merged') > 0.35;
  const runner = phaseOf(frame, 'runner');
  const id = frame.chapter.id;
  const p = frame.progress;

  const runnerLine =
    id === 'opened' && p > 0.45
      ? '收到任务'
      : id === 'runner'
        ? `合并检查 ${Math.round(runner * 100)}%`
        : id === 'merged' && p < 0.35
          ? '以 collab-bot 合并'
          : merged
            ? '合并了 #7，空闲'
            : '空闲';

  const debounce = id === 'deliver' ? Math.max(0, debounceSeconds * (1 - ramp(p, 0.3, 1))) : 0;
  const carolLine =
    id === 'opened' && p >= 0.7
      ? '收到 1 条：合并请求，不用取'
      : id === 'deliver'
        ? p < 0.3
          ? '收到 2 条'
          : `${debounce.toFixed(1)} 秒后取回协作仓`
        : id === 'check'
          ? checkSteps[Math.min(checkSteps.length - 1, Math.floor(p * checkSteps.length))]!
          : phaseOf(frame, 'check') >= 1
            ? '本地 main 和 Gitea 一致'
            : '长连接已连上，等消息';

  return {
    bob: [submitted ? (merged ? 'collab.submit 回执：#7 已合并' : 'collab.submit 等执行器的结论') : p < 0.15 ? '写了一条评论，没提交' : 'collab.submit'],
    gitea: [merged ? 'main：合并了 #7' : 'main：还没有 bob 的评论', submitted ? (merged ? '#7 已合并' : '#7 开着') : '还没有合并请求'],
    runner: [runnerLine],
    ntfy: [phaseOf(frame, 'merged') > 0.8 ? '转发了 3 条' : phaseOf(frame, 'opened') > 0.35 ? '转发了 1 条' : '没有消息'],
    carol: [carolLine],
  };
}

function Node({ id, lines, active }: { id: NodeId; lines: string[]; active: boolean }): JSX.Element {
  const node = nodes[id];
  return (
    <g data-role={node.role} className="pf-node" data-active={active ? true : undefined}>
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={12} />
      <text className="pf-title" x={node.x + 12} y={node.y + 22}>
        {node.title}
      </text>
      <text className="pf-sub" x={node.x + 12} y={node.y + 38}>
        {node.sub}
      </text>
      {lines.map((line, i) => (
        <text key={i} className="pf-line" x={node.x + 12} y={node.y + 62 + i * 18}>
          {line}
        </text>
      ))}
    </g>
  );
}

/** 气泡经过的那条线隐去线上的文字，免得两者叠在一起 */
function Edge({ id, active, labelHidden }: { id: EdgeId; active: boolean; labelHidden: boolean }): JSX.Element {
  const edge = edges[id];
  return (
    <g
      data-role={edge.role}
      className="pf-edge"
      data-active={active ? true : undefined}
      data-dashed={id === 'fetch' ? true : undefined}
      data-label-hidden={labelHidden ? true : undefined}
    >
      <line x1={edge.from[0]} y1={edge.from[1]} x2={edge.to[0]} y2={edge.to[1]} />
      <text x={edge.labelAt[0]} y={edge.labelAt[1]} textAnchor={id === 'hook' || id === 'toBob' ? 'start' : 'middle'}>
        {edge.label}
      </text>
    </g>
  );
}

function TravelerMark({ traveler }: { traveler: Traveler }): JSX.Element {
  const edge = edges[traveler.edge];
  const [x, y] = traveler.reverse ? lerp(edge.to, edge.from, traveler.t) : lerp(edge.from, edge.to, traveler.t);
  const role: Role = traveler.edge === 'task' && traveler.reverse ? 'amber' : (edge.role as Role);
  if (traveler.text === undefined) return <circle data-role={role} className="pf-dot" cx={x} cy={y} r={5} />;
  const width = traveler.text.length * 6.6 + 16;
  return (
    <g data-role={role} className="pf-msg" transform={`translate(${x - width / 2}, ${y - 11})`}>
      <rect width={width} height={22} rx={11} />
      <text x={width / 2} y={15} textAnchor="middle">
        {traveler.text}
      </text>
    </g>
  );
}

/** carol 网站上那一页：bob 的评论在快进做完、网页刷新后出现 */
function Site({ frame }: { frame: Frame }): JSX.Element {
  const node = nodes.carol;
  const shown = ease(ramp(phaseOf(frame, 'check'), 0.8, 1));
  const x = node.x + 12;
  const y = node.y + 86;
  return (
    <g>
      <rect className="pf-site-box" x={x} y={y} width={node.w - 24} height={70} rx={8} />
      <text className="pf-site-title" x={x + 8} y={y + 16}>
        网站 · prototype/capacitor
      </text>
      {siteComments.before.map((line, i) => (
        <text key={line} className="pf-site-line" x={x + 8} y={y + 36 + i * 16}>
          {line}
        </text>
      ))}
      <g data-role="blue" style={{ opacity: shown }} transform={`translate(${12 * (1 - shown)}, 0)`}>
        <rect className="pf-site-new" x={x + 4} y={y + 42} width={node.w - 32} height={20} rx={5} />
        <text className="pf-site-line pf-site-added" x={x + 8} y={y + 56}>
          {siteComments.added}
        </text>
      </g>
    </g>
  );
}

/** 右上角的实际时间：按本段进度在这一段的实际起止秒数之间走 */
function realSecondsOf(frame: Frame): number {
  const [from, to] = frame.chapter.real;
  return from + (to - from) * frame.progress;
}

function Scene({ frame }: { frame: Frame }): JSX.Element {
  const active = activeEdges(frame);
  const lines = nodeLines(frame);
  const moving = travelers(frame);
  const edgesCarryingBubble = new Set(moving.filter((traveler) => traveler.text !== undefined).map((traveler) => traveler.edge));
  const busy: Record<ChapterId, NodeId[]> = {
    submit: ['bob', 'gitea'],
    opened: ['gitea', 'ntfy', 'carol'],
    runner: ['runner'],
    merged: ['runner', 'gitea', 'ntfy'],
    deliver: ['ntfy', 'carol'],
    check: ['carol'],
  };
  return (
    <svg className="pf-svg" viewBox="0 0 760 372" role="img" aria-label="bob、Gitea、执行器、ntfy、carol 之间这一刻在传什么">
      <text className="pf-clock" x={744} y={16} textAnchor="end">
        实际第 {Math.round(realSecondsOf(frame))} 秒
      </text>
      {(Object.keys(edges) as EdgeId[]).map((id) => (
        <Edge key={id} id={id} active={active.has(id)} labelHidden={edgesCarryingBubble.has(id)} />
      ))}
      {(Object.keys(nodes) as NodeId[]).map((id) => (
        <Node key={id} id={id} lines={lines[id]} active={busy[frame.chapter.id].includes(id)} />
      ))}
      <Site frame={frame} />
      {moving.map((traveler) => (
        <TravelerMark key={traveler.key} traveler={traveler} />
      ))}
    </svg>
  );
}

export function PushFlow(): JSX.Element {
  return (
    <Timeline chapters={chapters} label="实时推送：一次合并怎么在二十秒上下出现在别人的网站上">
      {(frame) => <Scene frame={frame} />}
    </Timeline>
  );
}

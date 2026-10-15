'use client';
/**
 * 成员、负责人与执行器在各种情况下怎么配合：上面一排选情况；选好以后一步一步走（上一步、下一步、播放），
 * 每一步画出每台机器（Gitea、bob 与 carol 的电脑）此刻的提交图：分支指向哪、开着哪些合并请求、工作区里有没有没提交的改动。
 * 讲解文字与每一步各台机器的变化都在 submit-scenarios.data.mjs；机读版由 submit-scenarios.ai.mjs 读同一份数据生成。
 */
import type { CSSProperties, JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill, Stepper } from '@godcreator/explainer/site';
import { actors, authorRoles, cases, machines, outcomes, pullTones, statesAt } from './submit-scenarios.data.mjs';

type Case = (typeof cases)[number];
type ScenarioEvent = Case['events'][number];
type PullChange = NonNullable<ScenarioEvent['pull']>;
type Commit = Case['commits'][number];
type MachineId = Case['machines'][number];
type MachineState = { main?: string; origin?: string; pulls?: Record<string, string>; work?: string };

const ROW = 30;
const LANE_GAP = 20;
const LEFT = 14;

/** 每个合并请求走到这一步时的状态，按编号排 */
function pullsSoFar(events: ScenarioEvent[], index: number): PullChange[] {
  const last = new Map<number, PullChange>();
  for (const event of events.slice(0, index + 1)) if (event.pull !== undefined) last.set(event.pull.n, event.pull);
  return [...last.values()].sort((p, q) => p.n - q.n);
}

/** 这一步是在哪台机器上做的：成员在自己的电脑上，负责人与执行器在 Gitea 上 */
function machineOf(who: ScenarioEvent['who']): MachineId {
  return who === 'a' || who === 'b' ? who : 'gitea';
}

/** 一个分支或合并请求的名字、指向的提交、颜色 */
type Ref = { label: string; target: string; role: string };

function refsOf(machine: MachineId, state: MachineState, commitById: Map<string, Commit>): Ref[] {
  const refs: Ref[] = [];
  if (state.main !== undefined) refs.push({ label: machines[machine].main, target: state.main, role: machines[machine].role });
  if (state.origin !== undefined) refs.push({ label: 'origin/main', target: state.origin, role: machines.gitea.role });
  for (const [n, target] of Object.entries(state.pulls ?? {})) refs.push({ label: `#${n}`, target, role: authorRoles[commitById.get(target)!.by] });
  return refs;
}

/** 从 tips 往回能走到的提交：这台机器上此刻有的就是这些 */
function reachable(tips: string[], commitById: Map<string, Commit>): Set<string> {
  const seen = new Set<string>();
  const stack = [...tips];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...commitById.get(id)!.parents);
  }
  return seen;
}

/**
 * 给每个提交分一列，和 git log --graph 一样从新到旧走：每列记着它下面等的是哪个提交，提交落在等它的那一列（main 固定在第一列），
 * 第一个父提交接着占这一列，别的父提交另找一列空的
 */
function lanesOf(rows: Commit[], mainTip: string | undefined): Map<string, number> {
  const waiting: (string | null)[] = mainTip === undefined ? [] : [mainTip];
  const laneOf = new Map<string, number>();
  const visible = new Set(rows.map((commit) => commit.id));
  for (const commit of rows) {
    let lane = waiting.indexOf(commit.id);
    if (lane === -1) lane = waiting.includes(null) ? waiting.indexOf(null) : waiting.length;
    for (let i = 0; i < waiting.length; i++) if (waiting[i] === commit.id && i !== lane) waiting[i] = null;
    laneOf.set(commit.id, lane);
    const [first, ...rest] = commit.parents.filter((parent) => visible.has(parent));
    waiting[lane] = first ?? null;
    for (const parent of rest) {
      if (waiting.includes(parent)) continue;
      const free = waiting.indexOf(null);
      if (free === -1) waiting.push(parent);
      else waiting[free] = parent;
    }
  }
  return laneOf;
}

/**
 * 一条边从父提交（下面）画到子提交（上面）。同一列是竖线；第一个父提交在别的列（从那条线分出来），
 * 先在父提交上面一行拐进子提交那列再往上；别的父提交（合进来的那条），沿父提交那列往上，到子提交下面一行才拐过去
 */
function edgePath(x1: number, y1: number, x2: number, y2: number, isFirstParent: boolean): string {
  if (x1 === x2) return `M${x1},${y1} V${y2}`;
  const bend = (fromY: number, toY: number, fromX: number, toX: number): string => {
    const middle = (fromY + toY) / 2;
    return `C${fromX},${middle} ${toX},${middle} ${toX},${toY}`;
  };
  if (isFirstParent) return `M${x1},${y1} ${bend(y1, y1 - ROW, x1, x2)} V${y2}`;
  return `M${x1},${y1} V${y2 + ROW} ${bend(y2 + ROW, y2, x1, x2)}`;
}

/** 本地 main 比 origin/main 多几个、少几个提交 */
function aheadBehind(state: MachineState, commitById: Map<string, Commit>): { ahead: number; behind: number } | null {
  if (state.main === undefined || state.origin === undefined) return null;
  const local = reachable([state.main], commitById);
  const remote = reachable([state.origin], commitById);
  return { ahead: [...local].filter((id) => !remote.has(id)).length, behind: [...remote].filter((id) => !local.has(id)).length };
}

/** 一台机器此刻的提交图，竖着画：每条线一列，提交一行一个、新的在上面；换一步时提交挪到新位置，新提交淡入 */
function MachineGraph({ item, machine, state }: { item: Case; machine: MachineId; state: MachineState }): JSX.Element {
  const commitById = new Map(item.commits.map((commit) => [commit.id, commit]));
  const refs = refsOf(machine, state, commitById);
  const visible = reachable(
    refs.map((ref) => ref.target),
    commitById,
  );
  const rows = item.commits.filter((commit) => visible.has(commit.id)).reverse();
  const rowOf = new Map(rows.map((commit, index) => [commit.id, index]));
  const laneOf = lanesOf(rows, state.main);
  const lanes = Math.max(...laneOf.values()) + 1;
  const x = (id: string): number => LEFT + laneOf.get(id)! * LANE_GAP;
  const y = (id: string): number => ROW / 2 + rowOf.get(id)! * ROW;
  const width = LEFT * 2 + (lanes - 1) * LANE_GAP;

  return (
    <div className="sc-rows" style={{ '--row': `${ROW}px`, '--graph-w': `${width}px`, height: rows.length * ROW } as CSSProperties}>
      <svg className="sc-graph" width={width} height={rows.length * ROW} aria-hidden="true">
        {rows.flatMap((commit) =>
          commit.parents
            .filter((parent) => visible.has(parent))
            .map((parentId, parentIndex) => {
              const parent = commitById.get(parentId)!;
              const d = edgePath(x(parentId), y(parentId), x(commit.id), y(commit.id), parentIndex === 0);
              return (
                <path
                  key={`${parentId}-${commit.id}`}
                  className="sc-edge"
                  data-role={authorRoles[(parentIndex === 0 ? commit : parent).by]}
                  style={{ d: `path('${d}')` } as CSSProperties}
                />
              );
            }),
        )}
        {rows.map((commit) => (
          <g key={commit.id} className="sc-node" style={{ transform: `translate(${x(commit.id)}px, ${y(commit.id)}px)` }}>
            <circle className="sc-commit" data-role={authorRoles[commit.by]} r={commit.parents.length > 1 ? 6 : 5} />
          </g>
        ))}
      </svg>
      <ol className="sc-messages">
        {rows.map((commit) => (
          <li key={commit.id} style={{ top: rowOf.get(commit.id)! * ROW }} title={commit.message}>
            {refs
              .filter((ref) => ref.target === commit.id)
              .map((ref) => (
                <span key={ref.label} className="sc-ref" data-role={ref.role}>
                  {ref.label}
                </span>
              ))}
            <span className="sc-message">{commit.message}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MachinePane({ item, machine, state, active }: { item: Case; machine: MachineId; state: MachineState; active: boolean }): JSX.Element {
  const commitById = new Map(item.commits.map((commit) => [commit.id, commit]));
  const info = machines[machine];
  const counts = aheadBehind(state, commitById);
  const title = item.repo === undefined ? info.title : `${info.title} · ${item.repo}`;
  const extra =
    counts === null ? null : counts.ahead === 0 && counts.behind === 0 ? '和 origin/main 一样' : `领先 ${counts.ahead} · 落后 ${counts.behind}`;
  return (
    <div className="sc-machine" data-active={active ? true : undefined}>
      <Pane title={title} role={info.role} icon={machine === 'gitea' ? 'server' : 'user'} extra={extra}>
        <MachineGraph item={item} machine={machine} state={state} />
        {machine === 'gitea' ? null : (
          <p className="sc-work" data-dirty={state.work === undefined ? undefined : true}>
            工作区：{state.work ?? '干净'}
          </p>
        )}
      </Pane>
    </div>
  );
}

function StepView({ item, index }: { item: Case; index: number }): JSX.Element {
  const event = item.events[index]!;
  const states = statesAt(item, index) as Record<MachineId, MachineState>;
  const outcome = outcomes[item.outcome];
  const actor = actors[event.who];
  return (
    <div className="sc-stage">
      <div className="sc-head">
        <Pill tone={outcome.tone} dot>
          {outcome.label}
        </Pill>
        {pullsSoFar(item.events, index).map((pull) => (
          <Pill key={pull.n} tone={pullTones[pull.state]}>
            #{pull.n} {pull.note}
          </Pill>
        ))}
      </div>
      <div className="sc-action" data-role={actor.role}>
        <span className="sc-who">{actor.name}</span>
        {event.cmd === undefined ? <span className="sc-nocmd">不运行 git 命令</span> : <code className="sc-cmd">$ {event.cmd}</code>}
      </div>
      <div className="sc-machines">
        {item.machines.map((machine) => (
          <MachinePane key={machine} item={item} machine={machine} state={states[machine] ?? {}} active={machineOf(event.who) === machine} />
        ))}
      </div>
      {event.showFile === true && item.file !== undefined ? (
        <Pane title={item.file.title} icon="file" role="rose">
          <CodeLines lines={item.file.lines} highlight={item.file.highlight} tone="bad" />
        </Pane>
      ) : null}
    </div>
  );
}

function Scenario({ item }: { item: Case }): JSX.Element {
  // 是谁做的已经写在画面上方，说明的标题只写第几步，免得和正文开头的人名重复
  const steps = item.events.map((event, index) => ({ title: `第 ${index + 1} 步`, text: event.what }));
  return (
    <div className="sc-scenario">
      <Stepper steps={steps} label={`${item.label}：一步一步看`} interval={3600}>
        {(_step, index) => <StepView item={item} index={index} />}
      </Stepper>
    </div>
  );
}

export function SubmitScenarios(): JSX.Element {
  // 换情况时按 key 整块重新挂载，从第一步开始
  return (
    <CasePicker cases={cases} label="各种情况下怎么协作">
      {(item) => <Scenario key={item.id} item={item} />}
    </CasePicker>
  );
}

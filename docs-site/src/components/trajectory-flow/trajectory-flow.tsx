'use client';
/**
 * 「一批轨迹卡文件怎么变成星轨盘」：上面一条固定的流水线，第几步就点亮第几段；下面是例子里的五个卡文件在这一段变成了什么
 * （字段表 → 读目录 → 校验结果 → 模型与树 → 布局落点 → 站上的页面）。
 * 讲解文字与例子都在 trajectory-flow.data.mjs，这里只负责画；机读版由 trajectory-flow.ai.mjs 读同一份数据生成。
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { CodeLines, Dot, Pane, Pill, Stepper, Terminal } from '@godcreator/docs-explain';
import {
  cardKeys,
  cardOf,
  cards,
  checks,
  clicks,
  codeOf,
  failedChecks,
  files,
  fumadocsLines,
  layout,
  model,
  pageLines,
  parsedExtras,
  readCalls,
  refForms,
  result,
  sick,
  stages,
  steps,
  terminals,
} from './trajectory-flow.data.mjs';

type Step = (typeof steps)[number];
type Card = (typeof cards)[number];
type CardCode = Card['code'];
type Place = (typeof layout.places)[number];

/* ── 流水线：六段固定不动，当前段点亮，走过的段留一道淡边 ── */

function Pipeline({ at }: { at: number }): JSX.Element {
  return (
    <ol className="tf-pipe" aria-label="流水线">
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          className="tf-stage"
          data-role={stage.role}
          data-state={index < at ? 'done' : index === at ? 'active' : 'todo'}
          aria-current={index === at ? 'step' : undefined}
        >
          <span className="tf-stage-head">
            <span className="tf-stage-no">{index + 1}</span>
            {stage.name}
          </span>
          <code className="tf-stage-pkg">{stage.pkg}</code>
          <code className="tf-stage-exp">{stage.exports}</code>
        </li>
      ))}
    </ol>
  );
}

/** 卡的短代号；病卡用 bad 语气 */
function Chip({ code, bad = false }: { code: CardCode; bad?: boolean }): JSX.Element {
  const card = cardOf(code);
  return (
    <span className="tf-chip" data-role={bad ? undefined : 'amber'} data-tone={bad ? 'bad' : undefined} title={`${card.id} · ${card.label}`}>
      {code}
    </span>
  );
}

const isRoot = (card: Card): boolean => card.fields.some(([key, value]) => key === 'type' && value === 'root');
const fieldOf = (card: Card, key: string): string | undefined => card.fields.find(([k]) => k === key)?.[1];

/* ── 第 1 步：字段表，点一行看原文 ── */

function FilesScene(): JSX.Element {
  const [picked, setPicked] = useState<CardCode>('R');
  const card = cardOf(picked);
  return (
    <div className="tf-stack">
      <Pane title={`${files.dir}/`} role="amber" icon="folder" extra="frontmatter 字段">
        <div className="tf-table-wrap">
          <table className="tf-table">
            <thead>
              <tr>
                <th>卡身份</th>
                {cardKeys.map((key) => (
                  <th key={key}>{key}</th>
                ))}
                <th>正文</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.code} data-picked={c.code === picked ? true : undefined}>
                  <td>
                    <button type="button" className="tf-row-btn" aria-pressed={c.code === picked} onClick={() => setPicked(c.code)}>
                      <Chip code={c.code} />
                      <span>{c.id}</span>
                    </button>
                  </td>
                  {cardKeys.map((key) => (
                    <td key={key} data-empty={fieldOf(c, key) === undefined ? true : undefined}>
                      {fieldOf(c, key) ?? '—'}
                    </td>
                  ))}
                  <td className="tf-cell-body">{c.body[0] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>
      <Pane title={card.file} role="amber" icon="file" extra={<Pill role="amber">{isRoot(card) ? '根卡' : '卡'}</Pill>}>
        <CodeLines lines={card.lines} highlight={[2, card.fields.length + 1]} tone="warn" />
      </Pane>
    </div>
  );
}

/* ── 第 2 步：scanCardDir 里依次发生的调用，D 正文里的记号报成病 ── */

function ReadScene(): JSX.Element {
  const d = cardOf('D');
  const markerLine = d.lines.findIndex((line) => line.startsWith('{/*')) + 1;
  if (markerLine === 0) throw new Error('例子里的 D 必须有一行 {/* ref … */} 记号');
  const problem = sick[0]?.problems.find((p) => p.field === 'docfirst');
  if (problem === undefined) throw new Error('例子的 sick 里缺 D 的 docfirst 病');
  return (
    <div className="tf-grid">
      <Pane title="scanCardDir（card-dir.ts）" role="blue" icon="terminal">
        <ol className="tf-calls">
          {readCalls.map((c, index) => (
            <li key={c.call} className="tf-call" data-role={c.role}>
              <span className="tf-call-no">{index + 1}</span>
              <code>{c.call}</code>
              <span className="tf-call-what">{c.what}</span>
            </li>
          ))}
        </ol>
        <div className="tf-caption">pickCardFiles 留下的文件</div>
        <ul className="tf-filelist">
          {cards.map((c) => (
            <li key={c.code}>
              <Chip code={c.code} />
              <code>{c.file}</code>
            </li>
          ))}
        </ul>
      </Pane>
      <div className="tf-stack">
        <Pane title={d.file} role="amber" icon="file" extra={<Pill tone="bad">第 {markerLine} 行是钉码记号</Pill>}>
          <CodeLines lines={d.lines} highlight={[markerLine, markerLine]} tone="bad" />
        </Pane>
        <Pane title="checkDocfirstRefs 认的两种记号（card-refs.ts）" role="blue">
          <ul className="tf-bullets">
            {refForms.map((form) => (
              <li key={form}>{form}</li>
            ))}
          </ul>
        </Pane>
        <Pane title="追加进 sick 的一条" role="blue">
          <CodeLines lines={JSON.stringify(problem, null, 2).split('\n')} />
        </Pane>
      </div>
    </div>
  );
}

/* ── 第 3 步：每张卡过每道校验的结果，加上 check 的输出 ── */

function ParseScene(): JSX.Element {
  return (
    <>
      <Pane title="scanCards 与 checkDocfirstRefs 的结果" role="violet">
        <div className="tf-table-wrap">
          <table className="tf-table tf-matrix">
            <thead>
              <tr>
                <th>卡</th>
                {checks.map((check) => (
                  <th key={check.id} data-role={check.role} title={check.rule}>
                    {check.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const failed = failedChecks[c.code] ?? [];
                return (
                  <tr key={c.code} data-sick={failed.length > 0 ? true : undefined}>
                    <td>
                      <span className="tf-row-label">
                        <Chip code={c.code} bad={failed.length > 0} />
                        {c.label}
                      </span>
                    </td>
                    {checks.map((check) => (
                      <td key={check.id} className="tf-cell-dot">
                        <Dot tone={failed.includes(check.id) ? 'bad' : 'good'} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="tf-rules">
          {checks.map((check) => (
            <div key={check.id} data-role={check.role}>
              <dt>{check.name}</dt>
              <dd>{check.rule}</dd>
            </div>
          ))}
        </dl>
      </Pane>
      <Pill tone="bad" dot>
        D 的 born-at 不合格：不上盘；其余的病只列出，不挡绘制
      </Pill>
      <div className="tf-grid">
        <Pane title="解析时从正文取出的" role="violet">
          <CodeLines lines={parsedExtras} />
        </Pane>
        <Terminal title={files.cwd} lines={terminals.check} />
      </div>
    </>
  );
}

/* ── 第 4 步：盘上的树与 buildTrajectory 交回的三样 ── */

function placeOf(id: string): Place {
  const place = layout.places.find((p) => p.id === id);
  if (place === undefined) throw new Error(`布局落点里没有 ${id}`);
  return place;
}

/** 树：横轴是 born-at 的日期，主干一行、支线一行 */
function TreeSvg(): JSX.Element {
  const dayOf = (id: string): number => Number(placeOf(id).day.slice(3));
  const firstDay = Math.min(...layout.places.map((p) => Number(p.day.slice(3))));
  const x = (id: string): number => 40 + (dayOf(id) - firstDay) * 48;
  const spineIds = model.tree.spine;
  const sublineIds = model.tree.sublines.flat();
  const y = (id: string): number => {
    if (spineIds.includes(id)) return 46;
    if (sublineIds.includes(id)) return 106;
    throw new Error(`${id} 不在例子的树里`);
  };
  const ids = [...spineIds, ...sublineIds];
  return (
    <svg className="tf-svg" viewBox="0 0 400 150" role="img" aria-label="盘上的树：主干 A → B，支线 S">
      <text className="tf-svg-note" x={4} y={20}>
        主干 spine
      </text>
      <text className="tf-svg-note" x={4} y={80}>
        支线 sublines
      </text>
      {model.edges.map((edge) => (
        <g key={`${edge.from}>${edge.to}`}>
          <line className="tf-edge" data-kind={edge.kind} x1={x(edge.from)} y1={y(edge.from)} x2={x(edge.to)} y2={y(edge.to)} />
          <text className="tf-svg-note" x={(x(edge.from) + x(edge.to)) / 2} y={(y(edge.from) + y(edge.to)) / 2 - 8} textAnchor="middle">
            {edge.kind === 'supersede' ? '取代' : '转向'}
          </text>
        </g>
      ))}
      {ids.map((id) => (
        <g key={id} className="tf-node" data-superseded={model.supersededIds.includes(id) ? true : undefined}>
          <circle cx={x(id)} cy={y(id)} r={13} />
          <text x={x(id)} y={y(id) + 4} textAnchor="middle">
            {codeOf(id)}
          </text>
        </g>
      ))}
      {ids.map((id) => (
        <text key={`day:${id}`} className="tf-svg-note" x={x(id)} y={142} textAnchor="middle">
          {placeOf(id).day}
        </text>
      ))}
    </svg>
  );
}

function ChipList({ ids, bad = [] }: { ids: readonly string[]; bad?: readonly string[] }): JSX.Element {
  if (ids.length === 0) return <span className="tf-dim">没有</span>;
  return (
    <span className="tf-chips">
      {ids.map((id) => (
        <Chip key={id} code={codeOf(id)} bad={bad.includes(id)} />
      ))}
    </span>
  );
}

function ModelScene(): JSX.Element {
  return (
    <>
      <div className="tf-grid">
        <Pane title={`${model.root.label} 的盘：一棵树`} role="violet" extra={<Pill role="violet">extractTrees</Pill>}>
          <TreeSvg />
          <dl className="tf-kv">
            <dt>被取代 supersededIds</dt>
            <dd>
              <ChipList ids={model.supersededIds} />
            </dd>
            <dt>孤星 isolated</dt>
            <dd>
              <ChipList ids={model.isolated} />
            </dd>
            <dt>领域顺序 domains</dt>
            <dd>{model.domains.join(' → ')}</dd>
          </dl>
        </Pane>
        <Pane title="buildTrajectory 交回的" role="violet" extra={<Pill role="violet">index.ts</Pill>}>
          <dl className="tf-kv">
            <dt>cards 全部卡</dt>
            <dd>
              <ChipList ids={result.cards} bad={result.sickFiles} />
            </dd>
            <dt>sick 病卡</dt>
            <dd>
              <ChipList ids={result.sickFiles} bad={result.sickFiles} />
            </dd>
            <dt>model.root 盘心</dt>
            <dd>
              <ChipList ids={[model.root.id]} />
            </dd>
            <dt>model.cards 盘上的卡</dt>
            <dd>
              <ChipList ids={model.cards} />
            </dd>
          </dl>
          <div className="tf-off">
            <Chip code="D" bad />
            <span>born-at 不合格：在 cards 与 sick 里，不在盘上</span>
          </div>
        </Pane>
      </div>
      <Terminal title={files.cwd} lines={terminals.trajectory} />
    </>
  );
}

/* ── 第 5 步：RingsLayout 的落点画成盘 ── */

/** 0 度指 12 点、顺时针，和 layout.ts 的 polar 同一个约定 */
function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
}

function wedgePath(th0: number, th1: number, r0: number, r1: number): string {
  const a = polar(th0, r0);
  const b = polar(th0, r1);
  const c = polar(th1, r1);
  const d = polar(th1, r0);
  return `M${a.x} ${a.y}L${b.x} ${b.y}A${r1} ${r1} 0 0 1 ${c.x} ${c.y}L${d.x} ${d.y}A${r0} ${r0} 0 0 0 ${a.x} ${a.y}Z`;
}

/** 按 RingsLayout 算出的真实落点画盘（世界坐标）；labels 为假时不写字 */
function DiskSvg({ labels }: { labels: boolean }): JSX.Element {
  const edge = layout.maxR + 60;
  const at = (id: string): { x: number; y: number } => {
    const place = placeOf(id);
    return polar(place.angBase, place.rLin);
  };
  const { th0, th1, rMin, rMax } = layout.treeBox;
  return (
    <svg className="tf-svg tf-disk" viewBox={`${-edge} ${-edge} ${2 * edge} ${2 * edge}`} role="img" aria-label="R 的盘：按 RingsLayout 的落点画出">
      <circle className="tf-ring" data-outer r={layout.maxR} />
      {layout.places.map((place) => (
        <g key={`ring:${place.id}`}>
          <circle className="tf-ring" r={place.rLin} />
          {labels ? (
            <text className="tf-svg-note tf-svg-big" x={0} y={-place.rLin - 18} textAnchor="middle">
              {place.day}
            </text>
          ) : null}
        </g>
      ))}
      <path className="tf-wedge" d={wedgePath(th0, th1, rMin - 15, rMax + 40)} />
      <circle className="tf-hub" r={layout.hubWorldR} />
      {labels ? (
        <text className="tf-hub-text" x={0} y={28} textAnchor="middle">
          R
        </text>
      ) : null}
      {model.edges.map((e) => {
        const from = at(e.from);
        const to = at(e.to);
        return <line key={`${e.from}>${e.to}`} className="tf-edge" data-kind={e.kind} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
      {layout.places.map((place) => {
        const p = at(place.id);
        return (
          <g key={place.id} className="tf-node" data-superseded={model.supersededIds.includes(place.id) ? true : undefined}>
            <circle cx={p.x} cy={p.y} r={36} />
            {labels ? (
              <text className="tf-svg-big" x={p.x} y={p.y - 80} textAnchor="middle">
                {codeOf(place.id)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function LayoutScene(): JSX.Element {
  const { th0, th1 } = layout.treeBox;
  return (
    <div className="tf-grid">
      <Pane title="new RingsLayout(model)：R 的盘" role="violet" extra={<Pill role="violet">layout.ts</Pill>}>
        <DiskSvg labels />
        <p className="tf-note">
          虚线环是三张卡所在的日期，越往外越新；浅色扇区是这棵树分到的角度 {th0.toFixed(0)}°–{th1.toFixed(1)}°，别的树会分到别的角度。A 被取代，画得淡。
        </p>
      </Pane>
      <Pane title="落点 places 与槽号 pos" role="violet">
        <div className="tf-table-wrap">
          <table className="tf-table">
            <thead>
              <tr>
                <th>卡</th>
                <th>日期</th>
                <th>rLin（半径）</th>
                <th>angBase（角度）</th>
                <th>pos</th>
              </tr>
            </thead>
            <tbody>
              {layout.places.map((place) => (
                <tr key={place.id}>
                  <td>
                    <Chip code={codeOf(place.id)} />
                  </td>
                  <td>{place.day}</td>
                  <td>{place.rLin}</td>
                  <td>{place.angBase.toFixed(1)}°</td>
                  <td>{place.pos === 0 ? '0 主干' : `${place.pos} 支线`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>
    </div>
  );
}

/* ── 第 6 步：/trajectory 整页与它的接线 ── */

function PageScene(): JSX.Element {
  return (
    <div className="tf-grid">
      <Pane title="/trajectory" role="cyan" icon="server" extra="整页（示意）">
        <div className="tf-topbar">
          <span>← 文档</span>
          <Pill tone="bad">报病 {sick.length}</Pill>
        </div>
        <DiskSvg labels={false} />
        <ul className="tf-clicks">
          {clicks.map((click) => (
            <li key={click.what}>
              <b>{click.what}</b>
              <span>→ {click.then}</span>
            </li>
          ))}
        </ul>
      </Pane>
      <div className="tf-stack">
        <Pane title={files.page} role="cyan" icon="file">
          {pageLines.map((block) => (
            <CodeLines key={block.start} lines={block.lines} start={block.start} />
          ))}
        </Pane>
        <Pane title="docfirst-fumadocs/trajectory（trajectory.ts）" role="emerald" icon="file">
          <CodeLines lines={fumadocsLines.lines} start={fumadocsLines.start} tone="good" highlight={[fumadocsLines.start + 1, fumadocsLines.start + fumadocsLines.lines.length - 2]} />
        </Pane>
      </div>
    </div>
  );
}

function Scene({ step }: { step: Step }): JSX.Element {
  switch (step.id) {
    case 'files':
      return <FilesScene />;
    case 'read':
      return <ReadScene />;
    case 'parse':
      return <ParseScene />;
    case 'model':
      return <ModelScene />;
    case 'layout':
      return <LayoutScene />;
    case 'page':
      return <PageScene />;
  }
}

export function TrajectoryFlow(): JSX.Element {
  return (
    <Stepper steps={steps} label="一批轨迹卡文件怎么变成星轨盘">
      {(step, index) => (
        <>
          <Pipeline at={index} />
          <Scene step={step} />
        </>
      )}
    </Stepper>
  );
}

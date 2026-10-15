'use client';
/**
 * RenderPipeline：一篇正本怎么变成三个落点。左块是正本 docs/a.mdx 的 13 行，按当前步的 marks 分段标记；
 * 右块每步换内容：解析出的节点、被钉的文件、渲染检查、写出的正文、三个落点、写出与核对的状态。
 * 数据都在 render-pipeline.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Dot, Pane, Pill, Stepper } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { bodySegments, firstWriteRows, greetLines, parsedNodes, pinPill, placementViews, recheckRows, refusalChecks, refusalExamples, sourceLines, steps } from './render-pipeline.data.mjs';
import type { Mark, RenderStep } from './render-pipeline.data.mjs';
import './render-pipeline.css';

/** 正本 13 行按 marks 切成连续的几段：标出的段带上标记，前后接上行号 */
function segmentsOf(marks: readonly Mark[]): Array<{ start: number; end: number; mark: Mark | null }> {
  const out: Array<{ start: number; end: number; mark: Mark | null }> = [];
  let at = 1;
  for (const mark of marks) {
    if (mark.lines[0] > at) out.push({ start: at, end: mark.lines[0] - 1, mark: null });
    out.push({ start: mark.lines[0], end: mark.lines[1], mark });
    at = mark.lines[1] + 1;
  }
  if (at <= sourceLines.length) out.push({ start: at, end: sourceLines.length, mark: null });
  return out;
}

function SourcePane({ step }: { step: RenderStep }): JSX.Element {
  return (
    <Pane title="正本 docs/a.mdx" icon="file" role="blue">
      {segmentsOf(step.marks).map(({ start, end, mark }) => (
        <div className="rp-source-seg" key={start}>
          <CodeLines lines={sourceLines.slice(start - 1, end)} start={start} highlight={mark === null ? null : [start, end]} tone={mark === null ? 'info' : mark.tone} />
          {mark === null ? null : (
            <span className="rp-seg-note">
              <Pill tone={mark.tone}>{mark.note}</Pill>
            </span>
          )}
        </div>
      ))}
    </Pane>
  );
}

/** 第 4 步的正文按着色分三段，行号接上 */
const bodyBlocks: Array<{ start: number; end: number; lines: string[]; tone: Tone | null }> = [];
{
  let at = 1;
  for (const segment of bodySegments) {
    const end = at + segment.lines.length - 1;
    bodyBlocks.push({ start: at, end, lines: segment.lines, tone: segment.tone });
    at = end + 1;
  }
}

function ArtifactPane({ step }: { step: RenderStep }): JSX.Element {
  switch (step.artifact.kind) {
    case 'nodes':
      return (
        <Pane title="解析出的节点" icon="terminal" role="violet">
          <ul className="rp-nodes">
            {parsedNodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Pane>
      );
    case 'pin':
      return (
        <Pane title="被钉的 src/greet.ts" icon="file" role="slate" extra={<Pill tone="good" dot>{pinPill}</Pill>}>
          <CodeLines lines={greetLines} highlight={[2, 3]} tone="info" />
        </Pane>
      );
    case 'refusals':
      return (
        <Pane title="查渲染不了的地方" icon="terminal" role="violet">
          <ul className="rp-checks">
            {refusalChecks.map((check) => (
              <li key={check.name}>
                <Dot tone="good" />
                <span className="rp-check-name">{check.name}</span>
                <span className="rp-check-result">{check.result}</span>
              </li>
            ))}
          </ul>
          <hr className="rp-divider" />
          <ul className="rp-examples">
            {refusalExamples.map((example) => (
              <li key={example}>
                <Dot tone="bad" />
                <span>如果「{example}」</span>
              </li>
            ))}
          </ul>
        </Pane>
      );
    case 'markdown':
      return (
        <Pane title="写出的正文" icon="file" role="emerald">
          {bodyBlocks.map(({ start, end, lines, tone }) => (
            <CodeLines key={start} lines={lines} start={start} highlight={tone === null ? null : [start, end]} tone={tone ?? 'info'} />
          ))}
        </Pane>
      );
    case 'placements':
      return (
        <div className="rp-files">
          <Pane title={placementViews.skill.title} role="emerald">
            <div className="rp-file-body">
              <CodeLines lines={placementViews.skill.headLines} highlight={placementViews.skill.highlight} tone="pending" />
              <span className="rp-more">{placementViews.more}</span>
            </div>
          </Pane>
          <Pane title={placementViews.plain.title} role="emerald">
            <div className="rp-file-body">
              <CodeLines lines={[placementViews.plain.firstLine]} />
              <span className="rp-more">{placementViews.more}</span>
            </div>
          </Pane>
          <Pane title={placementViews.bad.title} role="emerald">
            <div className="rp-file-body">
              <Pill tone="bad" dot>{placementViews.bad.pill}</Pill>
            </div>
          </Pane>
        </div>
      );
    case 'disk':
      return (
        <Pane title="写出与核对" icon="terminal" role="violet">
          <table className="rp-disk">
            <thead>
              <tr>
                <th>时机</th>
                <th>落点</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {[...firstWriteRows, ...recheckRows].map((row) => (
                <tr key={`${row.when}·${row.to}`}>
                  <td>{row.when}</td>
                  <td className="rp-disk-to">{row.to}</td>
                  <td>
                    <Pill tone={row.tone} dot>{row.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pane>
      );
  }
}

export function RenderPipeline(): JSX.Element {
  return (
    <Stepper steps={steps} label="一篇正本怎么变成三个落点">
      {(step) => (
        <div className="rp-stage">
          <p className="rp-legend">蓝底：钉码与代码块 · 绿底：组件与机读文字 · 琥珀底：frontmatter · 玫红：不写或拒绝</p>
          <div className="rp-panes">
            <SourcePane step={step} />
            <ArtifactPane step={step} />
          </div>
        </div>
      )}
    </Stepper>
  );
}

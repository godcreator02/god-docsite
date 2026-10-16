'use client';
/**
 * PartsGallery：六个零件各长什么样（上半，每格渲染真实零件、格底一行等宽字是最小写法）、
 * 两组颜色名各是什么颜色（下半，语气一排、角色色一排）。一屏摆完，不用外壳。
 * 写法与渲染数据的出处都在 parts-gallery.data.mjs 的注释里。
 */
import type { JSX } from 'react';
import { CodeLines, Diff, Dot, Pane, Pill, Terminal } from '@godcreator/explainer/site';
import { codeLines, codeSpan, diffSides, paneSteps, parts, roles, terminalLines, tones } from './parts-gallery.data.mjs';
import './parts-gallery.css';

/** 每格的舞台：按零件名渲染真实零件，渲染数据在数据文件里 */
function PartStage({ name }: { name: string }): JSX.Element {
  if (name === 'Pane') {
    return (
      <Pane title="核对：行段判定的四步" icon="terminal" role="violet">
        <ol className="pg-pane-steps">
          {paneSteps.map((step, index) => (
            <li key={step}>
              {index + 1}. {step}
            </li>
          ))}
        </ol>
      </Pane>
    );
  }
  if (name === 'Terminal') return <Terminal title="git merge carol" lines={terminalLines} />;
  if (name === 'Pill') return <Pill tone="good" dot>git 自动合上</Pill>;
  if (name === 'Dot') return <Dot tone="bad" />;
  if (name === 'CodeLines') return <CodeLines lines={codeLines} highlight={codeSpan} tone="info" />;
  if (name === 'Diff') return <Diff old={diffSides.old} now={diffSides.now} />;
  throw new Error(`认不出的零件：${name}`);
}

export function PartsGallery(): JSX.Element {
  return (
    <div className="dx pg-board not-prose">
      <div className="pg-parts">
        {parts.map((part) => (
          <figure key={part.name} className="pg-part">
            <figcaption className="pg-part-head">
              <span className="pg-part-name">{part.name}</span>
              <span className="pg-part-what">{part.what}</span>
            </figcaption>
            <div className="pg-part-stage">
              <PartStage name={part.name} />
            </div>
            <code className="pg-part-usage">{part.usage}</code>
          </figure>
        ))}
      </div>
      <div className="pg-tones">
        <div className="pg-row-label">
          语气 <span className="pg-label-mono">Tone</span>：说「这一项是什么状态」
        </div>
        <div className="pg-swatch-row">
          {tones.map((tone) => (
            <figure key={tone.name} className="pg-swatch">
              <span className="pg-tone-pair">
                <Dot tone={tone.name} />
                <Pill tone={tone.name} dot>{tone.word}</Pill>
              </span>
              <figcaption className="pg-swatch-name">{tone.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="pg-roles">
        <div className="pg-row-label">
          角色色 <span className="pg-label-mono">Role</span>：说「这个东西是哪个角色」
        </div>
        <div className="pg-swatch-row">
          {roles.map((role) => (
            <figure key={role.name} className="pg-swatch">
              <Pane title={role.title} role={role.name} />
              <figcaption className="pg-swatch-name">{role.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';
/**
 * ChapterAssembly：一份两章的报告怎样组装成一份。上面三张文件卡片（入口、a 章、b 章）标出这一步用到的行，
 * 下面「组装结果」卡片按步摆小表：接好的块、id 出处与图片改名、编号、解引用；第 5 步单独组装 b，
 * 入口与 a 两张卡片调淡，编号表里 eq_b 加粗。数据都在 chapter-assembly.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill, Stepper } from '@godcreator/explainer/site';
import type { Role } from '@godcreator/explainer/site';
import { aLines, bLines, rootLines, steps } from './chapter-assembly.data.mjs';
import type { AssemblyStep, FileId, ResultGroup } from './chapter-assembly.data.mjs';
import './chapter-assembly.css';

/** 三张文件卡片：入口灰、a 章蓝、b 章紫，全组件不换 */
const fileCards: Array<{ id: FileId; title: string; role: Role; lines: string[] }> = [
  { id: 'root', title: 'content.json', role: 'slate', lines: rootLines },
  { id: 'a', title: 'a/content.json', role: 'blue', lines: aLines },
  { id: 'b', title: 'b/content.json', role: 'violet', lines: bLines },
];

function FilePane({ file, step }: { file: (typeof fileCards)[number]; step: AssemblyStep }): JSX.Element {
  const extra = step.extra[file.id];
  return (
    <Pane title={file.title} icon="file" role={file.role} extra={extra === undefined ? undefined : <Pill>{extra}</Pill>}>
      <div className="ca-file" data-dim={step.dim.includes(file.id) ? 'dim' : undefined}>
        <CodeLines lines={file.lines} highlight={step.highlights[file.id]} tone="info" />
      </div>
    </Pane>
  );
}

/** 编号表里 id 前的小圆点，颜色跟着它出自的那一章；Dot 零件只收语气色，这里按 data-role 用本页样式上色 */
function ChapterDot({ chapter }: { chapter: 'a' | 'b' }): JSX.Element {
  return <span className="ca-chapter-dot" data-role={chapter === 'a' ? 'blue' : 'violet'} aria-hidden="true" />;
}

function ResultTable({ group }: { group: ResultGroup }): JSX.Element {
  return (
    <div className="ca-group">
      {group.title === undefined ? null : <div className="ca-group-title">{group.title}</div>}
      <table className="ca-rows">
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.key} data-strong={row.strong ? 'strong' : undefined}>
              <td className="ca-key">
                {row.chapter === undefined ? null : <ChapterDot chapter={row.chapter} />}
                {row.key}
              </td>
              <td className="ca-value">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultPane({ step }: { step: AssemblyStep }): JSX.Element {
  return (
    <Pane title="组装结果" icon="terminal" role="emerald">
      {step.groups.map((group) => (
        <ResultTable key={group.title ?? ''} group={group} />
      ))}
      {step.warning === undefined ? null : (
        <div className="ca-note">
          <Pill tone="warn" dot>提示 1 条</Pill>
          <span className="ca-note-text">{step.warning}</span>
        </div>
      )}
      {step.errorWithoutExternalLabel === undefined ? null : (
        <div className="ca-note">
          <Pill tone="bad" dot>不写 externalLabel 时</Pill>
          <code className="ca-note-code">{step.errorWithoutExternalLabel}</code>
        </div>
      )}
    </Pane>
  );
}

export function ChapterAssembly(): JSX.Element {
  return (
    <Stepper steps={steps} label="一份两章的报告怎样组装成一份">
      {(step) => (
        <div className="ca-stage">
          <div className="ca-files">
            {fileCards.map((file) => (
              <FilePane key={file.id} file={file} step={step} />
            ))}
          </div>
          <ResultPane step={step} />
        </div>
      )}
    </Stepper>
  );
}

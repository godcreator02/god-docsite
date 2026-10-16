'use client';
/**
 * CreateSteps：docfirst.create 怎么把一个空目录变成 docfirst 站，七步；前四步就是普通的 init。
 * 左边站目录的树随步长出新文件——这一步新出现的行前是 good 点，改写过的（package.json）标 info 点加「改」；
 * 右边摆这一步的命令（终端）或写进去的内容（卡片）；第 5 步起上方标「docfirst.create 多做的」。数据都在 create-steps.data.mjs。
 */
import type { JSX } from 'react';
import { Dot, Pane, Pill, Stepper, Terminal } from '@godcreator/explainer/site';
import { steps, treeNodes } from './create-steps.data.mjs';
import type { StepPane, TreeNode } from './create-steps.data.mjs';
import './create-steps.css';

function TreeRow({ node, upTo }: { node: TreeNode; upTo: number }): JSX.Element {
  const isNew = node.step === upTo;
  const isModified = node.modifiedSteps?.includes(upTo) === true;
  return (
    <li
      key={node.id}
      data-depth={node.depth}
      data-new={isNew || undefined}
      data-modified={isModified || undefined}
      data-dir={node.dir || undefined}
    >
      {isNew ? <Dot tone="good" /> : isModified ? <Dot tone="info" /> : <span className="cs-tree-blank" aria-hidden="true" />}
      <span className="cs-tree-name">{node.name}</span>
      {isModified ? <Pill tone="info">改</Pill> : null}
      {node.note !== undefined && !(isNew || isModified) ? <span className="cs-tree-note">{node.note}</span> : null}
    </li>
  );
}

function StepPaneView({ pane }: { pane: StepPane }): JSX.Element {
  if (pane.kind === 'terminal') return <Terminal title={pane.title} lines={pane.lines} />;
  return (
    <Pane title={pane.title} icon={pane.icon} role="violet">
      <div className="cs-lines">
        {pane.lines.map((line) => (
          <div key={line.text} className="cs-line" data-tone={line.tone}>
            {line.text}
          </div>
        ))}
      </div>
    </Pane>
  );
}

export function CreateSteps(): JSX.Element {
  return (
    <Stepper steps={steps} label="docfirst.create 的七步：前四步就是普通的 init">
      {(step, index) => {
        const upTo = index + 1;
        return (
          <div key={step.title} className="cs-stage">
            {step.pill ? (
              <div className="cs-pill-row">
                <Pill tone="info">docfirst.create 多做的</Pill>
              </div>
            ) : null}
            <div className="cs-columns">
              <Pane title="站目录" icon="folder" role="blue">
                <ul className="cs-tree">
                  {treeNodes
                    .filter((node) => node.step <= upTo)
                    .map((node) => (
                      <TreeRow key={node.id} node={node} upTo={upTo} />
                    ))}
                </ul>
              </Pane>
              <StepPaneView pane={step.pane} />
            </div>
          </div>
        );
      }}
    </Stepper>
  );
}

'use client';
/**
 * FeatureIndexSteps：五份汇总文件怎么随功能目录变。上面一行是这一步的调用与交回，中间左边是站点 app/features/
 * 里到这一步为止的功能目录（四种格子按文件着色，目录里没有的画调淡的灰格子），右边是五份汇总文件：
 * 写出空的与改了的展开画随功能变的行，没变的只画标题栏。下面一行图例。数据都在 feature-index-steps.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill, Stepper } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { featureFiles, fileRoles, indexFiles, steps } from './feature-index-steps.data.mjs';
import type { FeatureIndexStep, IndexStatus, StepDir } from './feature-index-steps.data.mjs';
import './feature-index-steps.css';

const statusText: Record<IndexStatus, string> = { empty: '写出空的', changed: '改了', same: '这一步没变', rewritten: '重写，内容没变' };
const statusTone: Record<IndexStatus, Tone | undefined> = { empty: 'info', changed: 'warn', same: undefined, rewritten: 'good' };

function DirRow({ dir }: { dir: StepDir }): JSX.Element {
  return (
    <div className="fi-dir" data-new={dir.isNew || undefined}>
      <div className="fi-dir-line">
        <span className="fi-dir-name">{dir.name}</span>
        <span className="fi-cells">
          {featureFiles.map((file) =>
            dir.recognized.includes(file) ? (
              <Pill key={file} role={fileRoles[file]}>
                {file}
              </Pill>
            ) : (
              <span key={file} className="fi-cell">
                {file}
              </span>
            ),
          )}
        </span>
        {dir.collections.map((name) => (
          <Pill key={name} role="emerald">
            集合 {name}
          </Pill>
        ))}
        {dir.isNew ? <Pill tone="info">这一步补进</Pill> : null}
        {dir.keptNote !== null ? <Pill tone="good">{dir.keptNote}</Pill> : null}
      </div>
      {dir.unrecognizedNote === null ? null : <div className="fi-note">{dir.unrecognizedNote}</div>}
    </div>
  );
}

function StepView({ step }: { step: FeatureIndexStep }): JSX.Element {
  return (
    <div className="fi-stage">
      <div className="fi-top">
        <Pill role="rose">{step.call}</Pill>
        <span className="fi-returns">{step.returns}</span>
      </div>
      <div className="fi-mid">
        <Pane title="站点 app/features/" icon="file" role="slate">
          {step.dirs.length === 0 ? (
            <div className="fi-note">空的</div>
          ) : (
            <div className="fi-dirs">
              {step.dirs.map((dir) => (
                <DirRow key={dir.name} dir={dir} />
              ))}
            </div>
          )}
        </Pane>
        <div className="fi-index">
          {indexFiles.map(({ key, file, role }) => {
            const state = step.generated[key];
            return (
              <Pane key={key} title={file} icon="file" role={role} extra={<Pill tone={statusTone[state.status]}>{statusText[state.status]}</Pill>}>
                {state.status === 'empty' || state.status === 'changed' ? (
                  <CodeLines lines={state.lines ?? []} added={state.added} changed={state.changed} />
                ) : null}
              </Pane>
            );
          })}
        </div>
      </div>
      <div className="fi-legend">
        <span className="fi-cells">
          {featureFiles.map((file) => (
            <Pill key={file} role={fileRoles[file]}>
              {file}
            </Pill>
          ))}
        </span>
        <span className="fi-cell">没有的文件</span>
        <span>调淡的灰格子表示目录里没有这种文件；带 + 的行是新出现的，画波浪线的行是改了的</span>
      </div>
    </div>
  );
}

export function FeatureIndexSteps(): JSX.Element {
  return (
    <Stepper steps={steps} interval={6000} label="五份汇总文件怎么随功能目录变">
      {(step) => <StepView key={step.id} step={step} />}
    </Stepper>
  );
}

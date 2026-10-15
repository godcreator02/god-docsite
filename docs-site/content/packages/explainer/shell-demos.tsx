'use client';
/**
 * 三种外壳的最小例子：左块是画面函数拿到的参数，右块是同一份数据经机读文字函数（stepsText 等）转出的段落，
 * 当前这一项亮起。控制条与说明行由外壳画，这里只画画面。数据在 shell-demos.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Stepper, Timeline } from '@godcreator/explainer/site';
import { casesText, chaptersText, stepsText } from '@godcreator/explainer';
import { cases, chapters, steps } from './shell-demos.data.mjs';
import './shell-demos.css';

/** 左块：画面函数拿到的参数，一行一个键值；progress 给了就再画一条细进度条 */
function ParamsPane({ rows, progress }: { rows: [string, string][]; progress?: number }): JSX.Element {
  return (
    <Pane title="画面函数拿到的参数" icon="terminal" role="violet">
      <dl className="sd-kv">
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {progress === undefined ? null : (
        <div className="sd-progress" aria-hidden="true">
          <div className="sd-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </Pane>
  );
}

/** 右块：机读文字函数交回的每一行，当前这一项亮起 */
function TextPane({ title, lines, current }: { title: string; lines: readonly string[]; current: number }): JSX.Element {
  return (
    <Pane title={title} icon="file" role="amber">
      <ol className="sd-lines">
        {lines.map((line, index) => (
          <li key={index} data-current={index === current}>
            {line}
          </li>
        ))}
      </ol>
    </Pane>
  );
}

export function StepperDemo(): JSX.Element {
  return (
    <Stepper steps={steps} label="分步外壳的最小例子">
      {(step, index) => (
        <div className="sd-stage">
          <ParamsPane
            rows={[
              ['step.title', step.title],
              ['step.text', step.text],
              ['index', String(index)],
            ]}
          />
          <TextPane title="机读文字（stepsText 交回的）" lines={stepsText(steps)} current={index} />
        </div>
      )}
    </Stepper>
  );
}

export function TimelineDemo(): JSX.Element {
  return (
    <Timeline chapters={chapters} label="动画外壳的最小例子">
      {({ time, chapter, index, progress }) => (
        <div className="sd-stage">
          <ParamsPane
            rows={[
              ['time', `${time.toFixed(2)} 秒`],
              ['chapter.title', chapter.title],
              ['index', String(index)],
              ['progress', progress.toFixed(2)],
            ]}
            progress={progress}
          />
          <TextPane title="机读文字（chaptersText 交回的）" lines={chaptersText(chapters)} current={index} />
        </div>
      )}
    </Timeline>
  );
}

export function CasePickerDemo(): JSX.Element {
  return (
    <CasePicker cases={cases} label="选情况外壳的最小例子">
      {(item) => (
        <div className="sd-stage">
          <ParamsPane
            rows={[
              ['item.id', item.id],
              ['item.label', item.label],
            ]}
          />
          <TextPane
            title="机读文字（casesText 交回的）"
            lines={casesText(cases)}
            current={cases.findIndex((item2) => item2.id === item.id)}
          />
        </div>
      )}
    </CasePicker>
  );
}

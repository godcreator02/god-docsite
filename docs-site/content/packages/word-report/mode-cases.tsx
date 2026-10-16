'use client';
/**
 * ModeCases：同一处跨章引用，整份组装与单独组装一章时结果不同。
 * 左卡片摆章 b 里那处引用的 JSON（CodeLines），右卡片摆组装结果——换成编号、换成文字加一条提示、报错原话；
 * 右卡片标题带结论胶囊，底部一行胶囊写模式名与调用方。数据都在 mode-cases.data.mjs（原话钉在那一文件里）。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill } from '@godcreator/explainer/site';
import { cases } from './mode-cases.data.mjs';
import type { ResultLine } from './mode-cases.data.mjs';
import './mode-cases.css';

function ResultLineRow({ line, first, tone }: { line: ResultLine; first: boolean; tone: 'good' | 'warn' | 'bad' }): JSX.Element {
  return (
    <div className="mc-line" data-mono={line.mono ? 'true' : undefined}>
      {first ? <Dot tone={tone} /> : <span className="mc-dot-none" aria-hidden="true" />}
      <span>{line.text}</span>
    </div>
  );
}

export function ModeCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="同一处跨章引用在三种组装下的结果">
      {(item) => (
        <div key={item.id} className="mc-case">
          <div className="mc-panes">
            <Pane title="章 b 里那处引用" icon="file" role="violet" extra={<span className="mc-note">b/content.json</span>}>
              <CodeLines lines={item.refLines} highlight={item.highlight ?? undefined} tone="info" />
            </Pane>
            <Pane
              title="组装结果"
              icon="terminal"
              role="emerald"
              extra={<Pill tone={item.tone} dot>{item.pill}</Pill>}
            >
              <div className="mc-lines">
                {item.lines.map((line, index) => (
                  <ResultLineRow key={line.text} line={line} first={index === 0} tone={item.tone} />
                ))}
              </div>
            </Pane>
          </div>
          <div className="mc-mode">
            <Pill>{item.mode}</Pill>
          </div>
        </div>
      )}
    </CasePicker>
  );
}

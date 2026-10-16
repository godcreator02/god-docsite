'use client';
/**
 * LoaderSteps：一组虚拟文件进 loader() 以后，五步里各变成什么。
 * 每步左边一张卡片摆这一步手里的数据（配置、两个 Map、算出的 slug、四张 Map 的索引、建好的树），
 * 右边一句说明加这一步对应的 GitHub 源码链接。数据都在 loader-steps.data.mjs。
 */
import type { JSX } from 'react';
import { Pane, Stepper } from '@godcreator/explainer/site';
import { steps } from './loader-steps.data.mjs';
import type { SourceRef } from './loader-steps.data.mjs';
import './loader-steps.css';

function SrcLink({ link }: { link: SourceRef }): JSX.Element {
  return (
    <a className="ls-src" href={link.url} target="_blank" rel="noreferrer">
      {link.file} ↗
    </a>
  );
}

export function LoaderSteps(): JSX.Element {
  return (
    <Stepper steps={steps} interval={7000} label="loader() 内部五步：四个虚拟文件各变成什么">
      {(step) => (
        <div key={step.title} className="ls-stage">
          <Pane title={step.cardTitle} icon="terminal" role="blue">
            <pre className="ls-lines">{step.lines.join('\n')}</pre>
          </Pane>
          <div className="ls-side">
            <p className="ls-note">{step.note}</p>
            <SrcLink link={step.srcRef} />
            {step.srcRef2 === undefined ? null : <SrcLink link={step.srcRef2} />}
          </div>
        </div>
      )}
    </Stepper>
  );
}

'use client';
/**
 * Normalize：站上显示什么就哈希什么。左卡是工作区里的那段（␍␊ 是 CRLF 行尾，· 是空格与末尾空行），
 * 中卡是归一化以后（缩进与注释原样保留），右卡是段哈希的示意值与两行对照。数据都在 normalize.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { hashRows, hashSample, normalizedLines, rawLines } from './normalize.data.mjs';
import './normalize.css';

export function Normalize(): JSX.Element {
  return (
    <div className="dx nz-row not-prose">
      <Pane title="工作区里的那段" icon="file" role="slate" extra={<span className="nz-mark">␍␊ 行尾 · 空白</span>}>
        <CodeLines lines={rawLines} />
      </Pane>
      <Pane title="归一化以后" icon="file" role="blue" extra={<span className="nz-mark">缩进与注释原样</span>}>
        <CodeLines lines={normalizedLines} />
      </Pane>
      <Pane title="段哈希" icon="git" role="violet">
        <div className="nz-hash">{hashSample}</div>
        <ul className="nz-rows">
          {hashRows.map((row) => (
            <li key={row.left}>
              <Pill tone={row.tone} dot>
                {row.right}
              </Pill>
              <span className="nz-row-left">{row.left}</span>
            </li>
          ))}
        </ul>
      </Pane>
    </div>
  );
}

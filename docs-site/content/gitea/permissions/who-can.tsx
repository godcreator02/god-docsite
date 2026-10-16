'use client';
/**
 * WhoCanCases：同一个人想做同一件事，四层权限里是哪一层放行或拦下。
 * 四条横带从上到下是团队、协作者（负责人）、main 的分支保护、合并方式，各写这一层在这种情况说了什么；
 * 拦下的那一层加粗强调，不相关的灰掉；最下面一行结果胶囊。数据都在 who-can.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Dot, Pill } from '@godcreator/explainer/site';
import type { Tone } from '@godcreator/explainer/site';
import { cases, layers } from './who-can.data.mjs';
import type { RowState } from './who-can.data.mjs';
import './who-can.css';

const stateTone: Record<RowState, Tone> = { pass: 'good', block: 'bad', dim: 'pending' };

export function WhoCanCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="四层里哪一层说了算">
      {(item) => (
        <div key={item.id} className="wc-board">
          {layers.map((layer, index) => {
            const row = item.rows[index]!;
            return (
              <div key={layer.id} className="wc-row" data-state={row.state}>
                <span className="wc-layer">{layer.name}</span>
                <Dot tone={stateTone[row.state]} />
                <span className="wc-what">{row.what}</span>
              </div>
            );
          })}
          <div className="wc-outcome">
            <span className="wc-outcome-label">结果</span>
            <Pill tone={item.outcome.tone} dot>
              {item.outcome.label}
            </Pill>
          </div>
        </div>
      )}
    </CasePicker>
  );
}

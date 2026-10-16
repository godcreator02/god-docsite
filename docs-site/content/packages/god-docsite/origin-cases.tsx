'use client';
/**
 * OriginCases：写入请求的 Origin 头要对上的值（siteOrigin）怎么算。五种情况各两块：
 * 左「环境变量」列这种情况下有的几项（没有的灰掉），右「siteOrigin」写算出的值或报错原话；
 * dev 情况多一组「浏览器发来的 Origin」——对上能写、对不上 403 各一次。数据都在 origin-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane } from '@godcreator/explainer/site';
import { cases } from './origin-cases.data.mjs';
import './origin-cases.css';

export function OriginCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="可信 origin 怎么算：五种情况">
      {(item) => (
        <div key={item.id} className="oc-stage">
          <Pane title="环境变量" icon="terminal" role="cyan">
            <div className="oc-mode">mode: {item.mode}</div>
            <ul className="oc-vars">
              {item.vars.map((envVar) => (
                <li key={envVar.name} data-absent={!envVar.present || undefined}>
                  <span className="oc-var-name">{envVar.name}</span>
                  <span className="oc-var-value">{envVar.present ? `= ${envVar.value}` : envVar.note}</span>
                </li>
              ))}
            </ul>
          </Pane>
          <Pane title="siteOrigin" icon="server" role="blue">
            <div className="oc-outcome" data-tone={item.outcome.tone}>
              {item.outcome.lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
            {item.checks.length === 0 ? null : (
              <ul className="oc-checks">
                {item.checks.map((check) => (
                  <li key={check.text} data-tone={check.tone}>
                    {check.text}
                  </li>
                ))}
              </ul>
            )}
          </Pane>
        </div>
      )}
    </CasePicker>
  );
}

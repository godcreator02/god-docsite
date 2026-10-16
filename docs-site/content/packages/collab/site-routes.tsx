'use client';
/**
 * SiteRoutes：站点上的数据只走三条路——读、写、通知，每种情况一条从上到下的链。
 * 每张卡片是一个环节、写它手里的真实东西，卡与卡之间一个向下的箭头；每种情况末尾一行灰字（站点不跑 git）。
 * 数据都在 site-routes.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane } from '@godcreator/explainer/site';
import { cases, footer } from './site-routes.data.mjs';
import './site-routes.css';

export function SiteRoutes(): JSX.Element {
  return (
    <CasePicker cases={cases} label="站点上的数据走三条路">
      {(item) => (
        <div key={item.id} className="sr-chain">
          {item.chain.map((card, index) => (
            <div key={card.title} className="sr-step">
              {index === 0 ? null : <div className="sr-arrow" aria-hidden="true">↓</div>}
              <Pane title={card.title} icon="git" role="blue">
                <ul className="sr-lines">
                  {card.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Pane>
            </div>
          ))}
          <p className="sr-footer">{footer}</p>
        </div>
      )}
    </CasePicker>
  );
}

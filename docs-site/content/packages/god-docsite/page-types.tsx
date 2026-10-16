'use client';
/**
 * PageTypes：MDX、TSX、HTML 三种页面进同一棵页面树、同一个搜索索引，loader 按 type 给浏览器不同的东西。
 * 每种情况是一条从上到下的四卡链（照 site-routes 的竖排链）：文件 → 来源 → sitePageData 交给浏览器的 → 浏览器怎么显示，
 * 第二张卡三种情况标同一种角色色（同一个 loader）。数据都在 page-types.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane } from '@godcreator/explainer/site';
import { cases, footer } from './page-types.data.mjs';
import './page-types.css';

export function PageTypes(): JSX.Element {
  return (
    <CasePicker cases={cases} label="三种页面怎么进同一棵页面树">
      {(item) => (
        <div key={item.id} className="pt-chain">
          {item.chain.map((card, index) => (
            <div key={card.title} className="pt-step">
              {index === 0 ? null : (
                <div className="pt-arrow" aria-hidden="true">
                  ↓
                </div>
              )}
              <Pane title={card.title} icon={card.icon} role={card.role}>
                <ul className="pt-lines">
                  {card.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Pane>
            </div>
          ))}
          <p className="pt-footer">{footer}</p>
        </div>
      )}
    </CasePicker>
  );
}

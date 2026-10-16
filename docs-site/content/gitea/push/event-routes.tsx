'use client';
/**
 * EventRoutes：Gitea 上一件事 → webhook 请求体里起作用的字段 → ntfy 只带位置的消息 → 插件按仓分给哪一套 → 去 Gitea 取哪一处。
 * 每种情况一条从上到下的链（照 collab 页 SiteRoutes 的竖排链），卡与卡之间一个向下的箭头；
 * 五张卡的角色色固定：Gitea amber、请求体 slate、ntfy 消息 emerald、插件 blue、去取什么 slate。
 * 数据都在 event-routes.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane } from '@godcreator/explainer/site';
import type { Role } from '@godcreator/explainer/site';
import { cases, footer } from './event-routes.data.mjs';
import './event-routes.css';

const cardRole: Role[] = ['amber', 'slate', 'emerald', 'blue', 'slate'];
const cardIcon = ['git', 'file', 'server', 'user', 'terminal'] as const;

export function EventRoutes(): JSX.Element {
  return (
    <CasePicker cases={cases} label="一件事怎样变成一条消息、插件收到后做什么">
      {(item) => (
        <div key={item.id} className="er-chain">
          {item.chain.map((card, index) => (
            <div key={card.title} className="er-step">
              {index === 0 ? null : <div className="er-arrow" aria-hidden="true">↓</div>}
              <Pane title={card.title} icon={cardIcon[index]} role={cardRole[index]}>
                <ul className="er-lines">
                  {card.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Pane>
            </div>
          ))}
          <p className="er-footer">{footer}</p>
        </div>
      )}
    </CasePicker>
  );
}

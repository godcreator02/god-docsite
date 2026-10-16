'use client';
/**
 * PublicShape：存在文件里的人带 codes，交给浏览器前按白名单重造，codes 不会跟着交给浏览器。
 * 三张卡横排（窄屏竖排）：存在文件里（StoredPerson）→ publicPersonOf 只抄四项 → 浏览器拿到（PublicPerson）。
 * 下面两行：带着 codes 的对象直接交给 IdentityProvider 的流向，加渲染时报错的原话。数据都在 public-shape.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill } from '@godcreator/explainer/site';
import { copyLines, providerError, publicLines, storedLines } from './public-shape.data.mjs';
import './public-shape.css';

export function PublicShape(): JSX.Element {
  return (
    <div className="dx ps-board not-prose">
      <div className="ps-panes">
        <Pane title="存在文件里（StoredPerson）" icon="file" role="emerald">
          <CodeLines lines={storedLines} highlight={[4, 4]} tone="bad" />
          <div className="ps-note">codes 只在服务端用</div>
        </Pane>
        <Pane title="publicPersonOf 只抄四项" icon="git" role="violet">
          <CodeLines lines={copyLines} />
          <div className="ps-note">id、name、gitea、agent</div>
        </Pane>
        <Pane title="浏览器拿到（PublicPerson）" icon="user" role="amber">
          <CodeLines lines={publicLines} />
          <div className="ps-note">没有 codes</div>
        </Pane>
      </div>
      <div className="ps-leak">
        <div className="ps-leak-flow">
          <span className="ps-leak-obj">{'{ id: "zhou", name: "小周", codes: ["zhoucode0001"] }'}</span>
          <span className="ps-arrow" aria-hidden="true">
            →
          </span>
          <code className="ps-leak-target">IdentityProvider</code>
          <Pill tone="bad" dot>
            渲染时报错
          </Pill>
        </div>
        <div className="ps-leak-reason">{providerError}</div>
      </div>
    </div>
  );
}

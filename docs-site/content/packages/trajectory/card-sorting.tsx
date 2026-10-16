'use client';
/**
 * CardSorting：11 个文件交给汇总以后分到哪三处（盘心、上盘、病卡），以及为什么。
 * 上面一行是十一个文件的标签，颜色对到它去的那一栏；下面三栏静态摆开，窄屏竖排，不用动画。
 * 数据都在 card-sorting.data.mjs；病卡理由是 core 报病时的原话（数据里钉了码）。
 */
import type { JSX } from 'react';
import { Dot, Pane } from '@godcreator/explainer/site';
import { centerCard, diskCards, files, note, sickCard } from './card-sorting.data.mjs';
import type { MiniCard } from './card-sorting.data.mjs';
import './card-sorting.css';

function CardRow({ card, badDate }: { card: MiniCard; badDate?: boolean }): JSX.Element {
  return (
    <div className="cs-card">
      <span className="cs-mark">{card.mark}</span>
      <span className="cs-label">{card.label}</span>
      <span className={badDate ? 'cs-date cs-date-bad' : 'cs-date'}>{card.bornAt}</span>
    </div>
  );
}

export function CardSorting(): JSX.Element {
  return (
    <div className="dx cs-box not-prose">
      <div className="cs-files" aria-label="trajectory/ 下的 11 个文件，颜色对应去处">
        {files.map((f) => (
          <span key={f.mark} className="cs-file" data-dest={f.dest} title={f.name}>
            {f.mark}
          </span>
        ))}
      </div>
      <div className="cs-panes">
        <Pane title="盘心（center）" icon="user" role="slate">
          <CardRow card={centerCard} />
          <p className="cs-pane-note">根卡恰好一张时它是盘心</p>
        </Pane>
        <Pane title="上盘（cards）" icon="file" role="blue">
          <ul className="cs-cards">
            {diskCards.map((c) => (
              <li key={c.mark}>
                <CardRow card={c} />
              </li>
            ))}
          </ul>
          <p className="cs-pane-note">born-at 合格的 9 张全部上盘</p>
        </Pane>
        <Pane title="病卡（sick）" icon="terminal" role="rose">
          <CardRow card={sickCard} badDate />
          <div className="cs-reason">
            <Dot tone="bad" />
            <span>{sickCard.reason}</span>
          </div>
        </Pane>
      </div>
      <p className="cs-note">{note}</p>
    </div>
  );
}

'use client';
/**
 * QqTiming：QQ 私聊只发新出现、连续存在满 1 分钟的；期间消失过从头算；有一批里有 check-error 时已发的一个都不去掉。
 * 顶上一条时间轴（游标跟当前时刻走）；下面几行——此刻交来的通知、等待中的计时、已发的 id（qq-sent-notifications
 * 的内容）、发出的私聊气泡。画面是时间的纯函数：拖到哪一刻都画得出那一刻的样子。数据在 qq-timing.data.mjs。
 */
import type { JSX } from 'react';
import { Pill, Timeline } from '@godcreator/explainer/site';
import { chapters, chatLines, exampleNotification, sentNotificationsDocKey, timeline } from './qq-timing.data.mjs';
import './qq-timing.css';

function Axis({ time }: { time: number }): JSX.Element {
  const pct = (t: number): string => `${(t / timeline.totalSeconds) * 100}%`;
  return (
    <div className="qt-axis" aria-hidden="true">
      <span className="qt-axis-unit">秒</span>
      <div className="qt-axis-line" />
      {timeline.ticks.map((tick) => (
        <span
          key={tick}
          className="qt-tick"
          style={{ left: pct(tick) }}
          data-end={tick === 0 ? 'start' : tick === timeline.totalSeconds ? 'end' : undefined}
          data-shift={tick === 10 ? 'right' : undefined}
        >
          <span className="qt-tick-label">{tick}</span>
          <i className="qt-tick-mark" />
        </span>
      ))}
      <i className="qt-cursor" style={{ left: pct(time) }} />
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: JSX.Element }): JSX.Element {
  return (
    <div className="qt-row">
      <span className="qt-row-label">
        {label}
        {sub !== undefined ? <span className="qt-row-sub">{sub}</span> : null}
      </span>
      <div className="qt-row-body">{children}</div>
    </div>
  );
}

function Stage({ time }: { time: number }): JSX.Element {
  const { appearAt, sendAfter, failAt, recoverAt } = timeline;
  const sentAt = appearAt + sendAfter;
  const waiting = time >= appearAt && time < sentAt;
  const failing = time >= failAt && time < recoverAt;
  const sent = time >= sentAt;
  const waitElapsed = Math.min(Math.max(time - appearAt, 0), sendAfter);
  return (
    <div className="qt-stage">
      <Axis time={time} />
      <Row label="此刻交来的通知">
        {time < appearAt ? (
          <span className="qt-dim-text">完整刷新还没做完，一个也不交给 QQ</span>
        ) : failing ? (
          <>
            <Pill tone="bad" dot>
              {exampleNotification.checkError}
            </Pill>
            <span className="qt-dim-text">#7 读不到，看起来像消失了</span>
          </>
        ) : (
          <Pill tone="info" dot>
            {exampleNotification.sentence}
          </Pill>
        )}
      </Row>
      <Row label="等待中的计时">
        {waiting ? (
          <>
            <div className="qt-progress">
              <div className="qt-progress-fill" style={{ width: `${(waitElapsed / sendAfter) * 100}%` }} />
            </div>
            <span className="qt-progress-note">
              连续存在 {Math.round(waitElapsed)} / {sendAfter} 秒
            </span>
          </>
        ) : (
          <span className="qt-dim-text">{sent ? '发过的不再等待' : '没有在等的'}</span>
        )}
      </Row>
      <Row label="已发的 id" sub={sentNotificationsDocKey}>
        {sent ? (
          <>
            <code className="qt-sent-id">{exampleNotification.id}</code>
            {failing ? <span className="qt-dim-text">这批里有 check-error，一个都不去掉</span> : null}
          </>
        ) : (
          <span className="qt-dim-text">还没有发过的</span>
        )}
      </Row>
      <Row label="发出的私聊">
        {sent ? (
          <div className="qt-bubble">
            {chatLines.map((line) => (
              <span key={line} className="qt-bubble-line">
                {line}
              </span>
            ))}
          </div>
        ) : (
          <span className="qt-dim-text">还没发出</span>
        )}
      </Row>
    </div>
  );
}

export function QqTiming(): JSX.Element {
  return (
    <Timeline chapters={chapters} label="QQ 私聊什么时候发">
      {({ time }) => <Stage key="stage" time={time} />}
    </Timeline>
  );
}

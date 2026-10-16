'use client';
/**
 * FeedSteps：推送通道从启动到浏览器跟着变的五步。
 * 左边 gwb-docsite、站点进程（频道表）、浏览器三个方块竖排，当前这一步经手的方块亮起、
 * 它们之间的箭头写这一步传的东西；右边一张卡片写这一步的真实内容。数据都在 feed-steps.data.mjs。
 */
import { Fragment, type JSX } from 'react';
import { Dot, Pane, Stepper } from '@godcreator/explainer/site';
import { actors, steps } from './feed-steps.data.mjs';
import type { FeedFlow, FeedStep, StepLine } from './feed-steps.data.mjs';
import './feed-steps.css';

/** actor 配的颜色（与页面里其他组件一致：插件 rose、站点服务端 blue、浏览器 emerald） */
const actorRoles: Record<string, string> = { gwb: 'rose', site: 'blue', browser: 'emerald' };

function Row({ line }: { line: StepLine }): JSX.Element {
  return (
    <div className="fs-row" data-tone={line.tone}>
      {line.tone === 'none' ? <span className="fs-dot-none" aria-hidden="true" /> : <Dot tone={line.tone} />}
      <span>{line.text}</span>
    </div>
  );
}

/** 两个相邻方块之间这一步点亮的箭头（from、to 都在这两个方块上的才算） */
function flowsBetween(flows: FeedFlow[], upper: string, lower: string): FeedFlow[] {
  return flows.filter((flow) => (flow.from === upper && flow.to === lower) || (flow.from === lower && flow.to === upper));
}

function FlowSlot({ flows, upper, lower }: { flows: FeedFlow[]; upper: string; lower: string }): JSX.Element {
  const active = flowsBetween(flows, upper, lower);
  return (
    <div className="fs-flows">
      {active.length === 0 ? (
        <span className="fs-idle" aria-hidden="true" />
      ) : (
        active.map((flow) => (
          <span key={flow.label} className="fs-flow">
            <span className="fs-flow-arrow" aria-hidden="true">
              {flow.from === upper ? '↓' : '↑'}
            </span>
            <span className="fs-flow-label">{flow.label}</span>
          </span>
        ))
      )}
    </div>
  );
}

export function FeedSteps(): JSX.Element {
  return (
    <Stepper steps={steps} label="推送通道：令牌怎么给、数据怎么流">
      {(step: FeedStep) => (
        <div key={step.title} className="fs-stage">
          <div className="fs-actors">
            {actors.map((actor, index) => (
              <Fragment key={actor.id}>
                {index === 0 ? null : <FlowSlot flows={step.flows} upper={actors[index - 1].id} lower={actor.id} />}
                <div
                  className="fs-actor"
                  data-role={actorRoles[actor.id]}
                  data-active={step.active.includes(actor.id) || undefined}
                >
                  <span className="fs-actor-name">{actor.name}</span>
                  {actor.sub === undefined ? null : <span className="fs-actor-sub">{actor.sub}</span>}
                </div>
              </Fragment>
            ))}
          </div>
          <Pane title={step.cardTitle} icon="terminal" role="slate">
            <div className="fs-lines">
              {step.lines.map((line) => (
                <Row key={line.text} line={line} />
              ))}
            </div>
          </Pane>
        </div>
      )}
    </Stepper>
  );
}

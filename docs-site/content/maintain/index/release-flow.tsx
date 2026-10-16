'use client';
/**
 * ReleaseFlow：一次发版从本机到 npmjs 经过哪几处、每处做什么、哪一步卡住会怎样。
 * 地图上三个方块是本机、GitHub、npmjs，本机下方挂过渡期的 Gitea：当前这一步所在的方块高亮，
 * 亮着的箭头是这一步传出去的东西（提交、release 与包文件、包）；下面一张卡片摆这一步的命令或
 * 经手的东西，第 5 步把四层包名分层摆开。数据都在 release-flow.data.mjs。
 */
import type { JSX } from 'react';
import { Pane, Pill, Stepper } from '@godcreator/explainer/site';
import { flows, places, steps } from './release-flow.data.mjs';
import type { Flow, FlowId, Place, PlaceId, ReleaseStep } from './release-flow.data.mjs';
import './release-flow.css';

const localToGithub = flows.filter((f) => f.from === 'local' && f.to === 'github');
const toNpmjs = flows.find((f) => f.id === 'packs') as Flow;
const toGitea = flows.find((f) => f.id === 'packs-gitea') as Flow;

function PlaceNode({ place, active }: { place: Place; active: boolean }): JSX.Element {
  return (
    <div className={`rf-place rf-${place.id}`} data-active={active || undefined}>
      <i className="rf-place-dot" aria-hidden="true" />
      <span>{place.label}</span>
    </div>
  );
}

/** 水平箭头：一段线、标签、一段带箭头头的线 */
function HFlow({ flow, lit }: { flow: Flow; lit: boolean }): JSX.Element {
  return (
    <div className="rf-flow" data-flow={flow.id} data-on={lit || undefined}>
      <i className="rf-flow-line" aria-hidden="true" />
      <span className="rf-flow-label">{flow.label}</span>
      <i className="rf-flow-line rf-flow-line-head" aria-hidden="true" />
    </div>
  );
}

/** 垂直箭头（本机 → Gitea）：一段竖线带向下的箭头头，标签在线旁 */
function VFlow({ flow, lit }: { flow: Flow; lit: boolean }): JSX.Element {
  return (
    <div className="rf-flow rf-flow-v" data-flow={flow.id} data-on={lit || undefined}>
      <i className="rf-flow-v-line" aria-hidden="true" />
      <span className="rf-flow-label">{flow.label}</span>
    </div>
  );
}

function FlowMap({ where, lit }: { where: readonly PlaceId[]; lit: readonly FlowId[] }): JSX.Element {
  const placeOf = new Map(places.map((p) => [p.id, p]));
  const node = (id: PlaceId): Place => placeOf.get(id) as Place;
  return (
    <div className="rf-map-wrap">
      <div className="rf-map">
        <PlaceNode place={node('local')} active={where.includes('local')} />
        <div className="rf-hflows">
          {localToGithub.map((f) => (
            <HFlow key={f.id} flow={f} lit={lit.includes(f.id)} />
          ))}
        </div>
        <PlaceNode place={node('github')} active={where.includes('github')} />
        <HFlow flow={toNpmjs} lit={lit.includes(toNpmjs.id)} />
        <PlaceNode place={node('npmjs')} active={where.includes('npmjs')} />
        <VFlow flow={toGitea} lit={lit.includes(toGitea.id)} />
        <PlaceNode place={node('gitea')} active={where.includes('gitea')} />
      </div>
    </div>
  );
}

function StepCard({ step }: { step: ReleaseStep }): JSX.Element {
  const c = step.card;
  return (
    <Pane title={c.title} icon={c.icon} role={step.role}>
      {c.kind === 'checks' ? (
        <div className="rf-checks">
          {c.tiers.map((tier) => (
            <div key={tier.tier} className="rf-tier-block">
              <div className="rf-tier-head">
                <Pill tone={tier.tone} dot>{tier.tier}</Pill>
                <span className="rf-when">{tier.when}</span>
              </div>
              <div className="rf-cmds">
                {tier.runs.map((run) => (
                  <div key={run} className="rf-cmd">{run}</div>
                ))}
              </div>
            </div>
          ))}
          <p className="rf-note">{c.note}</p>
        </div>
      ) : c.kind === 'command' ? (
        <div className="rf-cmds">
          {c.lines.map((line) => (
            <div key={line} className="rf-cmd">{line}</div>
          ))}
        </div>
      ) : c.kind === 'yaml' ? (
        <div className="rf-cmds">
          {c.lines.map((line) => (
            <div key={line} className="rf-cmd">{line}</div>
          ))}
          <p className="rf-note">{c.note}</p>
        </div>
      ) : c.kind === 'tiers' ? (
        <div className="rf-tiers-card">
          <div className="rf-cmds">
            {c.loopLines.map((line) => (
              <div key={line.text} className="rf-cmd" data-kind={line.kind}>{line.text}</div>
            ))}
          </div>
          <div className="rf-tier-list">
            {c.tiers.map((tier) => (
              <div key={tier.label} className="rf-tier-row">
                <Pill role="slate">{tier.label}</Pill>
                <span className="rf-packs">{tier.packs.join(' · ')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rf-regression">
          <div className="rf-pack-pills">
            {c.packs.map((pack) => (
              <Pill key={pack} role="slate">{pack}</Pill>
            ))}
          </div>
          <p className="rf-note">{c.note}</p>
        </div>
      )}
    </Pane>
  );
}

export function ReleaseFlow(): JSX.Element {
  return (
    <Stepper steps={steps} interval={6500} label="一次发版从本机到 npmjs">
      {(step) => (
        <div key={step.title} className="rf-stage">
          <FlowMap where={step.where} lit={step.lit} />
          <StepCard step={step} />
        </div>
      )}
    </Stepper>
  );
}

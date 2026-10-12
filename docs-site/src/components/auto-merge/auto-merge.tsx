'use client';
/**
 * 两个讲解组件：AutoMergeRun 在「执行器与自动合并」那一页，AutoMergeCases 在案例「执行器实测的五种合并请求」。
 * AutoMergeRun：一个合并请求从 bob 推送到进 main，上面是 bob 的电脑、Gitea、NAS 执行器三列地点，当前这一步亮起、走过的留着，
 * 下面是这一步实际经手的东西（命令、工作流、检查、合并请求）。
 * AutoMergeCases：MMC 协作仓上 2026-09-30 实测的五种情况，那时的三条检查各是过、不过还是没查到，执行器合并了还是留了言。
 * 讲解文字与数据都在 auto-merge.data.mjs，接缝的名字取自这一页的接缝图；机读版由 auto-merge.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill, Stepper, Terminal } from '@godcreator/docsite-explainer';
import type { TerminalLine, Tone } from '@godcreator/docsite-explainer';
import { cases, checkNames, columns, commentFrame, measuredCheckNames, places, runSteps } from './auto-merge.data.mjs';
import { autoMergeGraph } from '../seam-map-flow/inner/auto-merge.data.mjs';

type RunStep = (typeof runSteps)[number];
type Artifact = RunStep['artifact'];
type Case = (typeof cases)[number];
type CheckState = 'ok' | 'bad' | 'skip';

const checkTone: Record<CheckState, Tone> = { ok: 'good', bad: 'bad', skip: 'pending' };
const checkWord: Record<CheckState, string> = { ok: '过', bad: '不过', skip: '没查' };
const pullTone: Record<string, Tone> = { merged: 'good', commented: 'warn', closed: 'pending' };

const visited = (placeId: string, upTo: number): boolean => runSteps.slice(0, upTo + 1).some((step) => step.place === placeId);

function PlaceMap({ at }: { at: number }): JSX.Element {
  const current = runSteps[at]!.place;
  return (
    <div className="am-map">
      {columns.map((column) => (
        <div key={column.id} className="am-col" data-role={column.role}>
          <div className="am-col-title">{column.title}</div>
          {places
            .filter((place) => place.column === column.id)
            .map((place) => (
              <div key={place.id} className="am-place" data-state={place.id === current ? 'now' : visited(place.id, at) ? 'done' : 'later'}>
                <span className="am-place-name">{place.name}</span>
                <span className="am-place-detail">{place.detail}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function CheckList({ names, states, output }: { names: readonly string[]; states: readonly CheckState[]; output: string }): JSX.Element {
  return (
    <div className="am-checks">
      <ol>
        {names.map((name, index) => (
          <li key={name} data-state={states[index]}>
            <Dot tone={checkTone[states[index]!]} />
            <span className="am-check-name">{name}</span>
            <span className="am-check-word">{checkWord[states[index]!]}</span>
          </li>
        ))}
      </ol>
      <code className="am-output">{output}</code>
    </div>
  );
}

function ArtifactView({ artifact }: { artifact: Artifact }): JSX.Element {
  switch (artifact.kind) {
    case 'term':
      return <Terminal title={artifact.title} lines={artifact.lines as TerminalLine[]} />;
    case 'code':
      return (
        <Pane title={artifact.title} icon="file" role="amber">
          <CodeLines lines={artifact.lines} highlight={artifact.highlight} tone="info" />
        </Pane>
      );
    case 'checks':
      return (
        <Pane title={artifact.command} icon="terminal" role="violet" extra={<Pill tone="good">退出码 0</Pill>}>
          <CheckList names={checkNames} states={artifact.checks.map((check) => check.state as CheckState)} output={artifact.output} />
        </Pane>
      );
    case 'merge':
      return (
        <Pane title="合并接口（以 collab-bot）" icon="git" role="amber" extra={<Pill tone="good" dot>{artifact.result}</Pill>}>
          <CodeLines lines={artifact.request} />
        </Pane>
      );
  }
}

export function AutoMergeRun(): JSX.Element {
  return (
    <Stepper steps={runSteps} label="一个合并请求怎样被自动合并" interval={4200}>
      {(step, index) => (
        <div className="am-stage">
          <PlaceMap at={index} />
          <div className="am-tags">
            {step.seams.map((n) => (
              <Pill key={n} role="slate">
                接缝 {autoMergeGraph.seams.find((seam) => seam.n === n)!.label}
              </Pill>
            ))}
          </div>
          {/* 每一步换 key，经手的东西重新挂载一次 */}
          <div key={index} className="am-artifact">
            <ArtifactView artifact={step.artifact} />
          </div>
        </div>
      )}
    </Stepper>
  );
}

function CaseView({ item }: { item: Case }): JSX.Element {
  const merged = item.checks.every((state) => state === 'ok');
  return (
    <div className="am-case">
      <div className="am-tags">
        {item.pulls.map((pull) => (
          <Pill key={pull.n} tone={pullTone[pull.state]} dot>
            #{pull.n} {pull.note}
          </Pill>
        ))}
      </div>
      <div className="am-case-grid">
        <Pane title="当时的三条检查" icon="terminal" role="violet" extra={<Pill tone={merged ? 'good' : 'warn'}>退出码 {merged ? 0 : 1}</Pill>}>
          <CheckList names={measuredCheckNames} states={item.checks as CheckState[]} output={item.output.join('\n')} />
        </Pane>
        {merged ? (
          <Pane title="执行器做了什么" icon="git" role="amber">
            <p className="am-note">以 collab-bot 调合并接口，main 上多一个合并提交；合并请求上不留言。</p>
          </Pane>
        ) : (
          <Pane title="collab-bot 的留言" icon="user" role="amber">
            <div className="am-comment">
              <p>{commentFrame.head}</p>
              {item.output.map((line) => (
                <p key={line} className="am-comment-line">
                  {line}
                </p>
              ))}
              <p>{commentFrame.tail}</p>
            </div>
          </Pane>
        )}
      </div>
      {item.file === undefined ? null : (
        <Pane title={item.file.title} icon="file" role="rose">
          <CodeLines lines={item.file.lines} highlight={item.file.highlight} tone="bad" />
        </Pane>
      )}
    </div>
  );
}

export function AutoMergeCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="MMC 协作仓上改造前实测的五种情况">
      {(item) => <CaseView key={item.id} item={item} />}
    </CasePicker>
  );
}

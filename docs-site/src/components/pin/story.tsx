'use client';
/**
 * 「一条引用的一生」：七步，每一步只变一件事——文档里的记号、源码、状态、命令行输出同时显示。
 * 讲解文字与每一步的数据都在 story.data.mjs，这里只负责画；步骤控制条、每一步的标题与说明由 Stepper 显示。
 * 生成物里的机读文字由 pin.ai.mjs 读同一份数据生成。
 */
import { CodeLines, Diff, Dot, Pane, Pill, Stepper, Terminal } from '@godcreator/docsite-explainer';
import { files, legend, steps } from './story.data.mjs';
import { toneOfStatus } from './tone';
import '@godcreator/docsite-explainer/styles.css';
import './pin.css';

type Step = (typeof steps)[number];

const nameOf = (status: string): string => legend.find((l) => l.status === status)?.name ?? status;

/** 记号里的 hash、blob、lines 三个属性值加粗，这三处是确认时写回的 */
function Marker({ text }: { text: string }) {
  const parts = text.split(/(lines="[^"]*"|hash="[^"]*"|blob="[^"]*")/);
  return (
    <span>
      {parts.map((part, i) => (/^(lines|hash|blob)=/.test(part) ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))}
    </span>
  );
}

/** 命令行输出那一行的颜色：绿灯与确认成功算 ok，让 check 以退出码 1 结束的（缺失、按红处理的黄灯）算 err */
function cliKind(step: Step): 'ok' | 'err' | 'out' {
  if (step.status === 'missing' || step.blocking) return 'err';
  if (step.status === 'fresh') return 'ok';
  return 'out';
}

function StepPicture({ step, index }: { step: Step; index: number }) {
  const tone = toneOfStatus[step.status];
  return (
    <>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <Pane title={files.doc} role="blue" icon="file" extra="文档">
          <span>greet 返回一句问候：</span>
          <div className="pin-marker">
            <Dot tone={tone} />
            <Marker text={step.marker} />
          </div>
        </Pane>
        <Pane title={files.ref} role="violet" icon="file" extra="源码">
          <CodeLines lines={step.code} highlight={step.span} tone={tone} added={step.added} changed={step.changed} />
          {step.removed ? (
            <>
              <span className="text-xs text-fd-muted-foreground">删掉的那几行（页面上显示文档写下时的内容）</span>
              <Diff old={step.removed} now={[]} />
            </>
          ) : null}
        </Pane>
      </div>
      {/* 每一步换 key，状态胶囊重新挂载，弹出动画重放一次 */}
      <Pill key={index} tone={tone} dot>
        {nameOf(step.status)}
        {step.blocking ? ' · 本仓未提交的改动引起，按红处理' : null}
      </Pill>
      {step.diff ? <Diff old={[step.diff.old]} now={[step.diff.now]} /> : null}
      <Terminal
        title="~/repo/docs-site"
        lines={[
          { text: step.command, kind: 'cmd' },
          { text: step.cli, kind: cliKind(step) },
        ]}
      />
    </>
  );
}

export function PinStory() {
  return (
    <Stepper steps={steps} label="一条引用从写下到删掉">
      {(step, index) => <StepPicture step={step} index={index} />}
    </Stepper>
  );
}

'use client';
/**
 * 「一页的 md 怎么来、怎么取」两个讲解组件：
 *   MdBuild  分步：同一篇正本在 next build 里一步步变成语法树、换掉引用、打标、序列化、预渲染成静态文件
 *   MdServe  选情况：几种请求各自经过 src/proxy.ts 改写到哪条路由、拿回什么
 * 讲解文字与示例都在 md-output.data.mjs，机读版由 md-output.ai.mjs 读同一份数据生成。
 */
import type { JSX, ReactNode } from 'react';
import { CasePicker, CodeLines, Pane, Pill, Stepper, Terminal } from '@godcreator/explainer-player';
import type { Tone } from '@godcreator/explainer-player';
import { buildSteps, files, mdBody, mdFile, mdPaths, serveCases, sourceLines, trees } from './md-output.data.mjs';

type BuildStep = (typeof buildSteps)[number];
type ServeCase = (typeof serveCases)[number];

function MdPane({ step }: { step: BuildStep }): JSX.Element {
  switch (step.md) {
    case 'none':
      return (
        <Pane title="md" role="slate" icon="file" extra={<Pill role="slate">还没有</Pill>}>
          <span className="mo-empty">这一步还在语法树上改，md 还没生成</span>
        </Pane>
      );
    case 'body':
      return (
        <Pane title="序列化出的 md" role="emerald" icon="file" extra={<Pill role="emerald">在内存里</Pill>}>
          <CodeLines lines={mdBody} highlight={step.mdHighlight} tone="good" />
        </Pane>
      );
    case 'export':
      return (
        <Pane title={mdPaths.export} role="emerald" icon="file" extra={<Pill tone="good">编进产物</Pill>}>
          <CodeLines lines={mdBody} tone="good" />
        </Pane>
      );
    case 'file':
      return (
        <Pane title={mdPaths.file} role="emerald" icon="file" extra={<Pill tone="good">静态文件</Pill>}>
          <CodeLines lines={mdFile} highlight={step.mdHighlight} tone="good" />
        </Pane>
      );
  }
}

function BuildScene({ step }: { step: BuildStep }): JSX.Element {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 @3xl:grid-cols-2">
        <Pane title={files.page} role="violet" icon="file" extra="正本">
          <CodeLines lines={sourceLines} highlight={step.source} tone="info" />
        </Pane>
        <Pane title="语法树（mdast）" role="blue" icon="server">
          <CodeLines lines={trees[step.tree]} highlight={step.treeHighlight} tone="info" />
        </Pane>
      </div>
      <MdPane step={step} />
    </div>
  );
}

export function MdBuild(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={buildSteps} label="一页的 md 在 next build 里怎么生成">
        {(step) => <BuildScene key={step.id} step={step} />}
      </Stepper>
    </div>
  );
}

const RULE_TEXT: Record<ServeCase['rule'], string> = {
  suffix: '后缀规则改写',
  accept: '按 Accept 改写',
  none: '放行',
  skip: '不经过改写',
};

const RESULT: Record<ServeCase['result'], { tone: Tone; text: string }> = {
  md: { tone: 'good', text: 'md' },
  html: { tone: 'info', text: 'HTML 页面' },
  index: { tone: 'good', text: '现状区目录' },
  full: { tone: 'good', text: '全部页的 md' },
  missing: { tone: 'bad', text: '没有' },
};

function pathOf(command: string): string {
  const url = command.split(' ').at(-1)!;
  return url.replace(/^https?:\/\/[^/]+/, '');
}

function Hop({ name, children }: { name: string; children: ReactNode }): JSX.Element {
  return (
    <div className="mo-hop">
      <span className="mo-hop-name">{name}</span>
      <div className="mo-hop-body">{children}</div>
    </div>
  );
}

function ServeScene({ item }: { item: ServeCase }): JSX.Element {
  const result = RESULT[item.result];
  return (
    <div className="grid gap-3 @2xl:grid-cols-2">
      <Terminal
        title="~"
        lines={[
          { text: item.command, kind: 'cmd' },
          { text: `HTTP ${item.status} · ${item.type}`, kind: item.status === 200 ? 'ok' : 'err' },
          ...item.body,
        ]}
      />
      <div className="mo-flow" role="list" aria-label="这个请求经过的几处">
        <Hop name="请求">
          <code className="mo-code">{pathOf(item.command)}</code>
        </Hop>
        <Hop name="src/proxy.ts">
          <Pill role={item.rule === 'accept' || item.rule === 'suffix' ? 'violet' : 'slate'}>{RULE_TEXT[item.rule]}</Pill>
          <span className="mo-note">{item.ruleNote}</span>
        </Hop>
        <Hop name="路由">
          <span className="mo-note">{item.route}</span>
        </Hop>
        <Hop name="返回">
          <Pill tone={result.tone}>{result.text}</Pill>
          <code className="mo-code">
            {item.status} · {item.type}
          </code>
        </Hop>
      </div>
    </div>
  );
}

export function MdServe(): JSX.Element {
  return (
    <div className="not-prose">
      <CasePicker cases={serveCases} label="怎么请求一页">
        {(item) => <ServeScene key={item.id} item={item} />}
      </CasePicker>
    </div>
  );
}

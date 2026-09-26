'use client';
/**
 * 「引用能指向哪几类东西」：选一类目标，看它在 mdx 里新写时与确认后的记号、check 拿什么跟什么比、
 * 各种结果在命令行打出的那一行，以及站上这处引用显示成什么。点一种结果，下方终端与站上显示跟着换。
 * 数据与讲解文字都在 ref-kinds.data.mjs；类别按钮与说明由 CasePicker 显示。机读版由 ref-kinds.ai.mjs 读同一份数据生成。
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CasePicker, CodeLines, Dot, Pane, Pill, Terminal } from '@godcreator/docs-explain';
import type { Tone } from '@godcreator/docs-explain';
import { toneOfStatus } from '../pin/tone';
import { files, kinds, outcomeName, siteKindName } from './ref-kinds.data.mjs';

type Kind = (typeof kinds)[number];
type Outcome = Kind['outcomes'][number];
type Site = Outcome['site'];

const toneOfOutcome = (outcome: Outcome): Tone => (outcome.blocking === true ? 'bad' : toneOfStatus[outcome.status]);

function terminalKind(outcome: Outcome): 'ok' | 'err' | 'out' {
  if (outcome.blocking === true || outcome.status === 'missing') return 'err';
  return outcome.status === 'fresh' ? 'ok' : 'out';
}

/** 记号里 confirm 写上的记录属性加粗 */
const RECORD_ATTR = /((?:hash|blob|type)="[^"]*")/;

function Marker({ text }: { text: string }) {
  return (
    <code className="rk-marker">
      {text.split(RECORD_ATTR).map((part, index) => (index % 2 === 1 ? <b key={index}>{part}</b> : part))}
    </code>
  );
}

function FolderIcon() {
  return (
    <svg className="rk-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="rk-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/** 站上的代码块：标题栏右端是状态点 */
function SiteBlock({ title, tone, children }: { title: string; tone: Tone; children: ReactNode }) {
  return (
    <div className="rk-block">
      <div className="rk-block-bar">
        <span className="rk-block-title">{title}</span>
        <Dot tone={tone} />
      </div>
      {children}
    </div>
  );
}

function PlainLines({ lines }: { lines: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="rk-plain">
      {lines.map(([side, text], index) => (
        <div key={index} className="rk-plain-line" data-side={side === '-' ? 'old' : side === '+' ? 'now' : undefined}>
          {text}
        </div>
      ))}
    </div>
  );
}

function SitePreview({ site, tone }: { site: Site; tone: Tone }) {
  switch (site.type) {
    case 'code':
      return (
        <SiteBlock title={site.title} tone={tone}>
          {site.start !== null ? <CodeLines lines={site.lines} start={site.start} /> : <PlainLines lines={site.lines.map((line) => [' ', line] as const)} />}
        </SiteBlock>
      );
    case 'diff':
      return (
        <SiteBlock title={site.title} tone={tone}>
          <PlainLines lines={site.lines} />
        </SiteBlock>
      );
    case 'tree':
      return (
        <div className="rk-tree">
          <span className="rk-tree-dot">
            <Dot tone={tone} />
          </span>
          <div className="rk-tree-row" data-disabled={site.gone ? true : undefined}>
            <FolderIcon />
            {site.root}
          </div>
          <div className="rk-tree-kids">
            {site.names.map((name) => (
              <div key={name} className="rk-tree-row">
                {name.endsWith('/') ? <FolderIcon /> : <FileIcon />}
                {name.replace(/\/$/, '')}
              </div>
            ))}
          </div>
        </div>
      );
    case 'chip':
      return (
        <span className="rk-chip">
          <Dot tone={tone} />
          {site.text}
        </span>
      );
    default:
      throw new Error(`RefKinds：认不出的站上显示类型「${(site as { type: string }).type}」`);
  }
}

/** 一开始选中这一类的绿灯 */
function firstFresh(kind: Kind): string {
  const fresh = kind.outcomes.find((o) => o.status === 'fresh');
  if (fresh === undefined) throw new Error(`RefKinds：${kind.id} 没有新鲜的结果`);
  return fresh.id;
}

function Picture({ kind }: { kind: Kind }) {
  const [picked, setPicked] = useState(() => firstFresh(kind));
  const outcome = kind.outcomes.find((o) => o.id === picked);
  if (outcome === undefined) throw new Error(`RefKinds：${kind.id} 里没有结果「${picked}」`);
  return (
    <>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <Pane title={files.doc} role="blue" icon="file" extra="文档">
          <span className="rk-label">正式记号（confirm 写上记录属性）</span>
          {kind.formal.map((line) => (
            <Marker key={line} text={line} />
          ))}
          <span className="rk-label">新写的记号（作者手写，{kind.writtenNote}）</span>
          {kind.written.map((line) => (
            <code key={line} className="rk-marker">
              {line}
            </code>
          ))}
        </Pane>
        <Pane title="docfirst check 比什么" role="violet" icon="terminal">
          <div className="rk-compare">
            {kind.compare.map((row, index) => (
              <div key={index} className="rk-compare-row">
                <Pill role="violet">{row.attr}</Pill>
                <code className="rk-compare-value">{row.recorded}</code>
                <span className="rk-compare-today">↔ {row.today}</span>
              </div>
            ))}
          </div>
          <span className="rk-note">{kind.rule}</span>
          <span className="rk-label">{kind.observe.title}</span>
          <CodeLines lines={kind.observe.lines} highlight={kind.observe.highlight} tone="info" />
        </Pane>
      </div>
      <div className="rk-outcomes" role="group" aria-label="核对结果">
        {kind.outcomes.map((o) => (
          <button key={o.id} type="button" className="rk-outcome" data-tone={toneOfOutcome(o)} aria-pressed={o.id === outcome.id} onClick={() => setPicked(o.id)}>
            <Dot tone={toneOfOutcome(o)} />
            <span className="rk-outcome-name">{outcomeName(o)}</span>
            <span className="rk-outcome-when">{o.when}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <Terminal
          title="~/repo/docs-site"
          lines={[
            { text: 'pnpm docfirst check', kind: 'cmd' },
            { text: outcome.cli, kind: terminalKind(outcome) },
          ]}
        />
        <Pane title={`站上显示 · ${siteKindName[outcome.site.type]}`} role="emerald" icon="file">
          <SitePreview key={`${kind.id}:${outcome.id}`} site={outcome.site} tone={toneOfStatus[outcome.status]} />
        </Pane>
      </div>
    </>
  );
}

export function RefKinds() {
  return (
    <div className="not-prose">
      <CasePicker cases={kinds} label="引用指向哪一类东西">
        {(kind) => <Picture key={kind.id} kind={kind} />}
      </CasePicker>
    </div>
  );
}

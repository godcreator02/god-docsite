'use client';
/**
 * 「生成物怎么从 mdx 正本渲染出来」：左边正本、右边生成物，中间一列是这一段在做的那一步。
 * 画面是 (段号, 本段进度) → 画面 的纯函数：每一行的高度、透明度、位移、颜色都由进度算出来，拖到哪一刻都画得出来。
 * 讲解文字与示例都在 render-flow.data.mjs，机读版由 render-flow.ai.mjs 读同一份数据生成。
 */
import type { CSSProperties, JSX, ReactNode } from 'react';
import { CodeLines, Diff, Pane, Pill, Terminal, Timeline } from '@godcreator/docfirst-explainer';
import type { Role, TerminalLine, TimelineFrame, Tone } from '@godcreator/docfirst-explainer';
import {
  chapters,
  codeLines,
  codeSpan,
  configLines,
  files,
  handEditedLast,
  outputLines,
  refusalBadLines,
  refusalLines,
  sourceLines,
  sourceParts,
  terminals,
} from './render-flow.data.mjs';

type RenderChapter = (typeof chapters)[number];
type SceneId = RenderChapter['id'];
type Frame = TimelineFrame<RenderChapter>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
/** 进度 p 在 [from, to] 里走到了哪儿，0–1 */
const ramp = (p: number, from: number, to: number): number => clamp01((p - from) / (to - from));
/** 两头慢中间快 */
const ease = (value: number): number => value * value * (3 - 2 * value);
const easedRamp = (p: number, from: number, to: number): number => ease(ramp(p, from, to));

const sceneOrder = chapters.map((chapter) => chapter.id);

/** 某一段的进度：已经过去的段是 1，还没到的段是 0，当前段是本段进度 */
function phaseOf(frame: Frame, id: SceneId): number {
  const at = sceneOrder.indexOf(id);
  if (frame.index > at) return 1;
  if (frame.index < at) return 0;
  return frame.progress;
}

/** 代码窗格里的一行 */
interface Row {
  key: string;
  text: string;
  /** 行高占满的比例：0 收起、1 展开 */
  height: number;
  opacity?: number;
  /** 横向位移，px */
  shift?: number;
  role?: Role;
  muted?: boolean;
  struck?: boolean;
}

const lineStyle = (row: Row): CSSProperties => ({
  display: 'flex',
  lineHeight: '20px',
  borderLeft: '2px solid',
  borderLeftColor: row.role === undefined ? 'transparent' : 'var(--dx-c)',
  background: row.role === undefined ? undefined : 'color-mix(in srgb, var(--dx-c) 12%, transparent)',
  transform: row.shift ? `translateX(${row.shift}px)` : undefined,
  transition: 'background-color .3s, border-color .3s',
});

/** 行号只数展开过半的行：收起中的行不占号，展开中的行过半才拿到号 */
function Lines({ rows }: { rows: readonly Row[] }): JSX.Element {
  let lineNumber = 0;
  return (
    <div style={{ fontFamily: 'var(--dx-mono)', fontSize: 12, margin: '-10px -12px', padding: '6px 0' }}>
      {rows.map((row) => {
        const numbered = row.height >= 0.5;
        if (numbered) lineNumber += 1;
        return (
          <div key={row.key} style={{ display: 'grid', gridTemplateRows: `${row.height}fr`, opacity: row.opacity ?? 1 }}>
            <div style={{ minHeight: 0, overflow: 'hidden' }}>
              <div data-role={row.role} style={lineStyle(row)}>
                <span
                  aria-hidden="true"
                  style={{ flex: 'none', width: '4ch', paddingRight: 10, textAlign: 'right', color: 'var(--dx-dim)', opacity: 0.7, userSelect: 'none' }}
                >
                  {numbered ? lineNumber : ''}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    paddingRight: 12,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    color: row.muted ? 'var(--dx-dim)' : undefined,
                    textDecoration: row.struck ? 'line-through' : undefined,
                  }}
                >
                  {row.text === '' ? ' ' : row.text}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 正本这一行在当前段里的颜色、是否划掉 */
function sourceMark(frame: Frame, lineNumber: number): Pick<Row, 'role' | 'muted' | 'struck'> {
  const id = frame.chapter.id;
  const p = frame.progress;
  const [fmFrom, fmTo] = sourceParts.frontmatter;
  const inFrontmatter = lineNumber >= fmFrom && lineNumber <= fmTo;
  if (id === 'source') {
    if (p < 0.34) return inFrontmatter ? { role: 'rose' } : {};
    if (p < 0.67) return !inFrontmatter && lineNumber !== sourceParts.marker && lineNumber > sourceParts.blankAfterFrontmatter ? { role: 'slate' } : {};
    return lineNumber === sourceParts.marker ? { role: 'blue' } : {};
  }
  if (id === 'strip') return inFrontmatter || lineNumber === sourceParts.blankAfterFrontmatter ? { role: 'rose' } : {};
  if (id === 'block') return lineNumber === sourceParts.marker ? { role: 'blue' } : {};
  if (id === 'fields') {
    if (sourceParts.keptFields.includes(lineNumber)) return { role: 'emerald' };
    if (sourceParts.droppedFields.includes(lineNumber)) return { muted: true, struck: true };
    return {};
  }
  if (id === 'refuse') return refusalBadLines.includes(lineNumber) ? { role: 'rose' } : {};
  return {};
}

function sourceRows(frame: Frame): Row[] {
  const rows: Row[] = sourceLines.map((text, i) => ({ key: `s${i + 1}`, text, height: 1, ...sourceMark(frame, i + 1) }));
  const grow = frame.chapter.id === 'refuse' ? frame.progress : 0;
  refusalLines.forEach((text, i) => {
    const lineNumber = sourceLines.length + i + 1;
    const height = easedRamp(grow, 0.04 + i * 0.03, 0.2 + i * 0.03);
    rows.push({ key: `s${lineNumber}`, text, height, opacity: height, ...sourceMark(frame, lineNumber) });
  });
  return rows;
}

/** 到这一刻已经出现的字符：从 at 开始，每个字符占进度的 0.006 */
function typedPrefix(text: string, p: number, at: number): string {
  const count = Math.floor((p - at) / 0.006);
  return text.slice(0, Math.max(0, Math.min(text.length, count)));
}

function outputRows(frame: Frame): Row[] {
  const strip = phaseOf(frame, 'strip');
  const block = phaseOf(frame, 'block');
  const fields = phaseOf(frame, 'fields');
  const id = frame.chapter.id;
  const rows: Row[] = [];

  const placeholderHeight = 1 - easedRamp(strip, 0, 0.18);
  rows.push({ key: 'o-empty', text: '（还没有渲染）', height: placeholderHeight, opacity: placeholderHeight, muted: true });

  // 点名的字段加回头部：---、两个字段、---、一个空行，从左边滑进来
  const fieldsIn = easedRamp(fields, 0.15, 0.7);
  const fieldRole: Role | undefined = id === 'fields' ? 'emerald' : undefined;
  outputLines.slice(0, 5).forEach((text, i) => {
    rows.push({ key: `o-fm${i}`, text, height: fieldsIn, opacity: fieldsIn, shift: -24 * (1 - fieldsIn), role: fieldRole });
  });

  // 照抄过来的正本：frontmatter 与其后的空行先出现，再收起
  const copied = easedRamp(strip, 0.05, 0.3);
  const collapsed = easedRamp(strip, 0.45, 0.85);
  sourceLines.slice(0, sourceParts.blankAfterFrontmatter).forEach((text, i) => {
    const height = strip >= 1 ? 0 : copied * (1 - collapsed);
    rows.push({ key: `c${i + 1}`, text, height, opacity: height, role: id === 'strip' ? 'rose' : undefined, struck: collapsed > 0 });
  });

  const body = (lineNumber: number, text?: string): Row => ({ key: `c${lineNumber}`, text: text ?? sourceLines[lineNumber - 1]!, height: copied, opacity: copied });
  for (let n = sourceParts.blankAfterFrontmatter + 1; n < sourceParts.marker; n++) rows.push(body(n));

  // 记号那一行先标出、划掉，再收起；同一处展开代码块，代码逐行出现
  const markerOut = easedRamp(block, 0.4, 0.62);
  rows.push({
    ...body(sourceParts.marker),
    height: copied * (1 - markerOut),
    opacity: copied * (1 - markerOut),
    role: id === 'block' ? 'blue' : undefined,
    struck: block > 0.2,
  });
  const blockLines = outputLines.slice(9, 14);
  blockLines.forEach((text, i) => {
    const from = i === 0 ? 0.48 : i === blockLines.length - 1 ? 0.86 : 0.58 + (i - 1) * 0.09;
    const height = easedRamp(block, from, from + 0.1);
    rows.push({ key: `o-block${i}`, text, height, opacity: height, role: id === 'block' ? 'blue' : undefined });
  });

  rows.push(body(sourceParts.marker + 1));
  const last = body(sourceLines.length);
  if (id === 'check') {
    const edited = typedEdit(frame.progress);
    rows.push({ ...last, text: edited.text, role: edited.touched ? 'amber' : undefined });
  } else {
    rows.push(last);
  }
  return rows;
}

/** check 那一段里有人直接改生成物的最后一行：先删掉句号，再逐字输入新的结尾 */
function typedEdit(p: number): { text: string; touched: boolean } {
  const original = outputLines[outputLines.length - 1]!;
  const common = original.slice(0, -1);
  if (p < 0.34) return { text: original, touched: false };
  const tail = handEditedLast.slice(common.length);
  return { text: common + typedPrefix(tail, p, 0.36), touched: true };
}

/** 终端到这一刻为止出现的行 */
function terminalLines(lines: (typeof terminals)[keyof typeof terminals], p: number): TerminalLine[] {
  return lines
    .filter((line) => p >= line.at)
    .map((line): TerminalLine => ({ kind: line.kind, text: line.kind === 'cmd' ? typedPrefix(line.text, p, line.at) : line.text }));
}

/** 生成物窗格标题栏右端：它现在在哪、跟正本对不对得上 */
function outputState(frame: Frame): { tone?: Tone; role?: Role; label: string } {
  const p = frame.progress;
  switch (frame.chapter.id) {
    case 'source':
      return { role: 'slate', label: '还没有' };
    case 'strip':
    case 'block':
    case 'fields':
      return { role: 'blue', label: '在内存里' };
    case 'write':
      if (p < terminals.render[1]!.at) return { role: 'blue', label: '在内存里' };
      if (p < terminals.render[3]!.at) return { tone: 'good', label: '已写入' };
      return { role: 'slate', label: '内容相同，没写' };
    case 'check':
      if (p < terminals.check[2]!.at) return { role: 'slate', label: '磁盘上' };
      if (p < 0.34) return { tone: 'good', label: '跟重新渲染的一致' };
      if (p < terminals.check[5]!.at) return { tone: 'warn', label: '被直接改过' };
      return { tone: 'bad', label: '跟重新渲染的不一致' };
    case 'refuse':
      return p < terminals.refuse[1]!.at ? { role: 'slate', label: '磁盘上' } : { tone: 'bad', label: '没写，旧文件原样留着' };
  }
}

/** 中间一列：这一段在做的那一步 */
function Middle({ frame }: { frame: Frame }): JSX.Element {
  const p = frame.progress;
  switch (frame.chapter.id) {
    case 'source':
      return (
        <Pane title={`${files.config} 的 outputs`} role="slate" icon="file">
          <CodeLines lines={configLines} highlight={p >= 0.67 ? [2, 3] : null} tone="info" />
        </Pane>
      );
    case 'strip':
      return (
        <Pane title="renderAi：去掉 frontmatter" role="rose" extra={<Pill role="rose">第 1–6 行</Pill>}>
          <Diff old={sourceLines.slice(0, sourceParts.blankAfterFrontmatter)} now={[]} />
        </Pane>
      );
    case 'block':
      return (
        <Pane title={files.code} role="blue" icon="file" extra={<Pill role="blue">读第 2–4 行</Pill>}>
          <CodeLines lines={codeLines} highlight={p >= 0.1 ? codeSpan : null} tone="info" />
        </Pane>
      );
    case 'fields':
      return (
        <Pane title={`${files.config} 的 outputs`} role="emerald" icon="file">
          <CodeLines lines={configLines} highlight={p >= 0.08 ? [3, 3] : null} tone="good" />
        </Pane>
      );
    case 'write':
      return <Terminal title={files.cwd} lines={terminalLines(terminals.render, p)} />;
    case 'check':
      return <Terminal title={files.cwd} lines={terminalLines(terminals.check, p)} />;
    case 'refuse':
      return <Terminal title={files.cwd} lines={terminalLines(terminals.refuse, p)} />;
  }
}

/** 两个窗格之间的箭头；做变换的几段里，一个点沿箭头从左走到右 */
function Arrow({ frame }: { frame: Frame }): JSX.Element {
  const moving = ['strip', 'block', 'fields', 'write'].includes(frame.chapter.id);
  const dotX = 6 + 26 * frame.progress;
  return (
    <div aria-hidden="true" className="flex items-center justify-center py-1 @xl:py-0">
      <svg width="40" height="20" viewBox="0 0 40 20" className="rotate-90 @xl:rotate-0" style={{ color: 'var(--dx-dim)' }}>
        <path d="M2 10H34M28 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {moving ? <circle cx={dotX} cy={10} r={3.5} style={{ fill: 'var(--dx-accent)' }} /> : null}
      </svg>
    </div>
  );
}

function Scene({ frame }: { frame: Frame }): ReactNode {
  const state = outputState(frame);
  const dimOutput = frame.chapter.id === 'refuse' && frame.progress >= terminals.refuse[1]!.at;
  const stateLabel = state.tone !== undefined ? <Pill tone={state.tone}>{state.label}</Pill> : <Pill role={state.role}>{state.label}</Pill>;
  return (
    <>
      <div className="grid gap-2 @xl:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] @xl:items-start">
        <Pane title={files.source} role="violet" icon="file" extra="正本">
          <Lines rows={sourceRows(frame)} />
        </Pane>
        <Arrow frame={frame} />
        <div style={{ opacity: dimOutput ? 0.6 : 1, transition: 'opacity .3s', minWidth: 0 }}>
          <Pane title={files.output} role="emerald" icon="file" extra={stateLabel}>
            <Lines rows={outputRows(frame)} />
          </Pane>
        </div>
      </div>
      <div style={{ minHeight: 150 }}>
        <Middle frame={frame} />
      </div>
    </>
  );
}

export function RenderFlow(): JSX.Element {
  return (
    <Timeline chapters={chapters} label="生成物怎么从 mdx 正本渲染出来">
      {(frame) => <Scene frame={frame} />}
    </Timeline>
  );
}

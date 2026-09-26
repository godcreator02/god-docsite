/**
 * 零件：卡片、终端、胶囊、状态点、代码行、新旧行对照。
 * 颜色一律写成 data-tone / data-role 属性，样式表按属性给出 --dx-c，零件自己不写颜色值。
 */
import type { JSX, ReactNode } from "react";
import type { Role, Tone } from "./colors.ts";
import { Icon } from "./icons.tsx";
import type { PaneIcon } from "./icons.tsx";

export interface PaneProps {
  title: ReactNode;
  /** 标题栏与边框的颜色，默认 slate */
  role?: Role;
  icon?: PaneIcon;
  /** 标题栏右端的附加内容 */
  extra?: ReactNode;
  children?: ReactNode;
}

/** 卡片：同色调淡的标题栏 + 细边框 */
export function Pane({ title, role = "slate", icon, extra, children }: PaneProps): JSX.Element {
  return (
    <div className="dx-pane" data-role={role}>
      <div className="dx-pane-bar">
        {icon !== undefined ? <Icon name={icon} /> : null}
        <span className="dx-pane-title">{title}</span>
        {extra !== undefined ? <span className="dx-pane-extra">{extra}</span> : null}
      </div>
      <div className="dx-pane-body">{children}</div>
    </div>
  );
}

export type TerminalLine = string | { text: string; kind?: "cmd" | "out" | "ok" | "err" };

export interface TerminalProps {
  /** 标题栏上三个点右边的文字，常写当前目录 */
  title?: string;
  /** 字符串是普通输出；kind 为 cmd 的行前面加 "$ " */
  lines: ReadonlyArray<TerminalLine>;
}

/** 深色终端窗口，左上角红黄绿三个点 */
export function Terminal({ title, lines }: TerminalProps): JSX.Element {
  return (
    <div className="dx-term">
      <div className="dx-term-bar">
        <i className="dx-term-light" data-light="red" aria-hidden="true" />
        <i className="dx-term-light" data-light="amber" aria-hidden="true" />
        <i className="dx-term-light" data-light="green" aria-hidden="true" />
        {title !== undefined ? <span className="dx-term-title">{title}</span> : null}
      </div>
      <div className="dx-term-body">
        {lines.map((line, index) => {
          const { text, kind = "out" } = typeof line === "string" ? { text: line } : line;
          return (
            <div key={index} className="dx-term-line" data-kind={kind}>
              {kind === "cmd" ? <span className="dx-term-prompt">$ </span> : null}
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface PillProps {
  /** 状态语气；和 role 只能给一个，都不给是中性灰 */
  tone?: Tone;
  role?: Role;
  /** 前面带一个同色的点；tone 为 pending 时画空心点 */
  dot?: boolean;
  children?: ReactNode;
}

/** 胶囊标签：同色调淡的底和边框 */
export function Pill({ tone, role, dot = false, children }: PillProps): JSX.Element {
  if (tone !== undefined && role !== undefined) throw new Error("Pill 的 tone 与 role 只能给一个");
  return (
    <span className="dx-pill" data-tone={tone} data-role={tone === undefined ? (role ?? "slate") : undefined}>
      {dot ? <span className="dx-dot" data-hollow={tone === "pending" ? true : undefined} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** 状态点；pending 画空心点 */
export function Dot({ tone }: { tone: Tone }): JSX.Element {
  return <span className="dx-dot" data-tone={tone} data-hollow={tone === "pending" ? true : undefined} aria-hidden="true" />;
}

export interface CodeLinesProps {
  lines: readonly string[];
  /** 第一行的行号，默认 1。下面三个参数里的行号都按这个编号算 */
  start?: number;
  /** 高亮的行段 [起, 止]（含两端），用 tone 的颜色调淡做底，左边一道竖线 */
  highlight?: readonly [number, number] | null;
  /** 高亮行段的颜色，默认 info */
  tone?: Tone;
  /** 新加的行：行号前加 +，出现时闪一下 */
  added?: readonly number[];
  /** 改过的行：下面画波浪线 */
  changed?: readonly number[];
}

/** 带行号的代码行；行太长时代码区自己横向滚动 */
export function CodeLines({ lines, start = 1, highlight = null, tone = "info", added = [], changed = [] }: CodeLinesProps): JSX.Element {
  const inHighlight = (lineNumber: number): boolean => highlight !== null && lineNumber >= highlight[0] && lineNumber <= highlight[1];
  return (
    <div className="dx-code" data-tone={tone}>
      <div className="dx-code-lines">
        {lines.map((line, index) => {
          const lineNumber = start + index;
          return (
            // 行号连同内容作 key：内容变了这一行重新挂载，新加行的闪动才会重放
            <div
              key={`${lineNumber}:${line}`}
              className="dx-ln"
              data-highlight={inHighlight(lineNumber) ? true : undefined}
              data-added={added.includes(lineNumber) ? true : undefined}
              data-changed={changed.includes(lineNumber) ? true : undefined}
            >
              <span className="dx-ln-no">{lineNumber}</span>
              <span className="dx-ln-text">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 新旧行对照：旧行 - 玫红底，新行 + 绿底 */
export function Diff({ old, now }: { old: readonly string[]; now: readonly string[] }): JSX.Element {
  return (
    <div className="dx-diff">
      <div className="dx-diff-lines">
        {old.map((line, index) => (
          <div key={`old:${index}`} className="dx-diff-line" data-side="old">
            {line}
          </div>
        ))}
        {now.map((line, index) => (
          <div key={`now:${index}`} className="dx-diff-line" data-side="now">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';
/**
 * 「行段引用怎么跟着代码挪位置」：上面是文档里的记号，中间左右两个 greet.ts（确认时的、今天的），下面是 check 的判定顺序、
 * 这一段 check 内部在算什么、终端输出。画面是 (段号, 本段进度) → 画面 的纯函数：插入行的高度、框的位置、每一行出现与否
 * 都由进度算出来，拖到哪一刻都画得出来。讲解文字与数据都在 span-follow.data.mjs，机读版由 span-follow.ai.mjs 读同一份数据生成。
 */
import type { CSSProperties, JSX, ReactNode } from 'react';
import { CodeLines, Dot, Pane, Pill, Terminal, Timeline } from '@godcreator/docs-explain';
import type { Role, TerminalLine, TimelineFrame, Tone } from '@godcreator/docs-explain';
import {
  catFile,
  chapters,
  diffCommand,
  diffOutput,
  files,
  hunks,
  insertedLines,
  judgeOrder,
  mapped,
  markers,
  newCode,
  oldCode,
  recordFields,
  recorded,
  today,
  windows,
} from './span-follow.data.mjs';

type FollowChapter = (typeof chapters)[number];
type SceneId = FollowChapter['id'];
type Frame = TimelineFrame<FollowChapter>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
/** 进度 p 在 [from, to] 里走到了哪儿，0–1 */
const ramp = (p: number, from: number, to: number): number => clamp01((p - from) / (to - from));
/** 两头慢中间快 */
const ease = (value: number): number => value * value * (3 - 2 * value);
const easedRamp = (p: number, from: number, to: number): number => ease(ramp(p, from, to));

const sceneOrder: readonly SceneId[] = chapters.map((chapter) => chapter.id);
const orderOf = (id: SceneId): number => sceneOrder.indexOf(id);

/** 一行代码的高度，px；与 span-follow.css 里 .sf-row 的行高一致 */
const ROW = 20;
/** .sf-file 的上内边距，px */
const FILE_PAD = 6;

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`SpanFollow 的数据缺了 ${what}`);
  return value;
}

const [spanStart, spanEnd] = recorded.lines;
const spanLength = spanEnd - spanStart + 1;
const hunk = need(hunks[0], 'hunks[0]');
const matchingWindow = need(
  windows.find((w) => w.hash === recorded.hash),
  '跟记号上 hash 相同的窗口',
);

// ── 代码窗格：行可以从 0 高展开；框按「前面几行的高度之和」定位，所以跟着插入的行一起走 ──

interface Row {
  key: string;
  text: string;
  /** 行高占满的比例：0 收起、1 展开 */
  height: number;
  tone?: Tone;
}

interface Box {
  key: string;
  /** 框上沿在第几行之后，按行高算，可以是小数 */
  top: number;
  /** 框高几行；0 画成一道横线（纯插入的插入点） */
  span: number;
  tone: Tone;
  dashed?: boolean;
  opacity?: number;
}

function FileRows({ rows, boxes }: { rows: readonly Row[]; boxes: readonly Box[] }): JSX.Element {
  let lineNumber = 0;
  return (
    <div className="sf-file">
      {rows.map((row) => {
        const numbered = row.height >= 0.5;
        if (numbered) lineNumber += 1;
        return (
          <div key={row.key} className="sf-row" data-tone={row.tone} style={{ height: ROW * row.height, opacity: row.height }}>
            <span className="sf-row-no" aria-hidden="true">
              {numbered ? lineNumber : ''}
            </span>
            <span className="sf-row-text">{row.text}</span>
          </div>
        );
      })}
      {boxes.map((box) => (
        <div
          key={box.key}
          className="sf-box"
          data-tone={box.tone}
          data-dashed={box.dashed ? true : undefined}
          data-bar={box.span === 0 ? true : undefined}
          aria-hidden="true"
          style={{ top: FILE_PAD + box.top * ROW - (box.span === 0 ? 1 : 0), height: box.span === 0 ? 2 : box.span * ROW, opacity: box.opacity ?? 1 }}
        />
      ))}
    </div>
  );
}

/** 今天的 greet.ts 这一刻插进来的两行展开了多少 */
function insertion(frame: Frame): number {
  if (frame.chapter.id === 'confirm') return 0;
  if (frame.chapter.id === 'edit') return easedRamp(frame.progress, 0.1, 0.6);
  return 1;
}

function todayRows(frame: Frame): Row[] {
  const grown = insertion(frame);
  const id = frame.chapter.id;
  const hunkLit = (id === 'hunks' && frame.progress >= 0.3) || id === 'map';
  const rows: Row[] = [];
  let oldIndex = 0;
  newCode.forEach((text, i) => {
    const lineNumber = i + 1;
    if (insertedLines.includes(lineNumber)) {
      rows.push({ key: `new${lineNumber}`, text, height: grown, tone: hunkLit ? 'good' : undefined });
      return;
    }
    oldIndex += 1;
    rows.push({ key: `old${oldIndex}`, text, height: 1 });
  });
  return rows;
}

/** 今天的文件里：被钉的内容跟着走的实线框、记号上行号处的虚线框、映射或滑窗时移动的框 */
function todayBoxes(frame: Frame): Box[] {
  const p = frame.progress;
  const grown = insertion(frame);
  const recordedTop = spanStart - 1;
  const mappedTop = today.lines[0] - 1;
  const ghost = (tone: Tone, opacity = 1): Box => ({ key: 'ghost', top: recordedTop, span: spanLength, tone, dashed: true, opacity });
  const follow = (top: number, tone: Tone): Box => ({ key: 'follow', top, span: spanLength, tone });
  switch (frame.chapter.id) {
    case 'confirm':
      return [follow(recordedTop, p < 0.7 ? 'info' : 'good')];
    case 'edit':
      // 插入行插在段前：段上沿 = 原来的位置 + 已展开的插入行高度
      return [follow(recordedTop + grown * insertedLines.length, 'good'), ghost('warn', easedRamp(p, 0.65, 0.85))];
    case 'quick':
      return [ghost(p < 0.3 ? 'info' : 'warn')];
    case 'fetch':
    case 'hunks':
      return [ghost('warn')];
    case 'map':
      return [ghost('warn', 0.45), follow(recordedTop + (mappedTop - recordedTop) * easedRamp(p, 0.35, 0.8), 'info')];
    case 'rehash':
      return [follow(mappedTop, p < 0.6 ? 'info' : 'good')];
    case 'writeback':
      return [follow(mappedTop, 'good')];
    case 'scan': {
      const settled = p >= 0.9;
      return [follow(scanStart(p) - 1, settled ? 'good' : 'info')];
    }
  }
}

/** 滑窗的起始行：从第 1 行匀速滑到最后一个窗口，再退回离原行号最近的那一处 */
function scanStart(p: number): number {
  const last = need(windows[windows.length - 1], '最后一个窗口').start;
  if (p < 0.78) return 1 + (last - 1) * ramp(p, 0.2, 0.75);
  return last - (last - matchingWindow.start) * easedRamp(p, 0.78, 0.9);
}

function oldRows(frame: Frame): Row[] {
  const shown = frame.chapter.id === 'fetch' ? easedRamp(frame.progress, 0.55, 0.85) : 1;
  return oldCode.map((text, i) => ({ key: `old${i + 1}`, text, height: shown }));
}

function oldBoxes(frame: Frame): Box[] {
  const id = frame.chapter.id;
  const p = frame.progress;
  const span: Box = { key: 'span', top: spanStart - 1, span: spanLength, tone: 'info', opacity: id === 'fetch' ? easedRamp(p, 0.75, 0.9) : 1 };
  if (id === 'hunks') return [span, { key: 'insert', top: hunk.oldStart, span: 0, tone: 'good', opacity: easedRamp(p, 0.3, 0.45) }];
  if (id === 'map') return [span, { key: 'insert', top: hunk.oldStart, span: 0, tone: 'good' }];
  return [span];
}

// ── 文档里的记号 ──

interface MarkerState {
  text: ReactNode;
  tone: Tone;
}

/** 正式记号：attrs 里没给的属性不画；changing 里的属性加粗标色 */
function FormalMarker({ values, changing = [] }: { values: Partial<Record<'lines' | 'hash' | 'blob', string>>; changing?: string[] }): JSX.Element {
  return (
    <span>
      {`{/* ref file="${files.ref}"`}
      {(['lines', 'hash', 'blob'] as const).map((name) =>
        values[name] === undefined ? null : (
          <span key={name}>
            {' '}
            <b data-changing={changing.includes(name) ? true : undefined}>{`${name}="${values[name]}"`}</b>
          </span>
        ),
      )}
      {' */}'}
    </span>
  );
}

const confirmedValues = { lines: `${spanStart}-${spanEnd}`, hash: recorded.hash, blob: recorded.blob };
const movedValues = { lines: `${today.lines[0]}-${today.lines[1]}`, hash: today.hash, blob: today.blob };

/** 确认那一段里三个属性依次写上的时刻 */
const FIELD_AT = { lines: 0.3, hash: 0.45, blob: 0.6 } as const;
/** 写回那一段里 lines、blob 换成新值的时刻 */
const WRITE_AT = { lines: 0.3, hash: 0.45, blob: 0.6 } as const;

function markerState(frame: Frame): MarkerState {
  const p = frame.progress;
  switch (frame.chapter.id) {
    case 'confirm': {
      if (p < 0.22) return { text: markers.draft, tone: 'pending' };
      const written = (['lines', 'hash', 'blob'] as const).filter((name) => p >= FIELD_AT[name]);
      const values: Partial<Record<'lines' | 'hash' | 'blob', string>> = {};
      for (const name of written) values[name] = confirmedValues[name];
      return { text: <FormalMarker values={values} changing={[...written]} />, tone: p < 0.7 ? 'pending' : 'good' };
    }
    case 'edit':
      return { text: <FormalMarker values={confirmedValues} />, tone: 'good' };
    case 'quick':
    case 'fetch':
    case 'hunks':
    case 'map':
      return { text: <FormalMarker values={confirmedValues} />, tone: 'info' };
    case 'rehash':
      return { text: <FormalMarker values={confirmedValues} />, tone: p < 0.6 ? 'info' : 'good' };
    case 'writeback': {
      const values = {
        lines: p >= WRITE_AT.lines ? movedValues.lines : confirmedValues.lines,
        hash: movedValues.hash,
        blob: p >= WRITE_AT.blob ? movedValues.blob : confirmedValues.blob,
      };
      const changing = (['lines', 'hash', 'blob'] as const).filter((name) => p >= WRITE_AT[name]);
      return { text: <FormalMarker values={values} changing={changing} />, tone: 'good' };
    }
    case 'scan':
      return { text: <FormalMarker values={confirmedValues} />, tone: p < 0.9 ? 'info' : 'good' };
  }
}

function DocPane({ frame }: { frame: Frame }): JSX.Element {
  const marker = markerState(frame);
  const extra = frame.chapter.id === 'scan' ? <Pill role="amber">另一种情况：旧文件取不到</Pill> : '文档';
  return (
    <Pane title={files.doc} role="blue" icon="file" extra={extra}>
      <span>greet 返回一句问候：</span>
      <div className="sf-marker">
        <Dot tone={marker.tone} />
        {marker.text}
      </div>
    </Pane>
  );
}

// ── 左边那一格：记号上三个值怎么算 → 确认时的 greet.ts → 取不到 ──

function RecordPane({ frame }: { frame: Frame }): JSX.Element {
  const p = frame.progress;
  const id = frame.chapter.id;
  const shown = (name: string): boolean => id !== 'confirm' || p >= FIELD_AT[name as keyof typeof FIELD_AT];
  const active = (name: string): boolean => id === 'quick' && ((name === 'hash' && p < 0.5) || (name === 'blob' && p >= 0.5));
  return (
    <Pane title="记号上的三个值" role="blue" extra="confirm 时在进程里算">
      <dl className="sf-fields">
        {recordFields.map((field) => (
          <div key={field.name} className="sf-field" data-shown={shown(field.name)} data-active={active(field.name) ? true : undefined}>
            <dt>
              {field.name}="{field.value}"
            </dt>
            <dd>{field.how}</dd>
          </div>
        ))}
      </dl>
    </Pane>
  );
}

function LeftSlot({ frame }: { frame: Frame }): JSX.Element {
  const id = frame.chapter.id;
  if (frame.index < orderOf('fetch')) return <RecordPane frame={frame} />;
  if (id === 'scan') {
    return (
      <Pane title={`确认时的 ${files.ref}`} role="cyan" icon="git" extra={`blob ${recorded.blob}`}>
        <div className="sf-absent" style={{ opacity: easedRamp(frame.progress, 0.05, 0.15) }}>
          对象库里没有 {recorded.blob}：确认之后没提交就又改了文件，这份内容从没存进 git。
        </div>
      </Pane>
    );
  }
  return (
    <Pane title={`确认时的 ${files.ref}`} role="cyan" icon="git" extra={`blob ${recorded.blob}`}>
      <FileRows rows={oldRows(frame)} boxes={oldBoxes(frame)} />
    </Pane>
  );
}

function TodayPane({ frame }: { frame: Frame }): JSX.Element {
  const blobKnown = frame.index > orderOf('quick') || (frame.chapter.id === 'quick' && frame.progress >= 0.75);
  const extra = frame.index === 0 ? '源码' : blobKnown ? `今天 · blob ${today.blob}` : '今天';
  return (
    <Pane title={files.ref} role="violet" icon="file" extra={extra}>
      <FileRows rows={todayRows(frame)} boxes={todayBoxes(frame)} />
    </Pane>
  );
}

// ── check 的判定顺序 ──

type ChipState = { state: 'idle' | 'active' | 'no' | 'yes'; note?: string };

function judgeStates(frame: Frame): ChipState[] {
  const p = frame.progress;
  const no: ChipState = { state: 'no', note: '不同' };
  const idle: ChipState = { state: 'idle' };
  const active: ChipState = { state: 'active' };
  const followed: ChipState = { state: 'yes', note: `跟到 ${today.lines[0]}-${today.lines[1]}` };
  switch (frame.chapter.id) {
    case 'confirm':
    case 'edit':
      throw new Error('判定顺序只在 check 那几段画');
    case 'quick':
      return [p < 0.3 ? active : no, p < 0.5 ? idle : p < 0.75 ? active : no, idle, idle];
    case 'fetch':
    case 'hunks':
    case 'map':
      return [no, no, active, idle];
    case 'rehash':
      return [no, no, p < 0.6 ? active : followed, idle];
    case 'writeback':
      return [no, no, followed, idle];
    case 'scan':
      return [no, no, p < 0.1 ? active : { state: 'no', note: '取不到' }, p < 0.1 ? idle : p < 0.9 ? active : followed];
  }
}

function JudgeOrder({ frame }: { frame: Frame }): JSX.Element {
  const states = judgeStates(frame);
  return (
    <ol className="sf-order" aria-label="judgeSpan 的判定顺序">
      {judgeOrder.map((step, i) => {
        const { state, note } = need(states[i], `第 ${i + 1} 道判定的状态`);
        return (
          <li key={step.id} className="sf-order-step" data-state={state}>
            <span className="sf-order-num">{i + 1}</span>
            <span className="sf-order-label">{step.label}</span>
            {note !== undefined ? <span className="sf-order-note">{note}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

// ── check 内部：这一段在算什么 ──

/** 到了 at 这一刻才出现的一行，出现时从下面轻轻浮上来 */
function Reveal({ p, at, children }: { p: number; at: number; children: ReactNode }): JSX.Element {
  const shown = easedRamp(p, at, at + 0.08);
  const style: CSSProperties = { opacity: shown, transform: `translateY(${(1 - shown) * 4}px)` };
  return (
    <div className="sf-reveal" style={style}>
      {children}
    </div>
  );
}

function Compare({ what, got, want, same }: { what: ReactNode; got: string; want: string; same: boolean }): JSX.Element {
  return (
    <div className="sf-compare">
      <span className="sf-compare-what">{what}</span>
      <code>{got}</code>
      <span className="sf-compare-op" data-tone={same ? 'good' : 'warn'}>
        {same ? '=' : '≠'}
      </span>
      <code>{want}</code>
      <span className="sf-compare-side">记号上的</span>
    </div>
  );
}

function Calc({ children }: { children: ReactNode }): JSX.Element {
  return <div className="sf-calc">{children}</div>;
}

/** 到这一刻为止出现的终端行：命令按字符逐个出现，输出一次出现 */
interface TimedLine {
  kind: 'cmd' | 'out' | 'ok' | 'err';
  text: string;
  /** 本段进度里开始出现的那一刻 */
  at: number;
}

function timedLines(lines: readonly TimedLine[], p: number): TerminalLine[] {
  return lines
    .filter((line) => p >= line.at)
    .map((line): TerminalLine => {
      if (line.kind !== 'cmd') return { kind: line.kind, text: line.text };
      const count = Math.floor((p - line.at) / 0.006);
      return { kind: 'cmd', text: line.text.slice(0, Math.max(0, Math.min(line.text.length, count))) };
    });
}

const CHECK_FUNCTION: Record<Exclude<SceneId, 'confirm' | 'edit'>, string> = {
  quick: 'judgeSpan',
  fetch: 'readBlob',
  hunks: 'diffHunks · parseHunks',
  map: 'mapRange',
  rehash: 'hashSpan',
  writeback: 'confirm · rerecord',
  scan: 'readBlob · findSpan',
};

function Detail({ frame }: { frame: Frame }): JSX.Element {
  const p = frame.progress;
  const id = frame.chapter.id;
  if (id === 'confirm' || id === 'edit') throw new Error('check 内部只在 check 与 confirm 写回那几段画');
  let body: ReactNode;
  switch (id) {
    case 'quick':
      body = (
        <>
          <Reveal p={p} at={0.08}>
            <Compare what={`① 今天第 ${spanStart}–${spanEnd} 行的 hash`} got={today.hashAtRecordedLines} want={recorded.hash} same={false} />
          </Reveal>
          <Reveal p={p} at={0.55}>
            <Compare what="② 今天整个文件的 blob" got={today.blob} want={recorded.blob} same={false} />
          </Reveal>
          <Reveal p={p} at={0.85}>
            <Calc>两步都下不了结论：要确认时的文件，才知道这两行挪到了哪儿。</Calc>
          </Reveal>
        </>
      );
      break;
    case 'fetch':
      body = (
        <>
          <Reveal p={p} at={0.04}>
            <Calc>从 {files.ref} 所在的目录往上找第一个 .git，在那个仓里问对象库：</Calc>
          </Reveal>
          <Terminal
            title="仓根"
            lines={timedLines(
              [
                { kind: 'cmd', text: catFile.command, at: 0.12 },
                { kind: 'out', text: catFile.found, at: 0.4 },
                ...oldCode.map((text) => ({ kind: 'out' as const, text, at: 0.5 })),
              ],
              p,
            )}
          />
          <Reveal p={p} at={0.62}>
            <Calc>
              回话头一行是完整对象名、类型、字节数 {recorded.bytes}；按字节数切出后面的内容，就是确认时的 greet.ts（左上）。
            </Calc>
          </Reveal>
        </>
      );
      break;
    case 'hunks':
      body = (
        <>
          <Terminal
            title="系统临时目录"
            lines={timedLines(
              [{ kind: 'cmd', text: diffCommand, at: 0.02 }, ...diffOutput.map((text, i) => ({ kind: 'out' as const, text, at: 0.2 + i * 0.03 }))],
              p,
            )}
          />
          <Reveal p={p} at={0.5}>
            <table className="sf-hunks">
              <caption>parseHunks 读 @@ 行得到的 hunk 表</caption>
              <thead>
                <tr>
                  <th>oldStart</th>
                  <th>oldLen</th>
                  <th>newStart</th>
                  <th>newLen</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[hunk.oldStart, hunk.oldLen, hunk.newStart, hunk.newLen].map((value, i) => (
                    <td key={i} style={{ opacity: easedRamp(p, 0.58 + i * 0.06, 0.64 + i * 0.06) }}>
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Reveal>
          <Reveal p={p} at={0.86}>
            <Calc>
              oldLen 为 {hunk.oldLen}：纯插入，在旧文件第 {hunk.oldStart} 行后面插进今天的第 {hunk.newStart}–{hunk.newStart + hunk.newLen - 1} 行（两边绿色标出）。
            </Calc>
          </Reveal>
        </>
      );
      break;
    case 'map':
      body = (
        <>
          <Reveal p={p} at={0.04}>
            <Calc>
              纯插入插在旧第 {hunk.oldStart} 行后面，{hunk.oldStart} &lt; 段首 {spanStart}：插在段前，不碰这段。
            </Calc>
          </Reveal>
          <Reveal p={p} at={0.22}>
            <Calc>段整体下移 newLen = {hunk.newLen} 行。</Calc>
          </Reveal>
          <Reveal p={p} at={0.5}>
            <Calc>
              [{spanStart}, {spanEnd}] + {hunk.newLen} = [{today.lines[0]}, {today.lines[1]}]
            </Calc>
          </Reveal>
          <Reveal p={p} at={0.82}>
            <code className="sf-code">
              mapRange(hunks, {spanStart}, {spanEnd}) → {mapped}
            </code>
          </Reveal>
        </>
      );
      break;
    case 'rehash':
      body = (
        <>
          <CodeLines lines={newCode.slice(today.lines[0] - 1, today.lines[1])} start={today.lines[0]} highlight={today.lines} tone={p < 0.6 ? 'info' : 'good'} />
          <Reveal p={p} at={0.2}>
            <Compare what={`今天第 ${today.lines[0]}–${today.lines[1]} 行的 hash`} got={today.hash} want={recorded.hash} same />
          </Reveal>
          <Reveal p={p} at={0.6}>
            <code className="sf-code">
              judgeSpan → {`{ status: "fresh", lines: [${today.lines[0]}, ${today.lines[1]}] }`}
            </code>
          </Reveal>
        </>
      );
      break;
    case 'writeback':
      body = (
        <>
          <Reveal p={p} at={0.1}>
            <Calc>绿灯、跟到的 [{today.lines.join(', ')}] 跟记号上的 [{recorded.lines.join(', ')}] 不一样：按跟到的位置重新 snapshot。</Calc>
          </Reveal>
          {(
            [
              ['lines', confirmedValues.lines, movedValues.lines, '跟到的位置'],
              ['hash', confirmedValues.hash, movedValues.hash, `对第 ${today.lines[0]}–${today.lines[1]} 行重算，没变`],
              ['blob', confirmedValues.blob, movedValues.blob, '今天整个文件'],
            ] as const
          ).map(([name, from, to, why]) => (
            <Reveal key={name} p={p} at={WRITE_AT[name]}>
              <div className="sf-change">
                <span className="sf-compare-what">{name}</span>
                <code>{from}</code>
                <span className="sf-compare-op" data-tone="good">
                  →
                </span>
                <code>{to}</code>
                <span className="sf-compare-side">{why}</span>
              </div>
            </Reveal>
          ))}
        </>
      );
      break;
    case 'scan':
      body = (
        <>
          <Terminal
            title="仓根"
            lines={timedLines(
              [
                { kind: 'cmd', text: catFile.command, at: 0 },
                { kind: 'err', text: catFile.missing, at: 0.06 },
              ],
              p,
            )}
          />
          <ul className="sf-windows" aria-label="每个窗口的 hash">
            {windows.map((w) => {
              const reached = p >= 0.2 && scanStart(Math.min(p, 0.75)) >= w.start - 0.001;
              const match = w.hash === recorded.hash;
              return (
                <li key={w.start} className="sf-window" data-reached={reached} data-match={reached && match ? true : undefined}>
                  <span>
                    第 {w.start}–{w.start + spanLength - 1} 行
                  </span>
                  <code>{w.hash}</code>
                  {reached && match ? <span className="sf-window-hit">= 记号上的 hash</span> : null}
                </li>
              );
            })}
          </ul>
          <Reveal p={p} at={0.9}>
            <code className="sf-code">
              findSpan → {matchingWindow.start}（只有这一处，离原行号 {spanStart} 相差 {Math.abs(matchingWindow.start - spanStart)}）
            </code>
          </Reveal>
        </>
      );
      break;
  }
  const role: Role = id === 'writeback' ? 'blue' : 'amber';
  return (
    <Pane title={id === 'writeback' ? 'confirm 内部' : 'check 内部'} role={role} extra={<code className="sf-fn">{CHECK_FUNCTION[id]}</code>}>
      {body}
    </Pane>
  );
}

function Scene({ frame }: { frame: Frame }): JSX.Element {
  const checking = frame.index >= orderOf('quick');
  return (
    <>
      <DocPane frame={frame} />
      <div className="grid gap-3 @2xl:grid-cols-2 @2xl:items-start">
        <LeftSlot frame={frame} />
        <TodayPane frame={frame} />
      </div>
      {checking ? <JudgeOrder frame={frame} /> : null}
      {checking ? <Detail frame={frame} /> : null}
      <Terminal title={files.cwd} lines={timedLines(frame.chapter.terminal, frame.progress)} />
    </>
  );
}

export function SpanFollow(): JSX.Element {
  return (
    <Timeline chapters={chapters} label="行段引用怎么跟着代码挪位置">
      {(frame) => <Scene frame={frame} />}
    </Timeline>
  );
}

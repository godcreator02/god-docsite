/**
 * 「行段引用怎么跟着代码挪位置」的全部讲解数据：画面（span-follow.tsx）与机读版规则（span-follow.ai.mjs）都只读这一份。
 * 例子跟钉码页（pin/story.data.mjs）是同一个 greet.ts。hash、blob、hunk 表、滑窗里每个窗口的 hash 都是拿
 * docfirst-pin 的 hashSpan / blobOf / parseHunks / mapRange / findSpan 对这两版文件真算出来的，
 * git diff 与 git cat-file 的输出是对同样两份内容真跑 git 得到的。
 */

const REF = 'src/greet.ts';

export const files = { doc: 'content/docs/a.mdx', ref: REF, cwd: '~/repo/docs-site' };

/** 确认时的 greet.ts（文件末尾有换行） */
export const oldCode = ['// 打招呼', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];
/** 今天的 greet.ts：在第 1 行后面插进两行注释 */
export const newCode = ['// 打招呼', '// 用法：greet("世界")', '// 返回一句问候', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];
/** 今天的文件里新插进来的行号 */
export const insertedLines = [2, 3];

/** 确认时写在记号上的三个值；blobFull 与 bytes 是 git cat-file 回话头一行里的完整对象名与字节数 */
export const recorded = {
  lines: /** @type {[number, number]} */ ([2, 3]),
  hash: '3eb99c2e88e2',
  blob: 'c134a7ab15a9',
  blobFull: 'c134a7ab15a9b7bbd5c5de652cc5f78e77970d36',
  bytes: 80,
};

/** check 在今天的文件上算出的值 */
export const today = {
  /** 今天第 2–3 行（记号上写的行号）的 hash */
  hashAtRecordedLines: '8f3849e2f53a',
  /** 今天整个文件的 blob */
  blob: '58b32ed1c69e',
  /** 按 hunk 表对到的新行段，以及它的 hash */
  lines: /** @type {[number, number]} */ ([4, 5]),
  hash: '3eb99c2e88e2',
};

/** @param {{ lines: [number, number], hash: string, blob: string }} record */
const markerOf = ({ lines, hash, blob }) => `{/* ref file="${REF}" lines="${lines[0]}-${lines[1]}" hash="${hash}" blob="${blob}" */}`;

export const markers = {
  unconfirmed: `{/* ref file="${REF}" lines="${recorded.lines[0]}-${recorded.lines[1]}" */}`,
  confirmed: markerOf(recorded),
  moved: markerOf({ lines: today.lines, hash: today.hash, blob: today.blob }),
};

/** 记号上三个值各是怎么算的（span.ts 的 hashSpan、blobOf、normalizeLines） */
export const recordFields = [
  { name: 'lines', value: `${recorded.lines[0]}-${recorded.lines[1]}`, how: '被钉的行号，1 起、含两端' },
  { name: 'hash', value: recorded.hash, how: '这几行换行统一成 LF、去掉行尾空白后，sha256 取前 12 位' },
  { name: 'blob', value: recorded.blob, how: `整个文件 sha1("blob ${recorded.bytes}\\0" + 内容) 取前 12 位，跟 git hash-object 算出的相同` },
];

/** judgeSpan 判行段的顺序，前一步能下结论就不往下走（compare.ts） */
export const judgeOrder = [
  { id: 'here', label: '记号上的行号处 hash 相同' },
  { id: 'blob', label: '今天整个文件的 blob 相同' },
  { id: 'history', label: '取回确认时的文件，按 hunk 表对位置' },
  { id: 'scan', label: '取不到：在整个文件里找 hash 相同的一段' },
];

/** 按 blob 从对象库取旧文件：命令写成等价的 shell，check 里是把 blob 写进 git cat-file --batch 的标准输入 */
export const catFile = {
  command: `echo ${recorded.blob} | git cat-file --batch`,
  found: `${recorded.blobFull} blob ${recorded.bytes}`,
  missing: `${recorded.blob} missing`,
};

/** 两份内容写成临时文件 old、new 之后跑的 diff，以及它的完整输出 */
export const diffCommand = 'git diff --no-index -U0 --no-color -- old new';
export const diffOutput = [
  'diff --git a/old b/new',
  'index c134a7a..58b32ed 100644',
  '--- a/old',
  '+++ b/new',
  '@@ -1,0 +2,2 @@',
  '+// 用法：greet("世界")',
  '+// 返回一句问候',
];
/** parseHunks 从上面那行 @@ 解析出的 hunk 表 */
export const hunks = [{ oldStart: 1, oldLen: 0, newStart: 2, newLen: 2 }];
/** mapRange(hunks, 2, 3) 的返回值 */
export const mapped = '{ touched: false, start: 4, end: 5 }';

/** 取不到旧文件时，findSpan 在今天的文件里逐个窗口算出的 hash（窗口高度等于记号上的行数） */
export const windows = [
  { start: 1, hash: '9e26e5478323' },
  { start: 2, hash: '8f3849e2f53a' },
  { start: 3, hash: '8ed90f323bb3' },
  { start: 4, hash: '3eb99c2e88e2' },
  { start: 5, hash: '520fea0ee8d6' },
];

/** @type {TimedLine} */
const confirmCommand = { kind: 'cmd', text: 'pnpm docfirst confirm', at: 0.04 };
/** @type {TimedLine} */
const checkCommand = { kind: 'cmd', text: 'pnpm docfirst check', at: 0.04 };
const recordedLine = `✅ ${files.doc}  ${REF}:2-3  已确认，写上了记录`;
const freshLine = `🟢 ${files.doc}  ${REF}:2-3  新鲜`;
const movedLine = `✅ ${files.doc}  ${REF}:2-3  内容没变、挪到了 4-5，已写回新行号`;

/**
 * 九段，每段只推进一步。id 给画面选这一段怎么画；terminal 是这一段终端里的行，at 是本段进度（0–1）里出现的那一刻。
 * @typedef {'confirm' | 'edit' | 'quick' | 'fetch' | 'hunks' | 'map' | 'rehash' | 'writeback' | 'scan'} SceneId
 * @typedef {{ kind: 'cmd' | 'out' | 'ok' | 'err', text: string, at: number }} TimedLine
 * @typedef {{ id: SceneId, title: string, text: string, duration: number, terminal: TimedLine[] }} FollowChapter
 * @type {FollowChapter[]}
 */
export const chapters = [
  {
    id: 'confirm',
    title: '确认时：记号上添上 hash、blob',
    text:
      '作者写下只有 file 与 lines 的记号，confirm 在同一行记号上写上记录，这时记号上有三个值：lines 是被钉的行号 2-3；hash 是这两行换行统一成 LF、去掉行尾空白后 sha256 的前 12 位；' +
      `blob 是整个 greet.ts 按 git 的算法算出的对象名前 12 位，也就是 sha1("blob ${recorded.bytes}\\0" + 文件内容)。两个值都在进程里算，不问 git。`,
    duration: 6,
    terminal: [confirmCommand, { kind: 'ok', text: recordedLine, at: 0.7 }],
  },
  {
    id: 'edit',
    title: '代码改动：上面插了两行',
    text:
      '有人在第 1 行后面插进两行注释。被钉的两行内容没变，整体下移到第 4–5 行；记号上还是 lines="2-3"，' +
      '今天的第 2–3 行（虚线框）是刚插进来的两行注释。',
    duration: 5,
    terminal: [
      { ...confirmCommand, at: 0 },
      { kind: 'ok', text: recordedLine, at: 0 },
    ],
  },
  {
    id: 'quick',
    title: 'check 先看能不能直接下结论',
    text:
      `judgeSpan 按固定顺序判，前一步能下结论就不往下走。第一步：切出记号上的第 2–3 行算 hash，得 ${today.hashAtRecordedLines}，` +
      `跟记号上的 ${recorded.hash} 不同。第二步：算今天整个文件的 blob，得 ${today.blob}，跟记号上的 ${recorded.blob} 不同——` +
      '文件变过，要拿确认时的文件来对位置。',
    duration: 6,
    terminal: [checkCommand],
  },
  {
    id: 'fetch',
    title: '按 blob 从 git 取回确认时的整个文件',
    text:
      `check 从 ${REF} 所在的目录往上找到第一个 .git，把记号上的 blob 交给 git cat-file --batch。对象库里有这个对象，` +
      `回话头一行是完整对象名、类型 blob、字节数 ${recorded.bytes}，后面按字节数切出内容，就是确认时的 greet.ts。` +
      '同一次 check 里同一个 blob 只取一次。',
    duration: 6,
    terminal: [{ ...checkCommand, at: 0 }],
  },
  {
    id: 'hunks',
    title: '两份文件算出 hunk 表',
    text:
      '旧文件和今天的文件写成临时文件 old、new，跑 git diff --no-index -U0。-U0 不带上下文行，每个 @@ -a,b +c,d @@ 是一个 hunk：' +
      '旧文件第 a 行起 b 行，换成新文件第 c 行起 d 行。parseHunks 只读 @@ 行，这里得到 oldStart 1、oldLen 0、newStart 2、newLen 2；' +
      'oldLen 为 0 是纯插入，插在旧文件第 1 行后面。hunk 表按两份内容的 blob 缓存，同一对内容只 diff 一次。',
    duration: 7,
    terminal: [{ ...checkCommand, at: 0 }],
  },
  {
    id: 'map',
    title: '按 hunk 表把旧行段对到今天的位置',
    text:
      'mapRange 逐个看 hunk：这个纯插入插在旧第 1 行后面，1 小于段首 2，插在段前、不碰这段，只让整段下移 newLen 行，也就是 2 行。' +
      '旧的 [2, 3] 对到今天的 [4, 5]。有 hunk 落进段里时，新行段是段内没动的行平移过去、再并上这些 hunk 的新行；' +
      '段内每一行都被删掉，就是整段删光（红）。',
    duration: 6,
    terminal: [{ ...checkCommand, at: 0 }],
  },
  {
    id: 'rehash',
    title: '重算这几行的 hash：跟记号上的相同，绿',
    text:
      `切出今天的第 4–5 行，按同一套归一化算 hash，得 ${today.hash}，跟记号上的相同：状态是新鲜，行号跟到 4–5。` +
      'check 的输出里写的还是记号上的 2-3，它不改文件。hash 不同就是有变动（黄），页面上把旧的几行和新的几行放在一起。',
    duration: 5,
    terminal: [
      { ...checkCommand, at: 0 },
      { kind: 'ok', text: freshLine, at: 0.66 },
    ],
  },
  {
    id: 'writeback',
    title: 'confirm 把新行号写回记号',
    text:
      '绿灯、但跟到的行段跟记号上的不一样，confirm 就按跟到的位置重新记：lines 改成 4-5，hash 对第 4–5 行重算仍是 ' +
      `${today.hash}，blob 换成今天文件的 ${today.blob}。这一步不需要人判断；之后 check 在第一步就能下结论。`,
    duration: 6,
    terminal: [confirmCommand, { kind: 'ok', text: movedLine, at: 0.78 }],
  },
  {
    id: 'scan',
    title: '取不到旧文件：在整个文件里找 hash 相同的那段',
    text:
      `另一种情况：confirm 之后没提交就又改了文件，记号上的 blob ${recorded.blob} 从没进过对象库，cat-file 回 missing（仓按 CRLF 存时也会这样）。` +
      '没有旧文件就没有 hunk 表，findSpan 拿一个跟记号上行数一样高的窗口从第 1 行滑到最后，逐个算 hash，只认等于记号上 hash 的窗口，' +
      '取离原行号最近的那处：这里只有第 4–5 行，绿，行号跟到 4–5。找不到、或两处离原行号一样近，就是黄，' +
      '理由是位置不明，要人重读源码后 --accept；记号上的行号已经超出今天的文件时是红。',
    duration: 9,
    terminal: [checkCommand, { kind: 'ok', text: freshLine, at: 0.9 }],
  },
];

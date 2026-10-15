/**
 * WhereItLands（「comments：评论」那一页）的全部数据，画面（where-it-lands.tsx）只读这一份。
 * 评论还是 CommentRoundTrip 那一条：快照、start 15、end 20、原文「第二段话。」；六种情况是正文后来的各种改法，
 * 讲划字锚点在每种改动下推算出什么、落点是什么、收件箱筛在哪一栏、引文行写什么。
 * same、moved、gone 三种照 browser-anchors.test.ts 的用例；edited、hidden 没有现成的测试，
 * 推算照 range-mapping.ts 的同一套算法（删「段」插「句」，结果 15–20、改过；收起的字照样算进页面文字）。
 */
import { quote, snapshot, snapshotChars } from './example.data.mjs';

const charsOf = (text) => [...text].map((char) => ({ char, atomic: char === '￼' }));

/** 今天的正文在三种改动下的样子（same 用快照本身、moved 前面插一段、gone 整段换掉）：照测试的用例 */
/* ref file="../packages/comments/test/browser-anchors.test.ts" lines="114-140" hash="b370d01f6550" blob="d4d301c9a9b4" */
const movedToday = `开头新插的一段${snapshot}`;
const goneToday = '标题文字第一段话，着重的部分。换成了别的话￼后面还有字';
/** 段里改了一个字（「段」改成「句」）与收进折叠块这两种改动没有现成的测试 */
const editedToday = '标题文字第一段话，着重的部分。第二句话。￼后面还有字';

/** 收件箱筛在哪一栏与引文行的原文：照 comments-dock 的 placeOf 与 noteOf（前缀加「原文」） */
/* ref file="../packages/comments/src/site/comments-dock.tsx" lines="148-169" hash="d86bf34b0efb" blob="2c3f77b4345b" */
const notes = {
  same: `「${quote}」`,
  moved: `「${quote}」`,
  edited: `原文改过：「${quote}」`,
  gone: `原文找不到了（可能已删去，或在没打开的页签、收起的内容里）：「${quote}」`,
  hidden: `批的内容现在看不见（可能在收起的内容里）：「${quote}」`,
  elementGone: '批的元素不在这一页上了',
};

/** 元素锚点的例子：批的是标题，anchor 存标题自己的 id */
/* ref file="../packages/comments/test/browser-anchors.test.ts" lines="105-112" hash="becf1514bf13" blob="d4d301c9a9b4" */
export const elementAnchorId = '自己的标题';

/** 找落点的三步，走到哪一步下了结论 */
export const stepNames = ['锚点的种类（整页 / 元素 / 划字 / 认不出）', '找位置（元素按 id 找；划字按快照差异推算首尾）', '看得见吗（收起的内容里看不见）'];

/**
 * 六种情况。today：今天的正文怎么画（字格，或 element-gone 的正文块）；
 * kind：落点（text / hidden / missing）；inbox：收件箱筛在哪一栏；note：引文行原文；
 * trail 的 state：yes 在这一步下结论，no 这一步走过、没下结论，skip 没走到这一步（画面写「没走到」）。
 */
export const cases = [
  {
    id: 'same',
    label: '原样',
    text: '快照和现在的页面文字一模一样，不算差异，第 15 到 19 个字就是原文。正文里高亮这五个字。',
    today: { kind: 'cells', chars: snapshotChars, highlight: [15, 19], tone: 'good' },
    kind: 'text',
    inbox: '正文里',
    note: notes.same,
    trail: [
      { state: 'no', note: '划字：anchor 是 JSON' },
      { state: 'no', note: '两版一样不算差异，第 15 到 19 个字就是原文' },
      { state: 'yes', note: '这段字看得见：批的字回到正文里' },
    ],
  },
  {
    id: 'moved',
    label: '前面加了一段',
    text: '最前面多了 7 个字，差异里只有一段插入。首尾两个字都在没改动的文字里，整体往后挪 7 个字，落在第 22 到 26 个字，原文没改过。',
    today: { kind: 'cells', chars: charsOf(movedToday), highlight: [22, 26], tone: 'good' },
    kind: 'text',
    inbox: '正文里',
    note: notes.moved,
    trail: [
      { state: 'no', note: '划字：anchor 是 JSON' },
      { state: 'no', note: '前面多了 7 个字，首尾都在没改动的文字里，推算到第 22 到 26 个字' },
      { state: 'yes', note: '这段字看得见：批的字回到正文里' },
    ],
  },
  {
    id: 'edited',
    label: '段里改了一个字',
    text: '「段」改成「句」。首字「第」和末字「。」都在没改动的文字里，推算得出第 15 到 19 个字；首尾之间有删改，标「原文改过」，引文行写的是当初批的原文。',
    today: { kind: 'cells', chars: charsOf(editedToday), highlight: [15, 19], tone: 'warn' },
    kind: 'text',
    changed: true,
    inbox: '正文里',
    note: notes.edited,
    trail: [
      { state: 'no', note: '划字：anchor 是 JSON' },
      { state: 'no', note: '首尾两个字都没被动过，推算到第 15 到 19 个字；首尾之间有删改' },
      { state: 'yes', note: '这段字看得见：批的字回到正文里' },
    ],
  },
  {
    id: 'gone',
    label: '整段换掉',
    text: '整段被换成别的话，原文的首尾两个字都在删掉的那段里，推算不出。不去猜新文字里哪几个字算数，如实写「原文找不到了」，进收件箱的「找不到原文」一栏。',
    today: { kind: 'cells', chars: charsOf(goneToday), highlight: null, todayExtra: '推算不出' },
    kind: 'missing',
    inbox: '找不到原文',
    note: notes.gone,
    trail: [
      { state: 'no', note: '划字：anchor 是 JSON' },
      { state: 'yes', note: '首尾两个字都在删掉的那段里，推算不出' },
      { state: 'skip', note: '' },
    ],
  },
  {
    id: 'hidden',
    label: '收进折叠块',
    text: '收起的字照样算进页面文字，位置推算得出，但这段字现在看不见，没法在上面画高亮。写「批的内容现在看不见」，展开折叠块后就回到正文里。',
    today: { kind: 'cells', chars: snapshotChars, highlight: null, folded: [15, 19], todayExtra: '收起来了' },
    kind: 'hidden',
    inbox: '找不到原文',
    note: notes.hidden,
    trail: [
      { state: 'no', note: '划字：anchor 是 JSON' },
      { state: 'no', note: '收起的字照样算进页面文字，推算到第 15 到 19 个字' },
      { state: 'yes', note: '这段字在收起的折叠块里，看不见' },
    ],
  },
  {
    id: 'element-gone',
    label: '批的标题删了',
    text: '元素锚点只按 id 找，不看页面文字。这个 id 不在页面上了，写「批的元素不在这一页上了」。',
    today: { kind: 'blocks' },
    kind: 'missing',
    inbox: '找不到原文',
    note: notes.elementGone,
    trail: [
      { state: 'no', note: '元素：anchor 是 id 自己的标题' },
      { state: 'yes', note: '按 id 找，这一页上没有这个 id' },
      { state: 'skip', note: '' },
    ],
  },
];

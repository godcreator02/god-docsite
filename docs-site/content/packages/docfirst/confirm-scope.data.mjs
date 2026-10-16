/**
 * ConfirmScope（「docfirst：命令行」那一页「confirm：按页限定，--accept 必须点名」一节）的全部数据，画面（confirm-scope.tsx）只读这一份。
 * 例子是拼的：仓里三篇页 content/a.mdx、content/b.mdx、content/c.mdx 与被钉的 ../src/*.ts 都是假设的，刚建好的站里没有。
 * 输出行的格式与措辞照源码拼：结果行出自 text.ts 的 confirmStepLine，按页限定那行与两个报错出自 confirm.ts 的 confirmCommand，
 * 页名与钉的路径换成了这个例子里的名字；两个报错整句是原话。
 */

/** 仓里会被 confirm 动到的三篇页：黄灯是谁改的代码引起的、那处钉记在哪 */
export const pages = [
  { doc: 'content/a.mdx', pin: '../src/a.ts:10-12', note: '我改的代码引起的黄灯' },
  { doc: 'content/b.mdx', pin: '../src/b.ts:20-22', note: '别人改的代码引起的黄灯' },
  { doc: 'content/c.mdx', pin: '../src/c.ts:5-8', note: '未确认的新钉' },
];

/** 不带页名：a、b 的黄灯只打印等复核的行（文件不动），c 的新钉写上记录 */
/* ref file="../packages/docfirst/src/text.ts" lines="33-52" hash="2f5be8812717" blob="41962a5b2b1c" */
export const allLines = [
  '🟡 content/a.mdx  ../src/a.ts:10-12  有变动，等作者复核——复核后 docfirst confirm content/a.mdx --accept',
  '🟡 content/b.mdx  ../src/b.ts:20-22  有变动，等作者复核——复核后 docfirst confirm content/b.mdx --accept',
  '✅ content/c.mdx  ../src/c.ts:5-8  已确认，写上了记录',
];

/** 点名一篇：先打印按页限定那行，a 的黄灯照旧等复核 */
/* ref file="../packages/docfirst/src/commands/confirm.ts" lines="35-54" hash="968e1b367ff3" blob="21b2dc364719" */
export const namedLines = [
  '·  按页限定：只动 content/a.mdx，别的页不碰',
  '🟡 content/a.mdx  ../src/a.ts:10-12  有变动，等作者复核——复核后 docfirst confirm content/a.mdx --accept',
];

/** --accept 点名一篇：a 的黄灯按今天的内容重新记下 */
export const acceptNamedLines = [
  '·  按页限定：只动 content/a.mdx，别的页不碰',
  '✅ content/a.mdx  ../src/a.ts:10-12  已按今天的内容重新记下',
];

/** 两个报错的整句原话，都以退出码 2 结束、什么都不动 */
export const acceptUnnamedError = '--accept 要点名页：docfirst confirm <文档路径…> --accept——确认黄灯得说清是哪几页，什么都没动';
export const badPageError = '不是这个项目里的文档：nope.mdx——什么都没动';

/** 五种写法；written 按 pages 的顺序标那三篇这次有没有被改写 */
export const cases = [
  {
    id: 'all',
    label: '不带页名',
    command: 'docfirst confirm',
    lines: [
      allLines[0],
      allLines[1],
      { text: allLines[2], kind: 'ok' },
    ],
    written: [false, false, true],
    text: '不带页名，现状区的每一篇都被确认：a、b 的黄灯只打印等复核的行，文件不动；c 的新钉写上记录，这一篇被改写。',
  },
  {
    id: 'named',
    label: '点名一篇',
    command: 'docfirst confirm content/a.mdx',
    lines: [namedLines[0], namedLines[1]],
    written: [false, false, false],
    text: '只动点名的那一篇：先打印按页限定那一行，a 的黄灯照旧等复核；b、c 两篇没被读，别人的黄灯没被替他复核，c 的新钉也还没确认。',
  },
  {
    id: 'accept-named',
    label: '--accept 点名一篇',
    command: 'docfirst confirm content/a.mdx --accept',
    lines: [namedLines[0], { text: acceptNamedLines[1], kind: 'ok' }],
    written: [true, false, false],
    text: '--accept 点名 a：a 的黄灯按今天的内容重新记下，这一篇被改写；b 不碰——别人的黄灯还等着他本人复核。',
  },
  {
    id: 'accept-unnamed',
    label: '--accept 不点名',
    command: 'docfirst confirm --accept',
    lines: [{ text: acceptUnnamedError, kind: 'err' }],
    written: [false, false, false],
    text: '--accept 不点名页，直接报错、以退出码 2 结束，三篇一篇都没动：确认黄灯得说清是哪几页。',
  },
  {
    id: 'bad-page',
    label: '点名不存在的页',
    command: 'docfirst confirm nope.mdx',
    lines: [{ text: badPageError, kind: 'err' }],
    written: [false, false, false],
    text: 'nope.mdx 不在现状区里，报错、以退出码 2 结束，什么都不动——对不上的页名不猜、不静默跳过。',
  },
];

/**
 * VerifyCases（「doc-export：生成物」那一页「写出与核对」一节）的全部数据，画面（verify-cases.tsx）只读这一份。
 * 只读的核对怎么判一份生成物：左边「正本会写出」，右边「磁盘上现在」，下面一个胶囊是状态名。
 * 四种情况都摆贯穿例子 skills/x/SKILL.md 的开头几行（与 PlacementCases 同一段断言）；
 * 状态名照 src/node/outputs.ts；fresh、missing、stale 三种情况的行为照 test/node-outputs.test.ts 的核对测试
 * （测试里落点是 README.md，这里换回贯穿例子的落点）；crlf 的归一照 test/outputs.test.ts 与 core 的 sameOutput。
 */

/** 状态名照 node/outputs.ts 的 OutputCheck 注释 */
/* ref file="../packages/doc-export/src/node/outputs.ts" lines="30-38" hash="e2f57b5f96e9" blob="37cec59bcc93" */
/** SKILL.md 的开头几行照 PlacementCases 用的同一条断言；stale 那笔手改是给文件末尾加一行「手改一笔」 */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="73-73" hash="0004d12ab0e5" blob="df55a8c1af91" */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="49-63" hash="02474a49bef4" blob="df55a8c1af91" */
export const headLines = ['---', 'name: block-note', 'description: 块笔记怎么用', '---', '', '# 摆放', '…'];

/** stale：磁盘上比正本会写出的多一行，只有这一行是新的 */
export const tamperedLine = '手改一笔';

/** crlf：每行行尾是 \r\n——画面在每行末尾标出 \r（最后一行的省略号不标） */
/* ref file="../packages/doc-export/src/core/outputs.ts" lines="66-67" hash="40c9360e93c8" blob="dc1854c6456a" */
/* ref file="../packages/doc-export/test/outputs.test.ts" lines="84-87" hash="5fc15a620be6" blob="cbb7c3b5b48e" */
export const crlfLines = headLines.map((line, index) => (index === headLines.length - 1 ? line : `${line}\\r`));

/** 四种情况：left 是正本会写出的，right 是磁盘上现在的，status 是核对交回的状态名 */
export const cases = [
  {
    id: 'fresh',
    label: 'fresh',
    text: '磁盘上那份跟正本会写出的一样：fresh——只有它算一致。',
    left: { lines: headLines },
    right: { kind: 'lines', lines: headLines, crlf: false },
    status: 'fresh · 一致',
    tone: 'good',
  },
  {
    id: 'missing',
    label: 'missing',
    text: '落点还没有文件：missing——还没生成过，或者生成物被删了。',
    left: { lines: headLines },
    right: { kind: 'missing' },
    status: 'missing · 不算一致',
    tone: 'bad',
  },
  {
    id: 'stale',
    label: 'stale',
    text: '有人手改了生成物：比正本会写出的多了一行，对不上，stale——重新跑一次生成才回到 fresh。',
    left: { lines: headLines },
    right: { kind: 'lines', lines: [...headLines, tamperedLine], crlf: false, added: [headLines.length + 1] },
    status: 'stale · 不算一致',
    tone: 'warn',
  },
  {
    id: 'crlf',
    label: 'CRLF',
    text: '磁盘上那份只有换行不一样：每行行尾是 \\r\\n（CRLF）。比较前先把 CRLF 换成 LF，还是 fresh——工作区换行方式不影响结果。',
    left: { lines: headLines },
    right: { kind: 'lines', lines: crlfLines, crlf: true },
    status: 'fresh · 一致',
    tone: 'good',
  },
];

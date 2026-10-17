/**
 * RosterRules（「doc-export：生成物」那一页「组件名册」一节）的全部数据，画面（roster-rules.tsx）只读这一份。
 * 同一套名册机制下四种情况：三种规则的写法，加上名册外组件的下场。左边是正本里的 mdx，右边是生成物里的 Markdown；
 * children、function、unknown 的输入与输出照 test/fumadocs-roster.test.ts 与 test/outputs.test.ts 的断言逐行抄，
 * drop 的正本是照 test/render.test.ts 的 Hidden 例子拼的（少摆一个与此无关的 Steps 组件），输出断言在同一段。
 */

/** children 情况：作者手写的文件树。Files 是 "children"，Folder 与 File 是函数规则；输出断言一行不多 */
/* ref file="../packages/doc-export/test/fumadocs-roster.test.ts" lines="21-24" hash="6207ee818a84" blob="bf633292a52e" */
/* ref file="../packages/doc-export/src/core/fumadocs-roster.ts" lines="9-14" hash="34b0fa9ee815" blob="eb1eb078637b" */
export const treeSource = ['<Files>', '  <Folder name="src" defaultOpen>', '    <File name="add.ts" />', '  </Folder>', '  <File name="package.json" />', '</Files>'];
export const treeOutput = ['src/', '', 'add.ts', '', 'package.json'];

/** drop 情况：正本是照 render.test.ts 的 Hidden 例子拼的；断言是生成物里没有「不要」。右块是一份连续编号的生成物，
 *  被 drop 掉的那段用一行不带行号的灰字标出（灰字是画面标注，不是写出内容） */
/* ref file="../packages/doc-export/test/render.test.ts" lines="93-93" hash="a50e6121a02c" blob="7ca2efbbb19e" */
/* ref file="../packages/doc-export/test/render.test.ts" lines="97-97" hash="ff562f481d71" blob="7ca2efbbb19e" */
export const dropSource = ['# x', '', '<Hidden>不要</Hidden>', '', '后一段'];
export const dropOutput = [{ lines: ['# x', ''] }, { note: '（Hidden 整段没有进来）' }, { lines: ['后一段'], start: 3 }];

/** function 情况：块级 Note 变引用块、句子里的 Note 变一段行内文字，方括号被转义、读出来还是 [note] */
/* ref file="../packages/doc-export/test/fumadocs-roster.test.ts" lines="16-19" hash="ee656abaaf3f" blob="bf633292a52e" */
/* ref file="../packages/doc-export/src/core/fumadocs-roster.ts" lines="9-9" hash="0421e3e92078" blob="eb1eb078637b" */
export const noteBlock = { source: ['前', '', '<Note>', '  提示', '</Note>'], output: ['前', '', '> \\[note] 提示'] };
export const noteInline = { source: ['一句话中有 <Note>提示</Note> 接着说。'], output: ['一句话中有 \\[note] 提示 接着说。'] };

/** unknown 情况：空名册下 Note 也在名册外；正本是 outputs.test.ts 那篇的第 7–11 行，整篇拒绝的原话照断言 */
/* ref file="../packages/doc-export/test/outputs.test.ts" lines="52-58" hash="521867dba54a" blob="cbb7c3b5b48e" */
/* ref file="../packages/doc-export/src/core/render.ts" lines="108-108" hash="8b870dd5ec55" blob="d8c08731c041" */
export const unknownSource = { start: 7, lines: ['一段**加粗**的正文，&#x2A; 原样', '', '<Note>提示</Note>'] };
export const unknownRefusal = {
  pill: '整篇拒绝',
  quote: '第 11 行有名册外组件 <Note>，先在名册里给它写机读规则',
};

/** 四种情况 */
export const cases = [
  {
    id: 'children',
    label: 'children：文件树',
    text: 'Files 的规则是 "children"：去掉外壳只留子内容；里面的 Folder、File 各按自己的函数规则换成一段——Folder 写成「名字/」再跟子项，File 写成名字，整棵树一行一个名字。',
    left: [{ lines: treeSource }],
    right: [{ lines: treeOutput }],
  },
  {
    id: 'drop',
    label: 'drop：整个不进',
    text: '规则是 "drop" 的组件整个不进生成物：正本里那一段在生成物里没有对应——drop 掉的组件里面是什么不管，名册外组件也一并不查。',
    left: [{ lines: dropSource }],
    right: dropOutput,
  },
  {
    id: 'function',
    label: 'function：Note',
    text: '函数规则 (node, helpers) => 节点：同一个 Note，块级写成引用块，写在句子里的写成一段行内文字，前缀 [note]——方括号被转义，读出来还是 [note]。',
    left: [{ lines: noteBlock.source }, { lines: noteInline.source }],
    right: [{ lines: noteBlock.output }, { lines: noteInline.output }],
  },
  {
    id: 'unknown',
    label: 'unknown：名册外',
    text: '名册外的组件让整篇拒绝，一次列全、一处一句。这个例子用空名册跑，Note 也在名册外；选了 fumadocs 名册时它是认识的。',
    left: [{ lines: unknownSource.lines, start: unknownSource.start }],
    right: null,
  },
];

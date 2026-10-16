/**
 * ModeCases（「word-report：报告」那一页「三处调用、两种模式」一节）的全部数据，画面（mode-cases.tsx）只读这一份。
 * 例子沿用分章组装那一节的同一组文件：章 b 的段落 p 里那处引用，指向章 a 的编号公式 target
 * （chapter-assembly.data.mjs 的 bLines 第 6–7 行，字段值与它一致；原文件里挤在同一行，这里按字段折行摆出）。
 * 整份组装显示的编号、提示与报错原话逐字照抄 test/assemble.test.ts 的断言；
 * 报错的「文件:位置」前缀与提示的「（位置 …）」后缀沿用 ChapterAssembly 核对过的展示拼法。
 * 没写 externalLabel 的版本是为讲解拼的：同一处引用去掉 externalLabel 行、上一行自己收尾。
 */

/** 章里那处引用的完整对象（带 externalLabel）与去掉 externalLabel 的版本，按字段折行 */
/* ref file="../packages/word-report/test/assemble.test.ts" lines="40-43" hash="ba5173ca97c0" blob="2f259762f178" */
export const refWithLabel = [
  '{',
  '  "type": "ref",',
  '  "id": "ref",',
  '  "target": "target",',
  '  "display": "label",',
  '  "externalLabel": "建模章中的公式"',
  '}',
];
export const refWithoutLabel = [
  '{',
  '  "type": "ref",',
  '  "id": "ref",',
  '  "target": "target",',
  '  "display": "label"',
  '}',
];

/** 三种结果里的原话：整份组装的编号、单独组装的提示、单独组装且没写 externalLabel 的报错 */
/* ref file="../packages/word-report/test/assemble.test.ts" lines="44-49" hash="9a7d23499ff4" blob="2f259762f178" */
export const outcomes = {
  completeLabel: '式（1-1）',
  warning: 'External reference: 建模章中的公式（位置 b/content.json /blocks/0/children/1/content/0）',
  error: 'b/content.json:/blocks/0/children/1/content/0: ref: Unknown reference target: target',
};

export const cases = [
  {
    id: 'complete',
    label: '整份组装',
    text: '整份组装时目标在：写不写 externalLabel 都换成 a 章那条公式的编号「式（1-1）」，链接指向它的 id；输出里删掉 externalLabel。',
    mode: '模式 complete · 网页报告页与导出',
    refLines: refWithLabel,
    highlight: null,
    tone: 'good',
    pill: '换成编号',
    lines: [
      { text: `显示成 a 章那条公式的编号：${outcomes.completeLabel}` },
      { text: '链接指向它的 id：#target' },
      { text: '输出里不再带 externalLabel' },
    ],
  },
  {
    id: 'standalone-label',
    label: '单独组装 b，写了 externalLabel',
    text: '检查把每一章单独组装一次，只有 b 时引用的目标不在：externalLabel 写的那段文字换成它，另记一条提示，输出里不留 externalLabel。',
    mode: '模式 standalone · 检查（每一章单独组装一次）',
    refLines: refWithLabel,
    highlight: [6, 6],
    tone: 'warn',
    pill: '换成文字，记一条提示',
    lines: [
      { text: '换成 externalLabel 写的那段文字：建模章中的公式' },
      { text: outcomes.warning, mono: true },
    ],
  },
  {
    id: 'standalone-no-label',
    label: '单独组装 b，没写 externalLabel',
    text: '没写 externalLabel 就没有可换的文字：目标不在直接报错，原话带文件与位置。',
    mode: '模式 standalone · 检查',
    refLines: refWithoutLabel,
    highlight: null,
    tone: 'bad',
    pill: '报错',
    lines: [{ text: outcomes.error, mono: true }],
  },
];

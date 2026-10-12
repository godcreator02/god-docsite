/**
 * RefKinds 在生成物里变成什么机读文字：跟画面读同一份数据（ref-kinds.data.mjs）。每一类目标一段说明（用讲解组件包的 casesText，
 * 和画面上 CasePicker 显示的是同一段话），再写它确认后与新写时的记号、check 比什么，以及每种结果的命令行输出与站上显示。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/docsite-explainer/text';
import { files, kinds, outcomeName, siteSummary } from './ref-kinds.data.mjs';

export function RefKinds(_node, { paragraph }) {
  const texts = casesText(kinds);
  return [
    paragraph(`例子：${files.doc} 里的引用都指向 ${files.ref} 或它所在的 ${files.dir}/ 目录。`),
    ...kinds.flatMap((kind, i) => [
      paragraph(texts[i]),
      paragraph(`确认后的记号：${kind.formal.join('　')}　新写的记号：${kind.written.join('　')}（${kind.writtenNote}）`),
      paragraph(`check 比什么：${kind.compare.map((row) => `${row.attr}="${row.recorded}" ↔ ${row.today}`).join('；')}。${kind.rule}`),
      ...kind.outcomes.map((outcome) =>
        paragraph(`${outcomeName(outcome)}：${outcome.when}。$ pnpm docfirst check → ${outcome.cli}　站上：${siteSummary(outcome.site)}`),
      ),
    ]),
  ];
}

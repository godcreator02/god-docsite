/**
 * SpanFollow 在生成物里变成什么机读文字：跟画面读同一份数据（span-follow.data.mjs），每一段一段话（用讲解组件包的 chaptersText，
 * 和画面上 Timeline 显示的是同一段话），再把例子里的两版文件、记号、git 的输出、hunk 表、滑窗算出的 hash 逐项列出来。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { chaptersText } from '@godcreator/docsite-explainer/text';
import {
  catFile,
  chapters,
  diffCommand,
  diffOutput,
  files,
  hunks,
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

/** 逐行列出，每行前面带行号与「│」：行首不会是 #、--- 这类会被当成 markdown 结构的字符 */
const numbered = (lines, start = 1) => lines.map((line, i) => `${start + i}│${line}`).join('\n');

/** 终端里的一行：命令前加 $ */
const terminalText = (line) => (line.kind === 'cmd' ? `$ ${line.text}` : line.text);

export function SpanFollow(_node, { paragraph }) {
  const texts = chaptersText(chapters);
  const [a, b] = recorded.lines;
  const matches = windows.filter((w) => w.hash === recorded.hash);
  if (matches.length === 0) throw new Error('SpanFollow 的数据里没有跟记号上 hash 相同的窗口');
  return [
    paragraph(`例子：${files.doc} 里有一处记号钉住 ${files.ref} 的第 ${a}–${b} 行。确认时的 ${files.ref}：`),
    paragraph(numbered(oldCode)),
    paragraph(`今天的 ${files.ref}（第 1 行后面插进两行注释）：`),
    paragraph(numbered(newCode)),
    paragraph(`作者写下的记号：${markers.unconfirmed}　确认后的记号：${markers.confirmed}`),
    paragraph(`记号上三个值怎么来：${recordFields.map((f) => `${f.name}="${f.value}"——${f.how}`).join('；')}。`),
    paragraph(`check 判行段的顺序，前一步能下结论就不往下走：${judgeOrder.map((s, i) => `${i + 1}. ${s.label}`).join('；')}。`),
    // at 为 0 的是上一段留在终端里的行，机读文字只写这一段新出现的
    ...chapters.flatMap((chapter, i) => {
      const fresh = chapter.terminal.filter((line) => line.at > 0);
      return fresh.length === 0 ? [paragraph(texts[i])] : [paragraph(texts[i]), paragraph(`终端：${fresh.map(terminalText).join('　')}`)];
    }),
    paragraph(
      `今天第 ${a}–${b} 行的 hash 是 ${today.hashAtRecordedLines}，今天整个文件的 blob 是 ${today.blob}，都跟记号上的不同。`,
    ),
    paragraph(`取旧文件：$ ${catFile.command}　对象库里有时输出 ${catFile.found}，接着是文件内容；没有时输出 ${catFile.missing}。`),
    paragraph(`算 hunk 表：$ ${diffCommand}　输出：`),
    paragraph(diffOutput.join('\n')),
    paragraph(
      `parseHunks 得到：${hunks.map((h) => `oldStart ${h.oldStart}、oldLen ${h.oldLen}、newStart ${h.newStart}、newLen ${h.newLen}`).join('；')}。` +
        `mapRange(hunks, ${a}, ${b}) → ${mapped}；今天第 ${today.lines[0]}–${today.lines[1]} 行的 hash 是 ${today.hash}，跟记号上的相同。`,
    ),
    paragraph(`confirm 写回后的记号：${markers.moved}`),
    paragraph(
      `取不到旧文件时，今天文件里每个 ${b - a + 1} 行高的窗口的 hash：` +
        `${windows.map((w) => `第 ${w.start}–${w.start + b - a} 行 ${w.hash}`).join('；')}。等于记号上 ${recorded.hash} 的：${matches.map((w) => `第 ${w.start}–${w.start + b - a} 行`).join('、')}。`,
    ),
  ];
}

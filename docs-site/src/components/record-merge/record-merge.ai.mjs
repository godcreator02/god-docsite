/**
 * RecordMerge 在机读版里变成什么：跟画面读同一份数据（record-merge.data.mjs）。
 * 先一段写两人共同的基准文件，再每种情况一段标题与说明（用讲解组件包的 casesText，和画面上 CasePicker 显示的是同一段话），
 * 后面跟两边的改动、合 main 时的终端、合并后的文件、数据模型包读出的东西。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/explainer';
import { baseTask, cases } from './record-merge.data.mjs';

/** 逐行列出，每行前面带行号与「│」：行首不会是 #、<<< 这类会被当成 markdown 结构的字符 */
const numbered = (lines) => lines.map((line, i) => `${i + 1}│${line}`).join('\n');

function changeText(who, change) {
  if (change.kind === 'new') return `${who}新建了 ${change.file}`;
  return `${who}把 ${change.file} 第 ${change.line} 行从 ${change.old.trim()} 改成 ${change.now.trim()}`;
}

const terminalText = (line) => (line.kind === 'cmd' ? `$ ${line.text}` : line.text.trim());

export function RecordMerge(_node, { paragraph }) {
  const texts = casesText(cases);
  return [
    paragraph('例子：bob 的改动已经合进 main，carol 也改了，运行 collab.submit：在本地 main 上提交之后落后 main，推送前把 origin/main 合进来。两人共同的基准，main 上这条任务原来的文件：'),
    paragraph(numbered(baseTask)),
    ...cases.flatMap((item, i) => {
      const file = item.file;
      const fileText = 'list' in file ? `合并后 ${file.path} 下的文件：${file.list.join('、')}` : `合并后 carol 工作区里的 ${file.path}：`;
      return [
        paragraph(texts[i]),
        paragraph(`${changeText('bob', item.mine)}；${changeText('carol', item.theirs)}。`),
        paragraph(`合 main 时终端：${item.terminal.map(terminalText).join('　')}`),
        paragraph(fileText),
        ...('list' in file ? [] : [paragraph(numbered(file.lines))]),
        paragraph(`数据模型包读出：${item.readOut.map((entry) => `${entry.tone === 'good' ? '' : '问题 '}${entry.text}`).join('；')}。`),
      ];
    }),
  ];
}

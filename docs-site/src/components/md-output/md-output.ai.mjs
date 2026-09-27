/**
 * MdBuild、MdServe 在机读版里变成什么：跟画面读同一份数据（md-output.data.mjs）。
 * MdBuild 每一步一段，再逐行列出示例正本与最后写出的 md；MdServe 每种请求一段，写命令、proxy 怎么改写、走哪条路由、返回什么。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText, stepsText } from '@godcreator/explainer-player/text';
import { buildSteps, files, mdFile, serveCases, sourceLines } from './md-output.data.mjs';

/** 逐行列出，每行前面带行号与「│」：行首不会是 #、```、> 这类会被当成 markdown 结构的字符 */
const numbered = (lines) => lines.map((line, i) => `${i + 1}│${line}`).join('\n');

const NOTE_TEXT = sourceLines.at(-1).replace(/<\/?Note>/g, '');

export function MdBuild(_node, { paragraph }) {
  return [
    ...stepsText(buildSteps).map((text) => paragraph(text)),
    paragraph(`示例正本 ${files.page}（第 ${sourceLines.length} 行是一个 Note 组件，内容「${NOTE_TEXT}」）：`),
    // 站测试断言机读版里没有组件标签（没压平就会留下），所以那一行不照原样列出
    paragraph(numbered(sourceLines.slice(0, -1))),
    paragraph(`最后写出的 md（${files.url} 的 content.md）：`),
    paragraph(numbered(mdFile)),
  ];
}

export function MdServe(_node, { paragraph }) {
  const texts = casesText(serveCases);
  return serveCases.map((item, i) =>
    paragraph(`${texts[i]}　$ ${item.command}　proxy：${item.ruleNote}　路由：${item.route}　返回：${item.status} · ${item.type}`),
  );
}

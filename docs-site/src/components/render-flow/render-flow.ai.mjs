/**
 * RenderFlow 在生成物里变成什么机读文字：跟画面读同一份数据（render-flow.data.mjs），每一段一段话，
 * 再把示例正本、生成物、拒绝渲染的输出逐行列出来。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { chaptersText } from '@godcreator/docfirst-explainer/text';
import {
  chapters,
  codeLines,
  codeSpan,
  configLines,
  files,
  outputLines,
  refusalLines,
  refusalMessage,
  sourceLines,
  terminals,
} from './render-flow.data.mjs';

/** 逐行列出，每行前面带行号与「│」：行首不会是 #、--- 这类会被当成 markdown 结构的字符 */
const numbered = (lines, start = 1) => lines.map((line, i) => `${start + i}│${line}`).join('\n');

export function RenderFlow(_node, { paragraph }) {
  return [
    ...chaptersText(chapters).map((text) => paragraph(text)),
    paragraph(`示例用到的三个文件。${files.config} 里的 outputs：`),
    paragraph(numbered(configLines)),
    paragraph(`被钉的源码 ${files.code}（正本钉第 ${codeSpan[0]}–${codeSpan[1]} 行）：`),
    paragraph(numbered(codeLines)),
    paragraph(`正本 ${files.source}：`),
    paragraph(numbered(sourceLines)),
    paragraph(`渲染后写到 ${files.output} 的生成物：`),
    paragraph(numbered(outputLines)),
    paragraph(`再跑一次 render，内容相同不写：${terminals.render[3].text}`),
    paragraph(`在正本末尾加上这几行（第 ${sourceLines.length + 1} 行起）再 render：`),
    paragraph(numbered(refusalLines, sourceLines.length + 1)),
    paragraph(`输出：${refusalMessage}`),
  ];
}

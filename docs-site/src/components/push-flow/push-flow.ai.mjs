/**
 * PushFlow 在机读版里变成什么：跟画面读同一份数据（push-flow.data.mjs），每一段一段话，前面写这一段对应的实际时间。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { chaptersText } from '@godcreator/docsite-explainer/text';
import { chapters } from './push-flow.data.mjs';

export function PushFlow(_node, { paragraph }) {
  const texts = chaptersText(chapters);
  return chapters.map((chapter, i) => {
    const [from, to] = chapter.real;
    const when = from === to ? `（实际第 ${from} 秒）` : `（实际第 ${from}–${to} 秒）`;
    return paragraph(`${when}${texts[i]}`);
  });
}

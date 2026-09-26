/**
 * PinGlance 在机读版里变成什么：跟画面读同一份数据（glance.data.mjs），先写文档里那行记号，
 * 再每种情况一段（标题与说明用模板包的 casesText，和画面上 CasePicker 显示的是同一段话）加上 check 的输出。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/docs-explain/text';
import { cases, files, marker, statusName } from './glance.data.mjs';

export function PinGlance(_node, { paragraph }) {
  const texts = casesText(cases);
  return [
    paragraph(`${files.doc} 里有一行记号钉住 ${files.ref} 的第 2–3 行：${marker}`),
    ...cases.flatMap((c, i) => [paragraph(texts[i]), paragraph(`状态：${statusName[c.status]}。$ pnpm docfirst check → ${c.cli}`)]),
  ];
}

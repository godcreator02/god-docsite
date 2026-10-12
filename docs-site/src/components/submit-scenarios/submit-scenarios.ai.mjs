/**
 * SubmitScenarios 在机读版里变成什么：跟画面读同一份数据（submit-scenarios.data.mjs）。
 * 每种情况先用讲解组件包的 casesText 写出情况名与结论，和画面下方的说明是同一段话；
 * 后面跟一段按时间排的事件（谁做了什么、运行的命令、合并请求变成什么），会冲突的那种再跟一段冲突的记录文件。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/docsite-explainer/text';
import { actors, cases, outcomes } from './submit-scenarios.data.mjs';

function eventText(event, index) {
  const command = event.cmd === undefined ? '' : `（$ ${event.cmd}）`;
  const pull = event.pull === undefined ? '' : ` → #${event.pull.n} ${event.pull.note}`;
  return `${index + 1}. ${actors[event.who].name}：${event.what}${command}${pull}`;
}

export function SubmitScenarios(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.flatMap((item, i) => [
    paragraph(texts[i]),
    paragraph(`（${outcomes[item.outcome].label}）${item.events.map(eventText).join(' ')}`),
    ...(item.file === undefined ? [] : [paragraph(`冲突的记录文件 ${item.file.title}：${item.file.lines.map((line) => line.trim()).join(' ')}`)]),
  ]);
}

/**
 * WriteRule 在机读版里变成什么：跟画面读同一份数据（write-rule.data.mjs）。
 * 每种情况先一段标题与说明（用讲解组件包的 casesText，和画面上 CasePicker 显示的是同一段话），
 * 再一段请求、一段逐道检查、一段结果。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/docfirst-explainer/text';
import { cases, people, projectLeads } from './write-rule.data.mjs';

const checkText = (check) => `${check.name}（${check.ok === null ? '没走到' : check.ok ? '过' : '拒绝'}）：${check.note}`;

function outcomeText(outcome) {
  if (outcome.kind === 'rejected') return `结果：拒绝（WriteRejected），原话「${outcome.message}」；${outcome.after}。`;
  if (outcome.kind === 'deleted') return `结果：删掉 ${outcome.file}，它原来是：${outcome.lines.map((line) => line.trim()).join(' ')}`;
  const how = outcome.kind === 'created' ? '写成新文件' : '改写';
  return `结果：${how} ${outcome.file}：${outcome.lines.map((line) => line.trim()).join(' ')}`;
}

export function WriteRule(_node, { paragraph }) {
  const texts = casesText(cases);
  return [
    paragraph(`例子里的人员列表 site/people.json：${people.map((person) => `${person.id}（显示名 ${person.name}，身份码 ${person.codes.join('、')}）`).join('、')}；项目负责人（Gitea 上协作仓的协作者）：${projectLeads.join('、')}。`),
    ...cases.flatMap((item, i) => [
      paragraph(texts[i]),
      paragraph(`请求：${item.endpoint}，本机身份 ${item.person}，内容 ${item.body.map((line) => line.trim()).join(' ')}`),
      paragraph(`逐道检查：${item.checks.map(checkText).join('；')}。`),
      paragraph(outcomeText(item.outcome)),
    ]),
  ];
}

/**
 * PinStory、PinJudge 在生成物里变成什么机读文字：跟画面读同一份数据（story.data.mjs、judge.data.mjs）。
 * 每一步、每一种情况的标题与说明用讲解组件包的 stepsText / casesText 生成，和画面上 Stepper、CasePicker 显示的是同一段话；
 * 这一页自己的内容（每一步的记号与命令行输出、每道检查、每种情况走过的路径）另写成段落。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText, stepsText } from '@godcreator/docfirst-explainer/text';
import { legend, steps } from './story.data.mjs';
import { cases, checks } from './judge.data.mjs';

const nameOf = (status) => legend.find((l) => l.status === status)?.name ?? status;

export function PinStory(_node, { paragraph }) {
  const stepTexts = stepsText(steps);
  return [
    paragraph(`四种状态：${legend.map((l) => `${l.name}（${l.meaning}）`).join('；')}。`),
    ...steps.flatMap((s, i) => [
      paragraph(stepTexts[i]),
      paragraph(`文档里的记号：${s.marker}　状态：${nameOf(s.status)}${s.blocking ? '（本仓未提交的改动引起，按红处理）' : ''}`),
      paragraph(`$ ${s.command}　→　${s.cli}`),
    ]),
  ];
}

export function PinJudge(_node, { paragraph }) {
  const outcomes = checks.flatMap((c) => c.outs);
  const caseTexts = casesText(cases);
  return [
    ...checks.map((c, i) => {
      const outs = c.outs.map((o) => `${o.when} → ${o.label}`).join('；');
      return paragraph(`检查 ${i + 1}：${c.q}${c.detail}${outs ? ` 结论：${outs}。` : ''}`);
    }),
    ...cases.flatMap((c, i) => {
      const path = c.path.map(([id, answer]) => `${checks.findIndex((k) => k.id === id) + 1}（${answer}）`).join(' → ');
      const result = outcomes.find((o) => o.id === c.result);
      return [paragraph(caseTexts[i]), paragraph(`经过检查 ${path}，结果是 ${result.label}。`)];
    }),
  ];
}

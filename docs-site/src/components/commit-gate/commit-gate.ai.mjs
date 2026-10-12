/**
 * CommitGate 在生成物里变成什么机读文字：跟画面读同一份数据（commit-gate.data.mjs）。
 * 每一步的标题与说明用讲解组件包的 stepsText 生成，和画面上 Stepper 显示的是同一段话；
 * 这一页自己的内容（git status、命令与输出、退出码、判定、门禁、红的几类）另写成段落。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { files, gateLabel, gateNote, notRed, redSources, steps } from './commit-gate.data.mjs';

const answerText = { yes: '是', no: '否', skip: '不问' };

/** 一步里各个仓的 git status：有输出就逐行列出，没有就写「没有输出」 */
const gitStatusText = (repos) =>
  repos
    .map((repo) => `${repo.path}（${repo.note}）：${repo.lines.length === 0 ? '没有输出' : repo.lines.map((line) => `「${line}」`).join('、')}`)
    .join('；');

function stepParagraphs(step, stepText, paragraph) {
  const out = [paragraph(stepText), paragraph(`git status --porcelain：${gitStatusText(step.repos)}。`)];
  if (step.change !== null) {
    const now = step.change.now.length === 0 ? '（删掉）' : step.change.now.join(' / ');
    out.push(paragraph(`${step.change.file}（${step.change.label}）：${step.change.old.join(' / ')} → ${now}`));
  }
  out.push(paragraph(`$ ${step.command}　→　${step.output.map((line) => line.text).join('　')}　退出码 ${step.exit}`));
  if (step.probe !== null) {
    const rows = step.probe.rows.map((row) => `${row.ask}？${answerText[row.answer]}（${row.detail}）`).join('；');
    out.push(paragraph(`判定：${rows}。结论：${step.probe.verdict.text}。`));
  }
  if (step.sources) {
    out.push(paragraph(`计入红的几类：${redSources.map((source) => `${source.name}（${source.rule}）`).join('；')}。只打印、不计入：${notRed.join('、')}。`));
  }
  out.push(paragraph(`门禁：${gateLabel[step.gate]}。`));
  return out;
}

export function CommitGate(_node, { paragraph }) {
  const stepTexts = stepsText(steps);
  return [
    paragraph(`例子：项目根 ${files.cwd}（git 仓根 ~/repo），文档 ${files.doc} 钉住 ${files.ref} 的第 4–5 行。${gateNote}`),
    ...steps.flatMap((step, i) => stepParagraphs(step, stepTexts[i], paragraph)),
  ];
}

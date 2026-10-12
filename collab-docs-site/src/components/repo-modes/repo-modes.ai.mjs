/**
 * RepoModes 在机读版里变成什么：跟画面读同一份数据（repo-modes.data.mjs）。
 * 每一步先用讲解组件包的 stepsText 写出时刻、标题与说明，再各一段写两个仓这一刻的样子和运行的命令。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { fields, lanes, steps } from './repo-modes.data.mjs';

function laneText(lane, state) {
  const rows = fields.map((field) => `${field.label}：${state[field.key]}`).join('；');
  const cmd = state.cmd === undefined ? '' : `。运行 ${state.cmd.map((line) => `\`${line}\``).join('、')}`;
  return `${lane.title}——${rows}；谁动手：${state.by}${cmd}`;
}

export function RepoModes(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.flatMap((step, i) => [
    paragraph(`（${step.when}）${texts[i]}`),
    ...lanes.map((lane) => paragraph(laneText(lane, step[lane.id]))),
  ]);
}

/**
 * TrajectoryFlow 在生成物里变成什么机读文字：跟画面读同一份数据（trajectory-flow.data.mjs）。
 * 每一步的标题与说明用讲解组件包的 stepsText 生成，和画面上 Stepper 显示的是同一段话；
 * 流水线每一段在哪个包、例子的卡文件、校验结果、两段命令行输出、模型与树、布局落点、功能包星轨盘路由 disk.tsx 与站点里轨迹卡集合的原文另写成段落。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import {
  cards,
  checks,
  clicks,
  codeOf,
  collectionLines,
  failedChecks,
  files,
  input,
  layout,
  model,
  pageLines,
  parsedExtras,
  readCalls,
  stages,
  steps,
  terminals,
} from './trajectory-flow.data.mjs';

/** 逐行列出，每行前面带行号与「│」：行首不会是 #、--- 这类会被当成 markdown 结构的字符 */
const numbered = (lines, start = 1) => lines.map((line, i) => `${start + i}│${line}`).join('\n');

const terminalText = (lines) => lines.map((line) => (line.kind === 'cmd' ? `$ ${line.text}` : line.text)).join('\n');

const codes = (ids) => (ids.length === 0 ? '没有' : ids.map(codeOf).join('、'));

export function TrajectoryFlow(_node, { paragraph }) {
  const stepTexts = stepsText(steps);
  const verdictOf = (card) => {
    const failed = failedChecks[card.code] ?? [];
    if (failed.length === 0) return `${card.code} 全部通过`;
    return `${card.code} 没过：${failed.map((id) => checks.find((c) => c.id === id).name).join('、')}`;
  };
  return [
    paragraph(`流水线：${stages.map((s, i) => `${i + 1}. ${s.name}（${s.pkg}，${s.exports}）`).join('；')}。`),
    ...stepTexts.map((text) => paragraph(text)),
    paragraph(`例子：${files.dir}/ 下的卡文件，代号 ${cards.map((c) => `${c.code} = ${c.id}`).join('，')}。`),
    ...cards.flatMap((card) => [paragraph(`${card.code}：${card.file}`), paragraph(numbered(card.lines))]),
    paragraph(`scanCardDir 里依次发生的调用：${readCalls.map((c, i) => `${i + 1}. ${c.call}——${c.what}`).join('；')}。`),
    paragraph(`解析时的校验：${checks.map((c) => `${c.name}（${c.rule}）`).join('；')}。结果：${cards.map(verdictOf).join('；')}。`),
    paragraph(`解析时从正文取出的：\n${parsedExtras.join('\n')}`),
    paragraph(terminalText(terminals.check)),
    paragraph(
      `scanCardDir 交回的中性输入：盘心 ${codeOf(input.center)}，cards ${codes(input.cards)}；sick（病卡）${codes(input.sickFiles)}。` +
        `buildModel 建出的盘：盘心 ${codeOf(model.center.id)}，盘上的卡 ${codes(model.cards)}。` +
        `盘上：关系边 ${model.edges.map((e) => `${codeOf(e.from)} → ${codeOf(e.to)}（${e.kind === 'supersede' ? '取代' : '转向'}）`).join('、')}；` +
        `主干 ${model.tree.spine.map(codeOf).join(' → ')}；支线 ${model.tree.sublines.map((line) => line.map(codeOf).join(' → ')).join('，')}；` +
        `被取代 ${codes(model.supersededIds)}；孤星 ${codes(model.isolated)}；领域顺序 ${model.domains.join(' → ')}。D 不在盘上。`,
    ),
    paragraph(terminalText(terminals.trajectory)),
    paragraph(
      `RingsLayout 算出的落点（世界坐标，0 度指 12 点、顺时针）：盘心半径 ${layout.hubWorldR}；` +
        `${layout.places.map((p) => `${codeOf(p.id)}（${p.day}）半径 ${p.rLin}、角度 ${p.angBase.toFixed(1)}°、槽 ${p.pos}`).join('；')}；` +
        `这棵树的扇区 ${layout.treeBox.th0}°–${layout.treeBox.th1.toFixed(1)}°。`,
    ),
    paragraph(`/trajectory 整页：顶栏一条，下面是盘。${clicks.map((c) => `${c.what}：${c.then}`).join('；')}。`),
    paragraph(`${files.page} 里读卡目录、交给 StarDisk 的几行：`),
    ...pageLines.map((block) => paragraph(numbered(block.lines, block.start))),
    paragraph(`站点里的轨迹卡集合 ${files.collection}（由功能包的模板写进站点）：`),
    paragraph(numbered(collectionLines.lines, collectionLines.start)),
  ];
}

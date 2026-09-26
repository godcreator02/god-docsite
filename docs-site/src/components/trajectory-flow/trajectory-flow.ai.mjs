/**
 * TrajectoryFlow 在机读版里变成什么：跟画面读同一份数据（trajectory-flow.data.mjs）。
 * 每一步的标题与说明用模板包的 stepsText 生成，和画面上 Stepper 显示的是同一段话；
 * 流水线每一段在哪个包、例子的五个卡文件、校验结果、两段命令行输出、盘清单与树、布局落点、站上的接线另写成段落。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/docs-explain/text';
import {
  cards,
  checks,
  clicks,
  codeOf,
  failedChecks,
  files,
  fumadocsLines,
  launcher,
  layout,
  model,
  pageLines,
  parsedExtras,
  readCalls,
  stages,
  steps,
  terminals,
  withoutMergedIn,
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
    paragraph(`例子：${files.dir}/ 下五个卡文件，代号 ${cards.map((c) => `${c.code} = ${c.id}`).join('，')}。`),
    ...cards.flatMap((card) => [paragraph(`${card.code}：${card.file}`), paragraph(numbered(card.lines))]),
    paragraph(`scanCardDir 里依次发生的调用：${readCalls.map((c, i) => `${i + 1}. ${c.call}——${c.what}`).join('；')}。`),
    paragraph(`解析时的校验：${checks.map((c) => `${c.name}（${c.rule}）`).join('；')}。结果：${cards.map(verdictOf).join('；')}。`),
    paragraph(`解析时从正文取出的：\n${parsedExtras.join('\n')}`),
    paragraph(terminalText(terminals.check)),
    paragraph(
      `buildTrajectory 的盘清单：${model.disks.map((d) => `${d.label}（${d.rootId}）上的卡 ${codes(d.memberIds)}`).join('；')}。` +
        `R 的盘上：关系边 ${model.edges.map((e) => `${codeOf(e.from)} → ${codeOf(e.to)}（${e.kind === 'supersede' ? '取代' : '转向'}）`).join('、')}；` +
        `主干 ${model.tree.spine.map(codeOf).join(' → ')}；支线 ${model.tree.sublines.map((line) => line.map(codeOf).join(' → ')).join('，')}；` +
        `被取代 ${codes(model.supersededIds)}；孤星 ${codes(model.isolated)}；虫洞 ${codes(model.wormholes)}；领域顺序 ${model.domains.join(' → ')}。D 不在任何一张盘上。`,
    ),
    paragraph(terminalText(terminals.trajectory)),
    paragraph(
      `对照，S 不写 merged-in：R 的盘上的卡 ${codes(withoutMergedIn.cards)}，虫洞 ${codes(withoutMergedIn.wormholes)}，主干 ${withoutMergedIn.spine.map(codeOf).join(' → ')}。${withoutMergedIn.text}`,
    ),
    paragraph(
      `RingsLayout 对 R 的盘算出的落点（世界坐标，0 度指 12 点、顺时针）：盘心半径 ${layout.hubWorldR}；` +
        `${layout.places.map((p) => `${codeOf(p.id)}（${p.day}）半径 ${p.rLin}、角度 ${p.angBase.toFixed(1)}°、槽 ${p.pos}`).join('；')}；` +
        `这棵树的扇区 ${layout.treeBox.th0}°–${layout.treeBox.th1.toFixed(1)}°。`,
    ),
    paragraph(`/trajectory 启动器：${launcher.map((e) => `${e.label}，${e.cardCount} 卡 · 最近活动 ${e.latest}`).join('；')}。${clicks.map((c) => `${c.what}：${c.then}`).join('；')}。`),
    paragraph(`${files.page} 里接线的几行：`),
    paragraph(numbered(pageLines.load.lines, pageLines.load.start)),
    paragraph(numbered(pageLines.render.lines, pageLines.render.start)),
    paragraph('docfirst-fumadocs 的 src/trajectory.tsx 里 loadTrajectory 的定义：'),
    paragraph(numbered(fumadocsLines.lines, fumadocsLines.start)),
  ];
}

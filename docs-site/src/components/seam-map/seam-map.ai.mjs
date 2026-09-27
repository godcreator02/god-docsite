/**
 * SeamMap 在机读版里变成什么：跟画面读同一份内容，先一段图例与入口，再每个模块一段（包名、它做什么、里面有哪些能力），
 * 最后每条接缝一段（编号名称、说明、两端、接口、线型）。带 module 属性时写的是那个包的内部图。
 * 每条接缝的标题与说明就是画面浮层里显示的 label、text 两个字段。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { systemGraph } from './seam-map.data.mjs';
import { pinGraph } from './inner/pin.data.mjs';
import { trajectoryGraph } from './inner/trajectory.data.mjs';
import { workflowGraph } from './inner/workflow.data.mjs';
import { workflowPlanGraph } from './inner/workflow-plan.data.mjs';
import { fumadocsGraph } from './inner/fumadocs.data.mjs';
import { explainerPlayerGraph } from './inner/explainer-player.data.mjs';
import { pluginGraph } from './inner/plugin.data.mjs';

const INNER = {
  pin: pinGraph,
  trajectory: trajectoryGraph,
  workflow: workflowGraph,
  'workflow-plan': workflowPlanGraph,
  fumadocs: fumadocsGraph,
  'explainer-player': explainerPlayerGraph,
  plugin: pluginGraph,
};

/** @param {import('./graph.mjs').SeamGraph} graph */
function graphParagraphs(graph, paragraph) {
  const capNames = (ids) => ids.map((id) => graph.capById.get(id).name).join('、');
  const entryTarget = (to) => graph.capById.get(to)?.name ?? graph.modules.find((m) => m.id === to).name;
  const entries =
    graph.entries.length === 0 ? '' : `从外面进来的入口：${graph.entries.map((e) => `${e.name} → ${entryTarget(e.to)}`).join('；')}。`;
  return [
    paragraph(`${graph.intro}${entries}`),
    ...graph.modules.map((m) =>
      paragraph(`${m.outside ? '框外' : graph.frameLabel}「${m.name}」（${m.pkg}）：${m.blurb}能力：${m.caps.map((c) => `${c.name}（${c.ident}）`).join('、')}。`),
    ),
    ...graph.seams.map((s) =>
      paragraph(
        `接缝 ${s.label}：${s.text}两端：${capNames(s.a)} ↔ ${capNames(s.b)}。接口：${s.iface}。${s.convention ? '约定，没有代码接口' : '有代码接口'}，${s.via === 'disk' ? '读写磁盘上的文件' : '代码调用'}。`,
      ),
    ),
  ];
}

export function SeamMap(node, { paragraph, attr }) {
  const moduleId = attr(node, 'module');
  if (moduleId === undefined) return graphParagraphs(systemGraph, paragraph);
  const graph = INNER[moduleId];
  if (graph === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return graphParagraphs(graph, paragraph);
}

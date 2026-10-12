/**
 * SeamMap 在生成物里变成什么机读文字：跟画面读同一份内容，交给讲解组件包的 seamGraphText 写成一段段文字，每段包成一个段落。
 * 带 module 属性时写的是那个包的内部图。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { seamGraphText } from '@godcreator/docsite-explainer/seam-graph';
import { systemGraph } from './seam-map.data.mjs';
import { pinGraph } from './inner/pin.data.mjs';
import { trajectoryGraph } from './inner/trajectory.data.mjs';
import { workflowGraph } from './inner/workflow.data.mjs';
import { fumadocsGraph } from './inner/fumadocs.data.mjs';
import { docfirstSiteGraph } from './inner/docsite-docfirst.data.mjs';
import { docfirstExplainerGraph } from './inner/docfirst-explainer.data.mjs';
import { pluginGraph } from './inner/plugin.data.mjs';
// 协作站的四个内部图：数据在 seam-map-flow（渲染器在那边），机读只吃 graph
import { gwbCollabGraph } from '../seam-map-flow/inner/gwb-collab.data.mjs';
import { collabSiteGraph } from '../seam-map-flow/inner/collab-site.data.mjs';
import { collabMergeCheckGraph } from '../seam-map-flow/inner/collab-merge-check.data.mjs';
import { autoMergeGraph } from '../seam-map-flow/inner/auto-merge.data.mjs';

const INNER = {
  pin: pinGraph,
  trajectory: trajectoryGraph,
  workflow: workflowGraph,
  fumadocs: fumadocsGraph,
  'docsite-docfirst': docfirstSiteGraph,
  'docfirst-explainer': docfirstExplainerGraph,
  plugin: pluginGraph,
  'gwb-collab': gwbCollabGraph,
  'collab-site': collabSiteGraph,
  'collab-merge-check': collabMergeCheckGraph,
  'auto-merge': autoMergeGraph,
};

export function SeamMap(node, { paragraph, attr }) {
  const moduleId = attr(node, 'module');
  if (moduleId === undefined) return seamGraphText(systemGraph).map((text) => paragraph(text));
  const graph = INNER[moduleId];
  if (graph === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return seamGraphText(graph).map((text) => paragraph(text));
}

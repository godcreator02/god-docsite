/**
 * SeamMap 在机读版里变成什么：跟画面读同一份内容，交给讲解组件包的 seamGraphText 写成一段段文字，每段包成一个段落。
 * 带 module 属性时写的是那个包的内部图。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { seamGraphText } from '@godcreator/explainer';
import { systemGraph } from './system.data.mjs';
import { collabSiteGraph } from './inner/collab-site.data.mjs';
import { gwbCollabGraph } from './inner/gwb-collab.data.mjs';
import { autoMergeGraph } from './inner/auto-merge.data.mjs';
import { collabMergeCheckGraph } from './inner/collab-merge-check.data.mjs';

const INNER = {
  'collab-site': collabSiteGraph,
  'gwb-collab': gwbCollabGraph,
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

'use client';
/**
 * 接缝图。不带属性画全局图：各个包与 Gitea、本机的仓、工作台之间谁把什么交给谁（首页用）。
 * 带 module 属性画那个包内部的接缝图（包首页用）。
 * 每张图的内容在 *.data.mjs，坐标在 *.layout.ts；机读版由 seam-map.ai.mjs 读同一份内容生成。
 * FLOW 里的图用数据流画法（flow-seam-diagram.tsx），INNER 里的用讲解组件包的 SeamDiagram。
 */
import { SeamDiagram } from '@godcreator/docsite-explainer';
import type { SeamLayout } from '@godcreator/docsite-explainer';
import type { SeamGraph } from '@godcreator/docsite-explainer/seam-graph';
import { systemGraph } from './system.data.mjs';
import { systemLayout } from './system.layout';
import { collabSiteGraph } from './inner/collab-site.data.mjs';
import { collabSiteLayout } from './inner/collab-site.layout';
import { gwbCollabGraph } from './inner/gwb-collab.data.mjs';
import { gwbCollabLayout } from './inner/gwb-collab.layout';
import { autoMergeGraph } from './inner/auto-merge.data.mjs';
import { autoMergeLayout } from './inner/auto-merge.layout';
import { collabMergeCheckGraph } from './inner/collab-merge-check.data.mjs';
import { collabMergeCheckLayout } from './inner/collab-merge-check.layout';
import { FlowSeamDiagram, type FlowSeamLayout } from './flow-seam-diagram';

/** 用数据流画法的包内图：线带方向与送什么，可替换的接口画成缺口与凸起 */
const FLOW: Record<string, { graph: SeamGraph; layout: FlowSeamLayout }> = {
  'collab-site': { graph: collabSiteGraph, layout: collabSiteLayout },
  'gwb-collab': { graph: gwbCollabGraph, layout: gwbCollabLayout },
};

const INNER: Record<string, { graph: SeamGraph; layout: SeamLayout }> = {
  'collab-merge-check': { graph: collabMergeCheckGraph, layout: collabMergeCheckLayout },
  'auto-merge': { graph: autoMergeGraph, layout: autoMergeLayout },
};

export function SeamMap({ module: moduleId }: { module?: string }) {
  if (moduleId === undefined) return <FlowSeamDiagram graph={systemGraph} layout={systemLayout} />;
  const flow = FLOW[moduleId];
  if (flow !== undefined) return <FlowSeamDiagram graph={flow.graph} layout={flow.layout} />;
  const inner = INNER[moduleId];
  if (inner === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${[...Object.keys(FLOW), ...Object.keys(INNER)].join('、')}`);
  return <SeamDiagram graph={inner.graph} layout={inner.layout} />;
}

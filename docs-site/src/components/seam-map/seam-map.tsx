'use client';
/**
 * 接缝图。不带属性画全局图：包与包、包与站和仓之间的接缝（首页用）。
 * 带 module 属性画那个包内部的接缝图：包里的文件、文件之间的接缝、包外谁调用它、它要谁实现（模块页用）。
 * 画法在讲解组件包的 SeamDiagram；每张图的内容在 *.data.mjs，坐标在 *.layout.ts；生成物里的机读文字由 seam-map.ai.mjs 读同一份内容生成。
 */
import { SeamDiagram } from '@godcreator/docsite-explainer';
import type { SeamLayout } from '@godcreator/docsite-explainer';
import type { SeamGraph } from '@godcreator/docsite-explainer/seam-graph';
import { systemGraph } from './seam-map.data.mjs';
import { systemLayout } from './system.layout';
import { pinGraph } from './inner/pin.data.mjs';
import { pinLayout } from './inner/pin.layout';
import { trajectoryGraph } from './inner/trajectory.data.mjs';
import { trajectoryLayout } from './inner/trajectory.layout';
import { workflowGraph } from './inner/workflow.data.mjs';
import { workflowLayout } from './inner/workflow.layout';
import { fumadocsGraph } from './inner/fumadocs.data.mjs';
import { fumadocsLayout } from './inner/fumadocs.layout';
import { docfirstSiteGraph } from './inner/docsite-docfirst.data.mjs';
import { docfirstSiteLayout } from './inner/docsite-docfirst.layout';
import { docfirstExplainerGraph } from './inner/docfirst-explainer.data.mjs';
import { docfirstExplainerLayout } from './inner/docfirst-explainer.layout';
import { pluginGraph } from './inner/plugin.data.mjs';
import { pluginLayout } from './inner/plugin.layout';
import '@godcreator/docsite-explainer/styles.css';

const INNER: Record<string, { graph: SeamGraph; layout: SeamLayout }> = {
  pin: { graph: pinGraph, layout: pinLayout },
  trajectory: { graph: trajectoryGraph, layout: trajectoryLayout },
  workflow: { graph: workflowGraph, layout: workflowLayout },
  fumadocs: { graph: fumadocsGraph, layout: fumadocsLayout },
  'docsite-docfirst': { graph: docfirstSiteGraph, layout: docfirstSiteLayout },
  'docfirst-explainer': { graph: docfirstExplainerGraph, layout: docfirstExplainerLayout },
  plugin: { graph: pluginGraph, layout: pluginLayout },
};

export function SeamMap({ module: moduleId }: { module?: string }) {
  if (moduleId === undefined) return <SeamDiagram graph={systemGraph} layout={systemLayout} />;
  const inner = INNER[moduleId];
  if (inner === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return <SeamDiagram graph={inner.graph} layout={inner.layout} />;
}

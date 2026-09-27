'use client';
/**
 * 接缝图。不带属性画全局图：包与包、包与站和仓之间的接缝（首页用）。
 * 带 module 属性画那个包内部的接缝图：包里的文件、文件之间的接缝、包外谁调用它、它要谁实现（模块页用）。
 * 画法全在 diagram.tsx；每张图的内容在 *.data.mjs，坐标在 *.layout.ts；机读版由 seam-map.ai.mjs 读同一份内容生成。
 */
import { SeamDiagram } from './diagram';
import type { SeamLayout } from './diagram';
import type { SeamGraph } from './graph.mjs';
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
import { docsExplainGraph } from './inner/docs-explain.data.mjs';
import { docsExplainLayout } from './inner/docs-explain.layout';
import { pluginGraph } from './inner/plugin.data.mjs';
import { pluginLayout } from './inner/plugin.layout';
import { trajectoryPlanGraph } from './inner/trajectory-plan.data.mjs';
import { trajectoryPlanLayout } from './inner/trajectory-plan.layout';

const INNER: Record<string, { graph: SeamGraph; layout: SeamLayout }> = {
  pin: { graph: pinGraph, layout: pinLayout },
  trajectory: { graph: trajectoryGraph, layout: trajectoryLayout },
  workflow: { graph: workflowGraph, layout: workflowLayout },
  fumadocs: { graph: fumadocsGraph, layout: fumadocsLayout },
  'docs-explain': { graph: docsExplainGraph, layout: docsExplainLayout },
  plugin: { graph: pluginGraph, layout: pluginLayout },
  'trajectory-plan': { graph: trajectoryPlanGraph, layout: trajectoryPlanLayout },
};

export function SeamMap({ module: moduleId }: { module?: string }) {
  if (moduleId === undefined) return <SeamDiagram graph={systemGraph} layout={systemLayout} />;
  const inner = INNER[moduleId];
  if (inner === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return <SeamDiagram graph={inner.graph} layout={inner.layout} />;
}

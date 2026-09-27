'use client';
/**
 * 接缝图。不带属性画全局图：包与包、包与站和仓之间的接缝（首页用）。
 * 带 module 属性画那个包内部的接缝图：包里的文件、文件之间的接缝、包外谁调用它、它要谁实现（模块页用）。
 * 画法在讲解播放器的 SeamDiagram；每张图的内容在 *.data.mjs，坐标在 *.layout.ts；机读版由 seam-map.ai.mjs 读同一份内容生成。
 */
import { SeamDiagram } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';
import type { SeamGraph } from '@godcreator/explainer-player/seam-graph';
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
import { explainerPlayerGraph } from './inner/explainer-player.data.mjs';
import { explainerPlayerLayout } from './inner/explainer-player.layout';
import { pluginGraph } from './inner/plugin.data.mjs';
import { pluginLayout } from './inner/plugin.layout';
import { seamMapPlanGraph } from './inner/seam-map-plan.data.mjs';
import { seamMapPlanLayout } from './inner/seam-map-plan.layout';

const INNER: Record<string, { graph: SeamGraph; layout: SeamLayout }> = {
  pin: { graph: pinGraph, layout: pinLayout },
  trajectory: { graph: trajectoryGraph, layout: trajectoryLayout },
  workflow: { graph: workflowGraph, layout: workflowLayout },
  fumadocs: { graph: fumadocsGraph, layout: fumadocsLayout },
  'explainer-player': { graph: explainerPlayerGraph, layout: explainerPlayerLayout },
  plugin: { graph: pluginGraph, layout: pluginLayout },
  'seam-map-plan': { graph: seamMapPlanGraph, layout: seamMapPlanLayout },
};

export function SeamMap({ module: moduleId }: { module?: string }) {
  if (moduleId === undefined) return <SeamDiagram graph={systemGraph} layout={systemLayout} />;
  const inner = INNER[moduleId];
  if (inner === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return <SeamDiagram graph={inner.graph} layout={inner.layout} />;
}

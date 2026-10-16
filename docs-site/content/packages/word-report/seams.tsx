'use client';
/**
 * ReportSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定 48），接缝走线与编号圆点手写，线不压字、圆点不落在方块或别的线上。
 * 三列：左站点目录（三个文件竖排）、中 word-report 包（六个能力竖排，site 在顶上、往下是组装链）、
 * 右列从上到下站点、命令行两个使用方，engine 与本机 Word；右列模块左缘与中列模块右缘之间留出 70px 的通道。
 * 左沟（250–350）三条竖线错开：5 号取快照 x=282、6 号版式 x=306、4 号快照回线 x=330（离中列框边 20px）；
 * 1 号网页现读走 y=88，与 5 号进 report-docs 的横线（y=116）上下错开。
 * 2 号（取快照 → 组装）走中列模块内右沟（x=632，离框边 18px）；
 * 10 号（命令行 → 检查与导出）两支从命令行左缘汇到通道里的主干（x=666）再分头进 check、export；
 * 7 号（导出 → 引擎）从 export 底部沿模块底（y=470）绕到通道右侧（x=694）再进 runner，与 10 号主干不交叉。
 */
import { Cpu, FileOutput, FileText, FolderOpen, Monitor, SquareTerminal } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { reportSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1060, h: 740 },
  caps: {
    // 左列：站点目录的三个文件竖排
    'report-docs': cap(40, 76, 210),
    images: cap(40, 150, 210),
    layout: cap(40, 224, 210),
    // 中列：word-report 包的六个能力竖排（site 在顶上，往下是组装、解析、快照、检查、导出）
    pages: cap(372, 64, 244),
    assemble: cap(372, 132, 244),
    schema: cap(372, 200, 244),
    snapshot: cap(372, 268, 244),
    check: cap(372, 336, 244),
    export: cap(372, 404, 244),
    // 右上：站点
    wiring: cap(742, 64, 256),
    // 右上二：命令行的两个能力竖排
    'cli-export': cap(742, 178, 256),
    'cli-check': cap(742, 246, 256),
    // 右下：engine 的三个能力竖排
    runner: cap(742, 384, 256),
    'engine-schema': cap(742, 452, 256),
    template: cap(742, 520, 256),
    // 右底：本机 Word
    'word-app': cap(742, 648, 256),
  },
  groups: {
    repo: { x: 20, y: 20, w: 250, h: 268 },
    'word-report': { x: 350, y: 20, w: 300, h: 466 },
    'site-user': { x: 720, y: 20, w: 300, h: 112 },
    cli: { x: 720, y: 144, w: 300, h: 170 },
    engine: { x: 720, y: 340, w: 300, h: 248 },
    word: { x: 720, y: 608, w: 300, h: 112 },
  },
  seamPaths: {
    // 网页现读 ⇠ 报告 JSON：pages 与 report-docs 同高（y=88），一条水平线
    '1': { d: 'M372,88 H250', badge: [306, 88] },
    // pages+snapshot → 组装：pages 到 assemble 的包内短竖线；snapshot 走模块内右沟（x=632）上去进 assemble 右边
    '2': { d: 'M494,112 V132 M616,276 H632 V156 H616', badge: [632, 216] },
    // 组装 → 解析与校验：包内短竖线
    '3': { d: 'M494,180 V200', badge: [494, 190] },
    // 检查与导出 → 取快照：check 到 snapshot 的包内短竖线；export 走左沟（x=330，离模块框边 20px）绕上去进 snapshot 左边
    '4': { d: 'M421,336 V316 M372,414 H330 V278 H372', badge: [330, 366] },
    // 取快照 ⇠ 报告 JSON 与图片：从 snapshot 左边走左沟 x=282 分两支；进 report-docs 的横线（y=116）与 1 号（y=88）上下错开
    '5': { d: 'M372,302 H282 V116 H250 M282,172 H250', badge: [282, 210] },
    // 导出 ⇠ 版式：从 export 左边走左沟 x=306 上去进 layout 右边
    '6': { d: 'M372,436 H306 V246 H250', badge: [306, 326] },
    // 导出 → 引擎：从 export 底部沿模块底（y=470，离底边 16px）绕到通道右侧（x=694）再进 runner 左边
    '7': { d: 'M494,452 V470 H694 V406 H742', badge: [694, 438] },
    // 引擎 → 本机 Word：从 runner 右边沿模块外右缘（x=1034）下去进 word-app 右边
    '8': { d: 'M998,406 H1034 V672 H998', badge: [1034, 530] },
    // 站点接线 → loader：wiring 与 pages 同高，一条水平线
    '9': { d: 'M742,88 H616', badge: [679, 88] },
    // 命令行 → 检查与导出：两支从命令行左缘汇到通道里的主干（x=666），再分头进 check、export 的右边
    '10': { d: 'M742,202 H666 V430 M742,270 H666 M666,358 H616 M666,430 H616', badge: [666, 318] },
  },
  entries: {},
  moduleIcons: {
    repo: FolderOpen,
    'word-report': FileText,
    'site-user': Monitor,
    cli: SquareTerminal,
    engine: Cpu,
    word: FileOutput,
  },
  entryIcons: {},
};

export function ReportSeams(): JSX.Element {
  return <SeamDiagram graph={reportSeams} layout={layout} />;
}

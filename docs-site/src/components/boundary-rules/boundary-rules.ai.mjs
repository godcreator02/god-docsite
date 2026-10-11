/**
 * BoundaryRules 在生成物里变成什么机读文字：跟画面读同一份数据（boundary-rules.data.mjs），
 * 先一段写图上有哪些节点、允许的依赖方向有哪些，再每类规则三段：标题与为什么（用讲解组件包的 casesText，
 * 和画面上 CasePicker 显示的是同一段话）、守着的允许方向与禁止的方向、违反时失败的 test。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/docfirst-explainer/text';
import { allowedEdges, edgeText, nodes, rules } from './boundary-rules.data.mjs';

const nodeText = (n) => `${n.name}（${n.ident}）`;

export function BoundaryRules(_node, { paragraph }) {
  const texts = casesText(rules);
  const topLevel = nodes.filter((n) => n.parent === null);
  const dirs = nodes.filter((n) => n.parent === 'workflow');
  return [
    paragraph(
      `依赖图：节点是 ${topLevel.map(nodeText).join('、')}；workflow 包里再分目录 ${dirs.map(nodeText).join('、')}。` +
        `箭头是允许的依赖方向：${allowedEdges.map((e) => `${edgeText(e.key)}（${e.kind}）`).join('；')}。` +
        '选一类边界规则（tests/boundary.test.ts 文件头注释里的一类约束），图上实线高亮它守着的允许方向，禁止的方向画成红色虚线并打叉。',
    ),
    ...rules.flatMap((rule, i) => [
      paragraph(texts[i]),
      paragraph(
        `守着的允许方向：${rule.allowed.length === 0 ? '无' : rule.allowed.map(edgeText).join('、')}。` +
          `禁止：${rule.forbidden.map((item) => `${item.edges.map(edgeText).join('、')}——${item.what}`).join('')}`,
      ),
      paragraph(`违反时失败的 test（tests/boundary.test.ts）：${rule.tests.map((t) => `「${t.name}」，${t.checks}`).join('；')}。`),
    ]),
  ];
}

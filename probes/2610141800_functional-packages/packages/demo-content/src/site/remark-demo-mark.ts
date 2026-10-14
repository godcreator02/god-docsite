import type { PhrasingContent, Root, Text } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';
import { splitTextByDemoMark } from '../core/index.js';

// 正文里的 [[demo]] 换成 <span data-demo-remark="applied">，浏览器里能据此判断插件生效
export function remarkDemoMark() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const pieces = splitTextByDemoMark(node.value);
      if (pieces.length === 1 && pieces[0]!.kind === 'text') return;
      const replacement: PhrasingContent[] = pieces.map((piece) =>
        piece.kind === 'text'
          ? { type: 'text', value: piece.value }
          : {
              type: 'emphasis',
              children: [{ type: 'text', value: 'demo-remark-applied' }],
              data: { hName: 'span', hProperties: { 'data-demo-remark': 'applied', className: ['demo-mark'] } },
            },
      );
      (parent.children as PhrasingContent[]).splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}

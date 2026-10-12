import { readFileSync } from 'node:fs';

// 只能在编译期（Node 进程）里跑的 remark 插件：真实读一次磁盘文件，
// 并给正文追加一段标记文字。经 source.config.ts 挂进 A 集合。
export function nodeMarkerRemark(options: { marker: string }) {
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
  return (tree: any) => {
    tree.children.push({
      type: 'paragraph',
      children: [{ type: 'text', value: options.marker }],
    });
  };
}

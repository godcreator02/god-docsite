import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceSource } from 'fumadocs-core/mdx-plugins/stringifier';

/**
 * E-8 / E-1 的原型钉码插件：认 <Pin file lines /> 与 <PinTree dir depth glob />。
 * 网页显示：节点换成 PinBlock / PinTreeBlock 组件包一个普通 code 节点（外层组件在组件表里）。
 * 机读输出：用 replaceSource 在原文档的 vfile 上登记 ``` 代码块文字（登记在原节点上，替换后的
 * 外层组件继承原节点的 position，remarkLLMs 的 marker 编辑晚于预登记、按稳定排序后应用，先登记的赢）。
 */
const siteRoot = fileURLToPath(new URL('../../', import.meta.url));

const LANGS: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  mts: 'ts',
  cts: 'ts',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  json: 'json',
  md: 'md',
  mdx: 'mdx',
  css: 'css',
  html: 'html',
  yml: 'yml',
  yaml: 'yaml',
  sh: 'sh',
  bash: 'sh',
};

const langOf = (file: string): string => LANGS[extname(file).slice(1).toLowerCase()] ?? 'text';

/** 能包住这段内容的围栏：比内容里最长的一串反引号多一个，至少三个（照 renderAi 的 fenceFor） */
const fenceFor = (lines: string[]): string =>
  '`'.repeat(Math.max(3, Math.max(0, ...lines.flatMap((line) => [...line.matchAll(/`+/g)].map((m) => m[0].length))) + 1));

const attrOf = (node: any, name: string): string | undefined =>
  node.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === name)?.value;

/** ```<语言> title="<file>:<起>-<止>" 形式的代码块文字 */
function pinMarkdown(file: string, lines: string[]): string {
  const info = `${langOf(file) || 'text'} title="${file}"`;
  const fence = fenceFor(lines);
  return [`${fence}${info}`, ...lines, fence].join('\n');
}

/** 目录树文字：E-1 对照时按 renderAi 的输出微调 */
function treeMarkdown(dir: string, depth: number | undefined, glob: string | undefined): string {
  const root = resolve(siteRoot, dir);
  const list: string[] = [];
  const walkDir = (current: string, level: number) => {
    if (depth !== undefined && level >= depth) return;
    const entries = readdirSync(current).sort();
    for (const entry of entries) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        list.push(`${'- '.repeat(level)}${entry}/`);
        walkDir(full, level + 1);
      } else if (glob === undefined || entry.endsWith(glob.replace(/^\*\*/, ''))) {
        list.push(`${'- '.repeat(level)}${entry}`);
      }
    }
  };
  walkDir(root, 0);
  const info = `text title="${dir}/${glob !== undefined ? ` ${glob}` : ''}"`;
  const fence = fenceFor(list);
  return [`${fence}${info}`, ...list, fence].join('\n');
}

export function probePin() {
  return (tree: any, file: any) => {
    const replace = (nodes: any[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node && Array.isArray(node.children)) replace(node.children);
        if (!node || (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement')) continue;

        let markdown: string;
        let blockName: string;
        let title: string;

        if (node.name === 'Pin') {
          const target = attrOf(node, 'file');
          if (typeof target !== 'string') continue;
          const linesSpec = attrOf(node, 'lines');
          const full = resolve(siteRoot, target);
          const all = readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n');
          let start = 1;
          let end = all.length;
          if (linesSpec !== undefined) {
            const [s, e] = linesSpec.split('-');
            start = Number(s);
            end = Number(e ?? s);
          }
          const lines = all.slice(start - 1, end);
          // 语言按原始文件名推断；title 带上行号区间
          markdown = pinMarkdown(target, lines).replace(
            `title="${target}"`,
            `title="${target}:${start}-${end}"`,
          );
          blockName = 'PinBlock';
          title = `${target}:${start}-${end}`;
        } else if (node.name === 'PinTree') {
          const dir = attrOf(node, 'dir');
          if (typeof dir !== 'string') continue;
          const depth = attrOf(node, 'depth') !== undefined ? Number(attrOf(node, 'depth')) : undefined;
          const glob = attrOf(node, 'glob');
          markdown = treeMarkdown(dir, depth, glob);
          blockName = 'PinTreeBlock';
          title = `${dir}/`;
        } else {
          continue;
        }

        // 机读：登记在原节点上（有原文 position 的编辑才能生效）
        replaceSource(file, node, markdown);

        // 网页：外层组件包普通 code 节点，position 继承原节点（remarkLLMs 按它定位 marker 编辑）
        const fence = markdown.split('\n')[0];
        const body = markdown.split('\n').slice(1, -1);
        const lang = blockName === 'PinBlock' ? langOf(attrOf(node, 'file') ?? '') : 'text';
        const block = {
          type: 'mdxJsxFlowElement',
          name: blockName,
          attributes: [{ type: 'mdxJsxAttribute', name: 'title', value: title }],
          children: [
            {
              type: 'code',
              lang,
              meta: `title="${title}"`,
              value: body.join('\n'),
            },
          ],
          position: node.position,
        };
        void fence;
        nodes[i] = block;
      }
    };
    replace(tree.children);
  };
}

export const probePinInternal = { langOf, fenceFor, pinMarkdown, treeMarkdown, relative };

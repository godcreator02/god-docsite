import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * E-2 探针：挂在 docs 集合 mdxOptions 里的 remark 插件。
 * 只对 pin-probe.mdx 生效：把 pinned/a.ts 的内容和 pinned/dir/ 的文件列表塞进页面，
 * 并用 vfile.data._compiler.addDependency 把文件与目录登记成编译依赖。
 */
const siteRoot = fileURLToPath(new URL('../../', import.meta.url));
const pinnedFile = `${siteRoot}pinned/a.ts`;
const pinnedDir = `${siteRoot}pinned/dir`;

export function probeDep() {
  return (tree: any, file: any) => {
    const path: string = String(file.path ?? '').replace(/\\/g, '/');
    if (!path.endsWith('content/docs/pin-probe.mdx')) return;

    const source = readFileSync(pinnedFile, 'utf8').trim();
    const dirList = readdirSync(pinnedDir).sort().join(', ');

    tree.children.push({
      type: 'code',
      lang: 'ts',
      meta: 'title="pinned/a.ts"',
      value: source,
    });
    tree.children.push({
      type: 'code',
      lang: 'text',
      meta: 'title="pinned/dir/"',
      value: dirList,
    });

    file.data._compiler?.addDependency(pinnedFile);
    file.data._compiler?.addDependency(pinnedDir);
  };
}

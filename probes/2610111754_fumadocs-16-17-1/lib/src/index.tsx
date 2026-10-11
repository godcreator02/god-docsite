import { useTreeContext } from 'fumadocs-ui/contexts/tree';

/**
 * E-4 探针：构建好的库里的组件，读宿主站点 DocsLayout 提供的 tree context。
 * 与站点不是同一份 fumadocs-ui 模块时，use(TreeContext) 拿到 null，抛
 * "You must wrap this component under <DocsLayout />"。
 */
export function LibTreeProbe() {
  const { root, full } = useTreeContext();
  return (
    <div data-probe="lib-tree" data-root={root.$id ?? ''}>
      库组件读到的页面树：{full.children.length} 个顶层节点，当前根 {root.name ?? root.$id ?? '(无名字)'}
    </div>
  );
}

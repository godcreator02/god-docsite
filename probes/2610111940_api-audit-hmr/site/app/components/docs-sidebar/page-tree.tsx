import { useTreeContext, useTreePath } from '@fumadocs/base-ui/contexts/tree';
import { type FC, Fragment, type ReactNode, createContext, use, useMemo } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import type * as Base from './base';
import { usePathname } from 'fumadocs-core/framework';
import { isActive } from '../../lib/urls';

export interface SidebarPageTreeComponents {
  Item: FC<{ item: PageTree.Item }>;
  Folder: FC<{ item: PageTree.Folder; children: ReactNode }>;
  Separator: FC<{ item: PageTree.Separator }>;
}

const RendererContext = createContext<
  | (Partial<SidebarPageTreeComponents> & {
      pathname: string;
    })
  | null
>(null);

type InternalComponents = Pick<
  typeof Base,
  | 'SidebarSeparator'
  | 'SidebarFolder'
  | 'SidebarFolderLink'
  | 'SidebarFolderContent'
  | 'SidebarFolderTrigger'
  | 'SidebarItem'
>;

export function createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarSeparator,
  SidebarItem,
}: InternalComponents) {
  function renderList(nodes: PageTree.Node[]) {
    return nodes.map((node, i) => <PageTreeNode key={i} node={node} />);
  }

  function PageTreeNode({ node }: { node: PageTree.Node }) {
    const { Separator, Item, Folder, pathname } = use(RendererContext)!;

    if (node.type === 'separator') {
      if (Separator) return <Separator item={node} />;
      return (
        <SidebarSeparator>
          {node.icon}
          {node.name}
        </SidebarSeparator>
      );
    }

    if (node.type === 'folder') {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- assume node type unchanged
      const path = useTreePath();
      if (Folder) return <Folder item={node}>{renderList(node.children)}</Folder>;

      return (
        <SidebarFolder
          collapsible={node.collapsible}
          active={path.includes(node)}
          defaultOpen={node.defaultOpen}
        >
          {node.index ? (
            <SidebarFolderLink
              href={node.index.url}
              active={isActive(node.index.url, pathname)}
              external={node.index.external}
            >
              {node.icon}
              {node.name}
            </SidebarFolderLink>
          ) : (
            <SidebarFolderTrigger>
              {node.icon}
              {node.name}
            </SidebarFolderTrigger>
          )}
          <SidebarFolderContent>{renderList(node.children)}</SidebarFolderContent>
        </SidebarFolder>
      );
    }

    if (Item) return <Item item={node} />;
    return (
      <SidebarItem
        href={node.url}
        external={node.external}
        active={isActive(node.url, pathname)}
        icon={node.icon}
      >
        {node.name}
      </SidebarItem>
    );
  }

  /**
   * Render sidebar items from page tree
   */
  return function SidebarPageTree(components: Partial<SidebarPageTreeComponents>) {
    const { Folder, Item, Separator } = components;
    const { root, full } = useTreeContext();
    const path = useTreePath();
    const pathname = usePathname();

    // E-6：当前地址不在页面树里（path 为空，如 /comments）时，侧栏沿用最近一次
    // 在树里时所在的根组，即「停在最近看过的那一组」；顶层（无根组）记为 null
    let shownRoot: PageTree.Root | PageTree.Folder = root;
    if (path.length > 0) {
      lastRootName = root.type === 'folder' ? nameTextOf(root.name) : '';
    } else if (lastRootName !== '') {
      const remembered = findRootFolder(full, lastRootName);
      if (remembered) shownRoot = remembered;
    }

    return (
      <RendererContext
        value={useMemo(
          () => ({ Folder, Item, Separator, pathname }),
          [Folder, Item, Separator, pathname],
        )}
      >
        <Fragment key={shownRoot.$id}>{renderList(shownRoot.children)}</Fragment>
      </RendererContext>
    );
  };
}

/** 最近一次在树里时所在的根组名（文字）；顶层组记空串。进程内缓存，dev 单用户探针够用 */
let lastRootName = '';

/** 根组的 name 是 ReactNode（revive 出来的 React 元素，meta 标题包在 span 的 dangerouslySetInnerHTML 里），抽出其中的文字用于比较 */
function nameTextOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nameTextOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: unknown; dangerouslySetInnerHTML?: { __html?: string } } }).props;
    return nameTextOf(props?.dangerouslySetInnerHTML?.__html ?? props?.children);
  }
  return '';
}

function findRootFolder(
  node: PageTree.Root | PageTree.Folder,
  name: string,
): PageTree.Folder | undefined {
  for (const child of node.children) {
    if (child.type === 'folder') {
      if (child.root === true && nameTextOf(child.name) === name) return child;
      const nested = findRootFolder(child, name);
      if (nested) return nested;
    }
  }
  return undefined;
}

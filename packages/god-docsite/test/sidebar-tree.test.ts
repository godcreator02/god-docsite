import { describe, expect, it } from 'vitest'
import type * as PageTree from 'fumadocs-core/page-tree'
import { looseGroupId, sidebarTreeOf, withLoosePagesGrouped } from '../src/site/sidebar-tree.js'

const page = (url: string): PageTree.Item => ({ type: 'page', name: url, url })
const group = (id: string, children: PageTree.Node[]): PageTree.Folder => ({ type: 'folder', $id: id, name: id, root: true, children })

const allInGroups: PageTree.Root = {
  $id: 'root',
  name: '站',
  children: [group('guide', [page('/guide/a'), page('/guide/b')]), group('writing', [page('/writing/x')])],
}
const mixed: PageTree.Root = { $id: 'root', name: '站', children: [page('/about'), group('guide', [page('/guide/a')])] }
const hiddenPage = { type: 'page' as const, $id: 'hidden', name: '' }

function groupChildrenOf(tree: PageTree.Root, id: string): PageTree.Node[] {
  const folder = tree.children.find((node): node is PageTree.Folder => node.type === 'folder' && node.$id === id)
  if (!folder) throw new Error(`没有分组 ${id}`)
  return folder.children
}

describe('侧栏停在哪一组', () => {
  it('当前地址在页面树里：原样用页面树，停在它所在的那一组', () => {
    expect(sidebarTreeOf(allInGroups, '/writing/x', 'guide', hiddenPage)).toEqual({ tree: allInGroups, groupId: 'writing' })
  })

  it('当前地址在页面树里、不在任何一组：原样用页面树，记成不在组里', () => {
    expect(sidebarTreeOf(mixed, '/about', 'guide', hiddenPage)).toEqual({ tree: mixed, groupId: null })
  })

  it('地址不在页面树里：停在最近看过的那一组，把当前地址塞进那一组', () => {
    const { tree, groupId } = sidebarTreeOf(allInGroups, '/tasks/123', 'writing', hiddenPage)
    expect(groupId).toBe('writing')
    expect(groupChildrenOf(tree, 'writing').at(-1)).toEqual({ ...hiddenPage, url: '/tasks/123' })
    expect(groupChildrenOf(tree, 'guide')).toHaveLength(2)
    expect(tree.$id).toBe('root#/tasks/123')
  })

  it('最近看的是组外的页面：功能页面上照样显示整棵页面树', () => {
    expect(sidebarTreeOf(mixed, '/comments', null, hiddenPage)).toEqual({ tree: mixed, groupId: null })
  })

  it('还没看过页面树里的页面、全部页面都在组里：停在第一组', () => {
    const { tree, groupId } = sidebarTreeOf(allInGroups, '/comments', undefined, hiddenPage)
    expect(groupId).toBe('guide')
    expect(groupChildrenOf(tree, 'guide')).toHaveLength(3)
  })

  it('还没看过页面树里的页面、有组外的页面：显示整棵页面树', () => {
    expect(sidebarTreeOf(mixed, '/comments', undefined, hiddenPage)).toEqual({ tree: mixed, groupId: null })
  })

  it('分组在别的文件夹里面也找得到', () => {
    const nested: PageTree.Root = { $id: 'root', name: '站', children: [{ type: 'folder', $id: 'outer', name: 'outer', children: [group('inner', [page('/inner/a')])] }] }
    const { tree, groupId } = sidebarTreeOf(nested, '/comments', undefined, hiddenPage)
    expect(groupId).toBe('inner')
    const outer = tree.children[0] as PageTree.Folder
    expect((outer.children[0] as PageTree.Folder).children).toHaveLength(2)
  })

  it('页面树里没有分组：原样用页面树', () => {
    const flat: PageTree.Root = { $id: 'root', name: '站', children: [page('/a')] }
    expect(sidebarTreeOf(flat, '/comments', undefined, hiddenPage)).toEqual({ tree: flat, groupId: null })
  })
})

describe('组外的页面收成一组', () => {
  it('有分组也有组外的页面：顶层不是分组的项按原来的先后收成以站名命名的一组，排在各分组前面', () => {
    const separator: PageTree.Separator = { type: 'separator', name: '分隔' }
    const plainFolder: PageTree.Folder = { type: 'folder', name: '写作', children: [page('/writing/x')] }
    const tree: PageTree.Root = { $id: 'root', name: '站', children: [page('/about'), group('guide', [page('/guide/a')]), separator, plainFolder] }
    const grouped = withLoosePagesGrouped(tree)
    expect(grouped.children.map((node) => (node.type === 'folder' ? node.$id ?? node.name : node.type))).toEqual([looseGroupId, 'guide'])
    expect(grouped.children[0]).toEqual({ type: 'folder', $id: looseGroupId, name: '站', root: true, children: [page('/about'), separator, plainFolder] })
  })

  it('全部页面都在组里、或者一个分组都没有：原样返回', () => {
    expect(withLoosePagesGrouped(allInGroups)).toBe(allInGroups)
    const flat: PageTree.Root = { $id: 'root', name: '站', children: [page('/a')] }
    expect(withLoosePagesGrouped(flat)).toBe(flat)
  })

  it('收完以后，功能页面上侧栏停在最近看过的那一组，还没看过就停在站名那一组', () => {
    const grouped = withLoosePagesGrouped(mixed)
    expect(sidebarTreeOf(grouped, '/about', undefined, hiddenPage).groupId).toBe(looseGroupId)
    expect(sidebarTreeOf(grouped, '/comments', 'guide', hiddenPage).groupId).toBe('guide')
    expect(sidebarTreeOf(grouped, '/comments', undefined, hiddenPage).groupId).toBe(looseGroupId)
  })
})
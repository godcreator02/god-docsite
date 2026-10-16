/**
 * LayoutColumns（「fumadocs 界面层导读」页「样式机制：部件自己把尺寸写回布局」一节）的全部数据，画面（layout-columns.tsx）只读这一份。
 * 容器的 grid 模板、默认 0 的宽度变量、268px / 900px / 1168px、md: 与 xl: 两个断点、目录浮层条 40px（--spacing(10)），
 * 全部照 16.17.1 的源码：layouts/docs/slots/container.tsx、page/slots/container.tsx、page/slots/toc.tsx、slots/sidebar.tsx。
 * 四种情况是同一套机制的四种结果，断点只用 Tailwind 的名字（md、xl），不写像素值。
 */

/** 各区在图里固定的角色色（与画面里 data-role 一致） */
export const areaRoles = {
  sidebar: 'violet',
  header: 'slate',
  tocPopover: 'amber',
  main: 'emerald',
  toc: 'cyan',
};

export const cases = [
  {
    id: 'full',
    label: '宽屏',
    vars: { sidebar: '--fd-sidebar-width: 268px', toc: '--fd-toc-width: 268px' },
    columns: '108px 1fr 108px',
    rows: 'auto 1fr',
    areas: ['side header toc', 'side main toc'],
    cells: [
      { area: 'side', label: 'sidebar', sub: '268px' },
      { area: 'header', label: 'header' },
      { area: 'main', label: 'main', sub: '正文最宽 900px' },
      { area: 'toc', label: 'toc', sub: '268px' },
    ],
    who: [
      { role: 'sidebar', text: '侧栏 md:layout:[--fd-sidebar-width:268px]' },
      { role: 'toc', text: '目录 xl:layout:[--fd-toc-width:268px]' },
    ],
    text: '宽屏（xl 及以上）侧栏与目录都渲染，各借 :has() 把自己的 268px 写回容器，两列都在；正文默认最宽 900px。',
  },
  {
    id: 'no-toc',
    label: 'full 页',
    vars: { sidebar: '--fd-sidebar-width: 268px', toc: '--fd-toc-width: 0px' },
    columns: '108px 1fr',
    rows: 'auto 1fr',
    areas: ['side header', 'side main'],
    cells: [
      { area: 'side', label: 'sidebar', sub: '268px' },
      { area: 'header', label: 'header' },
      { area: 'main', label: 'main', sub: '正文最宽 1168px' },
    ],
    who: [
      { role: 'sidebar', text: '侧栏 md:layout:[--fd-sidebar-width:268px]' },
      { role: undefined, text: '目录部件没渲染：--fd-toc-width 没人写，停在 0，那一列消失' },
    ],
    text: '这一页是 full：目录部件整个不渲染，没人写 --fd-toc-width，那一列塌成 0；正文最宽放宽到 1168px。',
  },
  {
    id: 'md',
    label: 'md–xl',
    vars: { sidebar: '--fd-sidebar-width: 268px', toc: '--fd-toc-width: 0px' },
    columns: '108px 1fr',
    rows: 'auto auto 1fr',
    areas: ['side header', 'side pop', 'side main'],
    cells: [
      { area: 'side', label: 'sidebar', sub: '268px' },
      { area: 'header', label: 'header' },
      { area: 'pop', label: 'toc-popover', sub: '40px' },
      { area: 'main', label: 'main', sub: '正文最宽 900px' },
    ],
    who: [
      { role: 'sidebar', text: '侧栏 md:layout:[--fd-sidebar-width:268px]' },
      { role: 'tocPopover', text: '目录浮层条 max-xl:layout:[--fd-toc-popover-height:--spacing(10)]' },
    ],
    text: 'md 到 xl 之间只有侧栏写了宽度；目录收进顶部浮层（高 40px，占 toc-popover 区），右侧那一列不存在。',
  },
  {
    id: 'narrow',
    label: '窄屏',
    vars: { sidebar: '--fd-sidebar-width: 0px', toc: '--fd-toc-width: 0px' },
    columns: '1fr',
    rows: 'auto auto 1fr',
    areas: ['header', 'pop', 'main'],
    cells: [
      { area: 'header', label: 'header' },
      { area: 'pop', label: 'toc-popover', sub: '40px' },
      { area: 'main', label: 'main', sub: '正文最宽 900px' },
    ],
    who: [
      { role: 'sidebar', text: '侧栏 max-md:hidden：不渲染、不写宽度' },
      { role: 'tocPopover', text: '目录浮层条 max-xl:layout:[--fd-toc-popover-height:--spacing(10)]' },
    ],
    text: '窄屏（md 以下）侧栏整个隐藏（max-md:hidden），--fd-sidebar-width 回到 0；剩下移动端头部、目录浮层条与正文。',
  },
];

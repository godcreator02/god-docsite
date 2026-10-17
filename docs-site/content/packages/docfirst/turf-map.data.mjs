/**
 * TurfMap（「docfirst：命令行」那一页「哪些文件归 docfirst 管」一节）的全部数据，画面（turf-map.tsx）只读这一份。
 * 树是拼的例子：配置、三份生成正本、未来区起始页、第一张轨迹卡是 docfirst.create 建站时复制来的（包的 template/）；
 * content/packages/ 整组（页面 x.mdx 与同名文件夹里的讲解组件）与 content/_components/ 是为讲解补的，刚建好的站里没有。
 * 只画归六类之一的文件：meta.json 这类既不是 .mdx、也不被组件格式认领的没画。
 * 分类的规则在正文钉住的 project.ts 第 37–55 行：内容根下除 trajectory/、future/ 外的文件都进现状区，
 * 其中 .mdx 是页面、被组件格式认领的是组件文件（_components/ 是内容根下的普通文件夹，不另收）；站点根的 trajectory/ 是配置指的卡目录。
 */

/** 六种归类：label 是树行与图例里的胶囊文案，note 是图例里胶囊后的一句话 */
export const kinds = [
  { id: 'config', role: 'violet', label: '配置', note: 'docfirst 读它装配项目，不进核对' },
  { id: 'page', role: 'blue', label: '页面（code-pin 核对钉）', note: '内容根下（trajectory/、future/ 之外）的 .mdx' },
  { id: 'component', role: 'blue', label: '组件文件（code-pin 组件格式）', note: '页面同名文件夹里与内容根下 _components/ 里被认领的源码，钉也核对' },
  { id: 'output', role: 'emerald', label: '生成正本（再查名册、核对落点）', note: 'outputs 里登记的页面，doc-export 查名册外组件、核对每个落点' },
  { id: 'future', role: 'slate', label: '未来区（不管）', note: '内容根下的 future/，不进核对' },
  { id: 'card', role: 'cyan', label: '轨迹卡（trajectory 查病）', note: '配置指的卡目录，每条病一个红' },
];

/** 站目录的文件树；kind 是 kinds 里的 id，有 children 的是目录 */
export const tree = {
  name: '站目录', children: [
    { name: 'docfirst.config.mjs', kind: 'config' },
    { name: 'content', children: [
      { name: '_components', kind: 'component' },
      { name: 'docs', children: [
        { name: 'outputs', children: [
          { name: 'agents.mdx', kind: 'output' },
          { name: 'claude.mdx', kind: 'output' },
          { name: 'readme.mdx', kind: 'output' },
        ] },
      ] },
      { name: 'future', children: [
        { name: 'overview.mdx', kind: 'future' },
      ] },
      { name: 'packages', children: [
        { name: 'x.mdx', kind: 'page' },
        { name: 'x', children: [
          { name: 'demo.tsx', kind: 'component' },
          { name: 'demo.data.mjs', kind: 'component' },
        ] },
      ] },
    ] },
    { name: 'trajectory', children: [
      { name: '2026-01-01-site-born.md', kind: 'card' },
    ] },
  ],
};

/** 树下面那行灰字 */
export const note = '站点根还有 src/components/ 且里面有文件、或 app/components/ 下有带钉码标记的文件时，装配直接报错。';

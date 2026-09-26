/**
 * 名册的名单，站这一侧的正本。mdx.tsx 用它的类型限定 React 表：少一个、多一个都编译不过；
 * scripts/verify-roster.mjs 拿它跟 docfirst.config.mjs 里的压平表逐个核对。
 * Files / Folder / File 是 fumadocs 自己的文件树：目录树引用插入的就是它们，作者手写也行，压平规则在
 * @godcreator/docfirst-fumadocs/roster 的 fumadocsRoster 里。
 * Term 是术语标注：源文件里一般没有它，是构建时标注插件加进语法树的，但 mdx 编译出来的 JSX 会引用它，
 * 所以 React 表必须有；压平表也得有，核对脚本要求两边一致。
 * PinGlance、PinStory、PinJudge、SeamMap、RenderFlow 是自包含的讲解组件：画面与讲解文字都在 src/components/ 下各自的目录里，
 * mdx 里只写标签；控制条与零件来自 @godcreator/docs-explain。
 * 这个文件只有可擦除的类型，Node 能直接加载。
 */
export const componentNames = ['Note', 'Tabs', 'Tab', 'Files', 'Folder', 'File', 'Term', 'PinGlance', 'PinStory', 'PinJudge', 'SeamMap', 'RenderFlow'] as const;
export type ComponentName = (typeof componentNames)[number];

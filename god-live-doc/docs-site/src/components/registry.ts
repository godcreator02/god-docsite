/**
 * 名册的名单，站这一侧的正本。mdx.tsx 用它的类型逼着 React 表一个不多一个不少；
 * scripts/verify-roster.mjs 拿它跟 livedoc.config.mjs 里的压平表两头对。
 * Files / Folder / File 是 fumadocs 自己的文件树：目录树引用注入的就是它们，作者手写也行，压平规则在格式包的默认表里。
 * registry.ts 只有可擦除的类型，Node 直接吃。
 */
export const componentNames = ['Note', 'Tabs', 'Tab', 'Files', 'Folder', 'File'] as const;
export type ComponentName = (typeof componentNames)[number];

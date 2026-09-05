/**
 * 名册的名单：跟 livedoc.config.mjs 的压平表两头对，脚本在 scripts/verify-roster.mjs。
 * Note / Files / Folder / File 是格式包默认表已经带的语义组件。
 * 星轨盘不在名册里：盘是一条独立的整页路由 /trajectory，不进 mdx。
 */
export const componentNames = ['Note', 'Files', 'Folder', 'File'] as const;
export type ComponentName = (typeof componentNames)[number];

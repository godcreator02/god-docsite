/**
 * 名册的名单：跟 livedoc.config.mjs 的压平表两头对，脚本在 scripts/verify-roster.mjs。
 * Note / Files / Folder / File 是格式包默认表已经带的语义组件；Trajectory 是这个站自己接的画布组件。
 */
export const componentNames = ['Note', 'Files', 'Folder', 'File', 'Trajectory'] as const;
export type ComponentName = (typeof componentNames)[number];

/** 星轨盘的地址；卡页是 `${trajectoryHrefBase}/<卡身份>`。路由表、remark 插件、侧栏入口与两条路由都用它 */
export const trajectoryHrefBase = "/trajectory";

/** 卡身份：轨迹卡目录下的文件名去掉 .md / .mdx */
export const cardIdOf = (path: string): string => path.replace(/\.mdx?$/, "");

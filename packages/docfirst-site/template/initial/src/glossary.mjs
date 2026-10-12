/**
 * 这个站的术语表——**正本就是这份数据**：页面上标出来的词、鼠标移上去看到的那句定义，全从这儿来。
 * docfirst.config.mjs 的 glossary 指向这个文件，构建页面时功能包 docfirst-site 的 remark 插件按它标注；改词改这里。
 *
 * 收词的判据（正本是随工作台插件发的 skill「docs-writing」）：
 *   收 这个项目自己造的词、通用词在这里有特定含义的
 *   不收 通用编程词，不收单字词——单字词会命中一切
 * **定义里不写会变的东西**（函数名、路径、行号）：这份数据钉不住，写进来就会悄悄过时。
 */
/** @type {import("@godcreator/docfirst-workflow/fumadocs").TermEntry[]} */
export const terms = [];

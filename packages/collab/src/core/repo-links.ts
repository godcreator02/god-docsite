/*
 * repo: 链接：指向项目文件夹（协作仓的上一级，项目在 Gitea 上那个组织的仓都克隆在这里，文件夹名就是仓名）里某个仓里的文件，
 * 写成 repo:<仓>/<路径>，文本文件可以带 #L<行号>，PDF 可以带 #page=<页>。浏览器与站点服务之间的约定写在这里，只在功能包里用
 */

export const repoLinkPrefix = 'repo:'

/** 资源路由：GET ?target=<repo: 链接> 回 RepoLinkCheck；POST 表单 { target } 在本机打开 */
export const repoLinksApiUrl = '/api/repo-links'

/** GET <前缀><仓>/<路径>：把 PDF、图片、网页、视频交给浏览器 */
export const projectFileApiUrl = '/api/project-file/'

/**
 * repo: 链接怎么打开：browser 由页面打开 url；vscode 与 system 由站点服务在本机打开。
 * vscode 在开着项目文件夹的 VS Code 窗口里打开文件（没有这样的窗口就新开一个打开项目文件夹）
 */
export type RepoLinkOpen = { how: 'vscode' } | { how: 'browser'; url: string } | { how: 'system' }

/**
 * 检查一条 repo: 链接：能打开的带打开方式，打不开的带原因。
 * no-repo 是本机还没克隆那个仓，read-only 是只读的站点（没有本机身份）不碰项目文件夹，这两种显示成灰色；no-file 与 invalid 显示成红色
 */
export type RepoLinkCheck =
  | { target: string; state: 'ok'; open: RepoLinkOpen }
  | { target: string; state: 'no-repo' | 'no-file' | 'invalid' | 'read-only'; problem: string }

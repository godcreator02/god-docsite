import { realpathSync } from 'node:fs'
import path from 'node:path'

/** 项目文件夹：协作仓的上一级，以组织命名，项目里的仓都在这里 */
export function projectDirOfCollabRepo(collabRepo: string): string {
  return path.dirname(collabRepo)
}

/**
 * 站点目录所在的项目文件夹：站点就在协作仓的 site/ 里，不用问 git。
 * 取真实路径：Windows 上临时目录这类路径可能是短文件名，交给 VS Code 的路径要长文件名，它才认得出项目文件夹已经开着
 */
export function projectDirOfSite(siteRoot: string): string {
  return projectDirOfCollabRepo(realpathSync.native(path.dirname(path.resolve(siteRoot))))
}

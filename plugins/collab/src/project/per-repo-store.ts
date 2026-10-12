import { repoKeyOf } from './project.js'

/**
 * 按项目（协作仓根）、再按项目文件夹里的仓（目录名）记的一份份结果；换掉或去掉以后和原来不一样才调 onChange。
 * 别的仓那一边读 Gitea 的结果都这样记：按事件只换掉一个仓的，完整刷新时去掉已经不在项目文件夹里的
 */
export class PerRepoStore<T> {
  private readonly byProject = new Map<string, Map<string, T>>()

  constructor(private readonly onChange: (repo: string) => void) {}

  set(repo: string, name: string, value: T): void {
    const key = repoKeyOf(repo)
    const entries = this.byProject.get(key) ?? new Map<string, T>()
    if (entries.has(name) && JSON.stringify(entries.get(name)) === JSON.stringify(value)) return
    entries.set(name, value)
    this.byProject.set(key, entries)
    this.onChange(repo)
  }

  /** 只留 names 里的仓 */
  retainOnly(repo: string, names: readonly string[]): void {
    const entries = this.byProject.get(repoKeyOf(repo))
    if (entries === undefined) return
    const gone = [...entries.keys()].filter((name) => !names.includes(name))
    for (const name of gone) entries.delete(name)
    if (gone.length > 0) this.onChange(repo)
  }

  /** 一个项目记着的全部，按仓名排 */
  entriesOf(repo: string): Array<[string, T]> {
    return [...(this.byProject.get(repoKeyOf(repo)) ?? new Map<string, T>()).entries()].sort(([a], [b]) => a.localeCompare(b))
  }

  forget(repo: string): void {
    this.byProject.delete(repoKeyOf(repo))
  }
}

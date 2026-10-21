import path from 'node:path'
import { DocsiteRejected } from './errors.js'

const providedDirNamePattern = /^[a-z][a-z0-9-]*$/

/**
 * 插件提供给个人站的本机目录（论文库、资料库）：名字到绝对路径，放进托管方上下文的 dirs。
 * 名字只是功能包和插件之间约好的一个词，这里不认识它；同一个名字只许一个提供者
 */
export class ProvidedSiteDirs {
  private readonly dirs = new Map<string, string>()

  constructor(private readonly onChange: () => void) {}

  /** 登记一个目录，返回撤销的函数；登记与撤销都会让托管方上下文重推 */
  provide(name: string, dir: string): () => void {
    if (!providedDirNamePattern.test(name)) throw new DocsiteRejected(`提供的目录名 ${JSON.stringify(name)} 要是小写字母开头的小写字母、数字与 -`)
    if (!path.isAbsolute(dir)) throw new DocsiteRejected(`提供的目录 ${name} 要写绝对路径，收到 ${JSON.stringify(dir)}`)
    const existing = this.dirs.get(name)
    if (existing !== undefined) throw new DocsiteRejected(`目录名 ${name} 已经有人提供了（${existing}）：同一个名字只许一个插件提供`)
    this.dirs.set(name, dir)
    this.onChange()
    return () => {
      if (this.dirs.get(name) !== dir) return
      this.dirs.delete(name)
      this.onChange()
    }
  }

  all(): Record<string, string> {
    return Object.fromEntries(this.dirs)
  }
}
